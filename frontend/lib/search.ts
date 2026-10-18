import api from "./api";
import { ProjectStatus, Role, TicketPriority, TicketStatus } from "@/types";

export interface SearchResponse {
  projects: Array<{ id: string; name: string; key?: string | null; status: ProjectStatus }>;
  tickets: Array<{ id: string; key: string; title: string; status: TicketStatus; priority: TicketPriority; project?: { name: string } | null }>;
  employees: Array<{ id: string; name: string; role: Role; jobTitle?: string | null; department?: { name: string } | null }>;
}

export const searchApi = {
  search: (query: string) => api.get<SearchResponse>("/search", { params: { q: query, limit: 6 } }).then((response) => response.data),
};
