import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { Role, AttendanceStatus } from "@prisma/client";
import { getVisibleUserIds } from "../lib/hierarchy";
import { markAbsencesForDate } from "../workers/attendance.worker";

const LATE_AFTER_HOUR   = 9;
const LATE_AFTER_MINUTE = 30;

async function getOrgThresholds(organizationId: string | null) {
  if (!organizationId) return { halfDayMin: 240, fullDayMin: 480 };
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const s = (org?.settings ?? {}) as Record<string, any>;
  return {
    halfDayMin: Number(s.halfDayMinutes ?? 240),
    fullDayMin: Number(s.fullDayMinutes ?? 480),
  };
}

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function resolveDate(clientDate?: string): Date {
  if (clientDate && /^\d{4}-\d{2}-\d{2}$/.test(clientDate)) {
    return parseDateOnly(clientDate);
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function deriveCheckInStatus(checkIn: Date, workMode?: string): AttendanceStatus {
  if (workMode === "WFH") return AttendanceStatus.WFH;
  const h = checkIn.getHours();
  const m = checkIn.getMinutes();
  return h > LATE_AFTER_HOUR || (h === LATE_AFTER_HOUR && m > LATE_AFTER_MINUTE)
    ? AttendanceStatus.LATE
    : AttendanceStatus.PRESENT;
}

function deriveDayStatus(
  totalMinutes: number,
  firstSessionStatus: AttendanceStatus,
  halfDayMin: number,
  fullDayMin: number,
): AttendanceStatus {
  if (totalMinutes < halfDayMin) return AttendanceStatus.ABSENT;
  if (totalMinutes < fullDayMin) return AttendanceStatus.HALF_DAY;
  return firstSessionStatus === AttendanceStatus.WFH
    ? AttendanceStatus.WFH
    : firstSessionStatus;
}

const attendanceSelect = {
  id: true, date: true, checkIn: true, checkOut: true,
  duration: true, status: true, workMode: true, notes: true,
  latitude: true, longitude: true, address: true,
  createdAt: true,
  user: {
    select: {
      id: true, name: true, avatar: true, role: true,
      department: { select: { id: true, name: true } },
    },
  },
};

// ── CHECK IN ──────────────────────────────────────────────────────────
export async function checkIn(req: AuthRequest, res: Response) {
  const user = req.user!;
  const { latitude, longitude, address, date: clientDate, workMode } = req.body ?? {};

  const date = resolveDate(clientDate);
  const now  = new Date();

  const activeSession = await prisma.attendance.findFirst({
    where: { userId: user.id, date, checkOut: null },
  });
  if (activeSession) {
    return res.status(400).json({ message: "Already checked in — please check out first." });
  }

  const mode   = workMode === "WFH" ? "WFH" : "OFFICE";
  const status = deriveCheckInStatus(now, mode);

  const record = await prisma.attendance.create({
    data: {
      userId: user.id, organizationId: user.organizationId, date,
      checkIn: now, status, workMode: mode,
      latitude:  latitude  ? Number(latitude)  : null,
      longitude: longitude ? Number(longitude) : null,
      address:   address   ?? null,
    },
    select: attendanceSelect,
  });
  return res.status(201).json(record);
}

// ── CHECK OUT ─────────────────────────────────────────────────────────
export async function checkOut(req: AuthRequest, res: Response) {
  const user = req.user!;
  const { date: clientDate } = req.body ?? {};

  const date = resolveDate(clientDate);
  const now  = new Date();

  const activeSession = await prisma.attendance.findFirst({
    where: { userId: user.id, date, checkOut: null },
    orderBy: { checkIn: "asc" },
  });
  if (!activeSession) {
    return res.status(404).json({ message: "No active check-in found for today" });
  }

  const sessionMinutes = Math.round(
    (now.getTime() - activeSession.checkIn.getTime()) / 60000
  );

  const previousSessions = await prisma.attendance.findMany({
    where: { userId: user.id, date, checkOut: { not: null } },
    select: { duration: true },
  });
  const previousMinutes = previousSessions.reduce((s, r) => s + (r.duration ?? 0), 0);
  const totalMinutes    = previousMinutes + sessionMinutes;

  const firstSession = await prisma.attendance.findFirst({
    where: { userId: user.id, date },
    orderBy: { checkIn: "asc" },
    select: { status: true },
  });
  const firstStatus = firstSession?.status ?? AttendanceStatus.PRESENT;
  const { halfDayMin, fullDayMin } = await getOrgThresholds(user.organizationId);
  const dayStatus = deriveDayStatus(totalMinutes, firstStatus, halfDayMin, fullDayMin);

  const updated = await prisma.attendance.update({
    where: { id: activeSession.id },
    data:  { checkOut: now, duration: sessionMinutes, status: dayStatus },
    select: attendanceSelect,
  });
  return res.json(updated);
}

// ── GET TODAY ─────────────────────────────────────────────────────────
export async function getToday(req: AuthRequest, res: Response) {
  const user = req.user!;
  const { date: clientDate } = req.query;
  const date = resolveDate(clientDate as string | undefined);

  const sessions = await prisma.attendance.findMany({
    where: { userId: user.id, date },
    select: attendanceSelect,
    orderBy: { checkIn: "asc" },
  });

  const completedMinutes = sessions
    .filter((s) => s.checkOut != null)
    .reduce((sum, s) => sum + (s.duration ?? 0), 0);

  const activeSession = sessions.find((s) => !s.checkOut) ?? null;
  const hasActive     = activeSession != null;
  const firstStatus   = sessions[0]?.status ?? AttendanceStatus.PRESENT;
  const { halfDayMin, fullDayMin } = await getOrgThresholds(user.organizationId);
  const dayStatus     = sessions.length > 0
    ? deriveDayStatus(completedMinutes, firstStatus, halfDayMin, fullDayMin)
    : null;

  return res.json({ sessions, totalMinutes: completedMinutes, dayStatus, hasActive, activeSession });
}

// ── MARK LEAVE ────────────────────────────────────────────────────────
export async function markLeave(req: AuthRequest, res: Response) {
  const caller = req.user!;
  const { userId, date: clientDate, notes } = req.body ?? {};

  // Verify caller has visibility over the target user
  const visibleIds = await getVisibleUserIds(caller);
  const targetId   = userId ?? caller.id;

  const target = await prisma.user.findFirst({ where: { id: targetId, ...(caller.organizationId ? { organizationId: caller.organizationId } : {}), isActive: true }, select: { id: true } });
  if (!target) return res.status(404).json({ message: "Employee not found" });

  if (visibleIds !== null && !visibleIds.includes(targetId)) {
    return res.status(403).json({ message: "Not authorised to manage this employee's attendance" });
  }

  const date = resolveDate(clientDate);
  const existing = await prisma.attendance.findFirst({ where: { userId: targetId, date } });
  if (existing) {
    return res.status(400).json({ message: "Attendance already recorded for this date" });
  }

  const dayStart = new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 9, 0, 0
  ));
  const dayEnd = new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 18, 0, 0
  ));

  const record = await prisma.attendance.create({
    data: {
      userId: targetId, date,
      organizationId: caller.organizationId,
      checkIn: dayStart, checkOut: dayEnd,
      duration: 480,
      status: AttendanceStatus.LEAVE,
      workMode: "LEAVE",
      notes: notes ?? null,
    },
    select: attendanceSelect,
  });
  return res.status(201).json(record);
}

// ── LIST ATTENDANCE ───────────────────────────────────────────────────
export async function listAttendance(req: AuthRequest, res: Response) {
  const {
    userId, startDate, endDate,
    page = "1", pageSize = "31",
  } = req.query;
  const user = req.user!;

  // Determine which users the caller may see
  const visibleIds = await getVisibleUserIds(user);

  const where: any = { ...(user.organizationId ? { organizationId: user.organizationId } : {}) };

  if (userId) {
    const targetId = String(userId);
    // Verify caller can see the requested userId
    if (visibleIds !== null && !visibleIds.includes(targetId)) {
      return res.status(403).json({ message: "Not authorised to view this employee's attendance" });
    }
    where.userId = targetId;
  } else if (visibleIds !== null) {
    where.userId = { in: visibleIds };
  }
  // visibleIds === null → no userId filter → sees all

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = parseDateOnly(String(startDate));
    if (endDate)   where.date.lte = parseDateOnly(String(endDate));
  }

  // Never surface an ABSENT record for today — the day hasn't ended yet.
  // ABSENT for today becomes visible from tomorrow onwards.
  const todayUTC = new Date(Date.UTC(
    new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()
  ));
  where.NOT = { AND: [{ status: AttendanceStatus.ABSENT }, { date: todayUTC }] };

  const skip = (Number(page) - 1) * Number(pageSize);
  const take = Number(pageSize);

  const [records, total] = await Promise.all([
    prisma.attendance.findMany({
      where,
      select: attendanceSelect,
      orderBy: [{ date: "desc" }, { checkIn: "asc" }],
      skip, take,
    }),
    prisma.attendance.count({ where }),
  ]);

  return res.json({ items: records, total, page: Number(page), pageSize: Number(pageSize) });
}

// ── FILL ABSENCES (admin backfill) ────────────────────────────────────
export async function fillAbsences(req: AuthRequest, res: Response) {
  const caller = req.user!;

  // Only managers and admins
  const ALLOWED: string[] = [Role.FOUNDER, Role.MANAGER, Role.CFO, Role.HR, Role.CPO];
  if (!ALLOWED.includes(caller.role)) {
    return res.status(403).json({ message: "Not authorised" });
  }

  const { startDate, endDate } = req.body as { startDate?: string; endDate?: string };

  const start = startDate
    ? parseDateOnly(startDate)
    : new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() - 1));
  const end = endDate ? parseDateOnly(endDate) : start;

  const results: { date: string; marked: number }[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    const n = await markAbsencesForDate(new Date(cur), caller.organizationId ?? undefined);
    results.push({ date: cur.toISOString().slice(0, 10), marked: n });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return res.json({ processed: results.length, results });
}

// ── GET STATS ─────────────────────────────────────────────────────────
export async function getStats(req: AuthRequest, res: Response) {
  const { userId, month, year } = req.query;
  const user = req.user!;

  const visibleIds = await getVisibleUserIds(user);

  // Determine target scope
  let targetUserId: string | undefined;
  if (userId) {
    const tid = String(userId);
    if (visibleIds !== null && !visibleIds.includes(tid)) {
      return res.status(403).json({ message: "Not authorised" });
    }
    targetUserId = tid;
  }

  const now = new Date();
  const y   = year  ? Number(year)      : now.getUTCFullYear();
  const m   = month ? Number(month) - 1 : now.getUTCMonth();
  const startDate = new Date(Date.UTC(y, m, 1));
  const endDate   = new Date(Date.UTC(y, m + 1, 0));

  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const where: any = {
    ...(user.organizationId ? { organizationId: user.organizationId } : {}),
    date: { gte: startDate, lte: endDate },
    checkOut: { not: null },
    // Exclude today's ABSENT record — the day hasn't ended yet
    NOT: { AND: [{ status: AttendanceStatus.ABSENT }, { date: todayUTC }] },
  };
  if (targetUserId) {
    where.userId = targetUserId;
  } else if (visibleIds !== null) {
    where.userId = { in: visibleIds };
  }

  const records = await prisma.attendance.findMany({
    where,
    select: { status: true, duration: true, date: true, userId: true },
  });

  // Group by (userId, date) — use last session's status per day
  const dayMap = new Map<string, { status: string; totalMin: number }>();
  for (const r of records) {
    const key = `${r.userId}::${r.date.toISOString().slice(0, 10)}`;
    const existing = dayMap.get(key);
    dayMap.set(key, {
      status:   r.status,
      totalMin: (existing?.totalMin ?? 0) + (r.duration ?? 0),
    });
  }

  const days     = [...dayMap.values()];
  const present  = days.filter((d) => d.status === "PRESENT").length;
  const late     = days.filter((d) => d.status === "LATE").length;
  const halfDay  = days.filter((d) => d.status === "HALF_DAY").length;
  const wfh      = days.filter((d) => d.status === "WFH").length;
  const leave    = days.filter((d) => d.status === "LEAVE").length;
  const totalMin = days.reduce((s, d) => s + d.totalMin, 0);

  return res.json({
    present, late, halfDay, wfh, leave,
    totalDays:  days.length,
    totalHours: +(totalMin / 60).toFixed(1),
  });
}

// ── TEAM TODAY ────────────────────────────────────────────────────────
export async function getTeamToday(req: AuthRequest, res: Response) {
  const user = req.user!;

  // Employees cannot see team today
  if (user.role === Role.EMPLOYEE) {
    return res.status(403).json({ message: "Access denied" });
  }

  const { date: clientDate } = req.query;
  const today      = resolveDate(clientDate as string | undefined);
  const visibleIds = await getVisibleUserIds(user);

  // Exclude auto-stamped ABSENT records — they're placeholders, not real sessions
  const sessionWhere: any = { ...(user.organizationId ? { organizationId: user.organizationId } : {}), date: today, NOT: { status: AttendanceStatus.ABSENT } };
  if (visibleIds !== null) sessionWhere.userId = { in: visibleIds };

  const sessions = await prisma.attendance.findMany({
    where: sessionWhere,
    select: attendanceSelect,
    orderBy: { checkIn: "asc" },
  });

  // One entry per user — keep latest session
  const userSessionMap = new Map<string, typeof sessions[0]>();
  for (const s of sessions) {
    userSessionMap.set(s.user.id, s);
  }
  const present = [...userSessionMap.values()];

  const checkedInIds = present.map((r) => r.user.id);
  const absentWhere: any = { isActive: true, ...(user.organizationId ? { organizationId: user.organizationId } : {}), id: { notIn: checkedInIds } };
  if (visibleIds !== null) absentWhere.id = { notIn: checkedInIds, in: visibleIds };

  const absent = await prisma.user.findMany({
    where: absentWhere,
    select: {
      id: true, name: true, avatar: true, role: true,
      department: { select: { id: true, name: true } },
    },
  });

  return res.json({ present, absent });
}
