import { AttendanceStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";

export async function markAbsencesForDate(date: Date, organizationId?: string): Promise<number> {
  const targetDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

  // Don't process future dates
  const todayUTC = new Date();
  const todayMidnight = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate()));
  if (targetDate >= todayMidnight) return 0;

  const users = await prisma.user.findMany({
    where: { isActive: true, organizationId: organizationId ?? { not: null } },
    select: { id: true, organizationId: true },
  });

  let marked = 0;
  for (const user of users) {
    const existing = await prisma.attendance.findFirst({
      where: { userId: user.id, date: targetDate },
    });
    if (!existing) {
      await prisma.attendance.create({
        data: {
          userId: user.id,
          organizationId: user.organizationId,
          date: targetDate,
          checkIn: targetDate,
          checkOut: targetDate,
          duration: 0,
          status: AttendanceStatus.ABSENT,
          workMode: "OFFICE",
        },
      }).catch(() => {}); // ignore race-condition duplicate inserts
      marked++;
    }
  }
  return marked;
}

export function startAttendanceWorker() {
  console.log("Attendance worker started — marks absences daily at 00:01 UTC");

  // On startup, retroactively fill yesterday in case the server was restarted
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  markAbsencesForDate(yesterday)
    .then((n) => n > 0 && console.log(`Attendance worker: marked ${n} absent for ${yesterday.toISOString().slice(0, 10)}`))
    .catch(console.error);

  // Schedule the recurring run: fire at 00:01 UTC each day
  const now = new Date();
  const nextRun = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
    0, 1, 0, // 00:01:00 UTC
  ));
  const msUntilNext = nextRun.getTime() - now.getTime();

  setTimeout(function runDaily() {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    markAbsencesForDate(d)
      .then((n) => n > 0 && console.log(`Attendance worker: marked ${n} absent for ${d.toISOString().slice(0, 10)}`))
      .catch(console.error);

    setTimeout(runDaily, 24 * 60 * 60 * 1000);
  }, msUntilNext);
}
