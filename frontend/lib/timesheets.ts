import api from "./api";
import { TimesheetEntry, WorkType } from "@/types";

export interface TimesheetFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  projectId?: string;
  workType?: WorkType;
}

export const timesheetsApi = {
  list: (filters?: TimesheetFilters) =>
    api.get<TimesheetEntry[]>("/timesheets", { params: filters }).then((r) => r.data),

  summary: (filters?: Omit<TimesheetFilters, "userId" | "workType">) =>
    api.get<{
      totalMinutes: number;
      byWorkType: Array<{ workType: WorkType; minutes: number }>;
      byUser: Array<{ userId: string; name: string; minutes: number }>;
    }>("/timesheets/summary", { params: filters }).then((r) => r.data),
};
