import api from "./api";

export type AttendanceStatus = "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "WFH" | "LEAVE";

export interface AttendanceUser {
  id: string;
  name: string;
  avatar?: string | null;
  role: string;
  department?: { id: string; name: string } | null;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string;
  checkOut?: string | null;
  duration?: number | null;
  status: AttendanceStatus;
  notes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  createdAt: string;
  user: AttendanceUser;
}

// Returned by GET /attendance/today
export interface TodayResponse {
  sessions:      AttendanceRecord[];
  totalMinutes:  number;
  dayStatus:     AttendanceStatus | null;
  hasActive:     boolean;
  activeSession: AttendanceRecord | null;
}

export interface AttendanceListResponse {
  items: AttendanceRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AttendanceStats {
  present:    number;
  late:       number;
  halfDay:    number;
  totalDays:  number;
  totalHours: number;
}

export interface TeamTodayResponse {
  present: AttendanceRecord[];
  absent:  AttendanceUser[];
}

export interface AttendanceFilters {
  userId?:    string;
  startDate?: string;
  endDate?:   string;
  page?:      number;
  pageSize?:  number;
}

export const STATUS_CONFIG: Record<AttendanceStatus, { label: string; color: string }> = {
  PRESENT:  { label: "Present",  color: "green"   },
  LATE:     { label: "Late",     color: "orange"  },
  HALF_DAY: { label: "Half Day", color: "blue"    },
  ABSENT:   { label: "Absent",   color: "red"     },
  WFH:      { label: "WFH",      color: "purple"  },
  LEAVE:    { label: "On Leave", color: "default" },
};

function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const attendanceApi = {
  checkIn: (payload?: { latitude?: number; longitude?: number; address?: string; workMode?: string }) =>
    api.post<AttendanceRecord>("/attendance/check-in", { ...payload, date: localDateStr() }).then((r) => r.data),
  checkOut: () =>
    api.post<AttendanceRecord>("/attendance/check-out", { date: localDateStr() }).then((r) => r.data),
  getToday: () =>
    api.get<TodayResponse>("/attendance/today", { params: { date: localDateStr() } }).then((r) => r.data),
  teamToday: () =>
    api.get<TeamTodayResponse>("/attendance/team-today").then((r) => r.data),
  stats: (params?: { userId?: string; month?: number; year?: number }) =>
    api.get<AttendanceStats>("/attendance/stats", { params }).then((r) => r.data),
  list: (filters?: AttendanceFilters) =>
    api.get<AttendanceListResponse>("/attendance", { params: filters }).then((r) => r.data),
  markLeave: (payload: { userId: string; date: string; notes?: string }) =>
    api.post<AttendanceRecord>("/attendance/leave", payload).then((r) => r.data),
  fillAbsences: (startDate: string, endDate: string) =>
    api.post("/attendance/fill-absences", { startDate, endDate }).then((r) => r.data),
};
