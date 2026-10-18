import api from "./api";
import {
  Ticket, TicketDetail, CreateTicketPayload, UpdateTicketPayload,
  TicketStatus, TicketPriority, TicketType, LinkType,
} from "@/types";

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  type?: TicketType;
  projectId?: string;
  assigneeId?: string;
  reporterId?: string;
  parentId?: string;
  search?: string;
  myIssues?: boolean;
  sortBy?: "createdAt" | "updatedAt" | "dueDate" | "priority" | "ticketNumber" | "title";
  sortDir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface TicketListResponse {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TicketAuditEvent {
  id: string;
  action: string;
  source: "UI" | "API" | "SYSTEM" | "JOB" | "INTEGRATION" | "WEBHOOK";
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  reason: string | null;
  resourceVersion: number | null;
  reversible: boolean;
  reversibleUntil: string | null;
  reversalStatus: string;
  reversesEventId: string | null;
  reversedByEvent: { id: string; createdAt: string } | null;
  createdAt: string;
  actor: { id: string; name: string; avatar: string | null } | null;
}

export interface ReversalPreview {
  eventId: string;
  ticketId: string;
  currentVersion: number;
  allowed: boolean;
  code?: string;
  message?: string;
  changes: Array<{ field: string; current: unknown; restored: unknown }>;
}

export const ticketsApi = {
  list: (filters?: TicketFilters) =>
    api.get<TicketListResponse>("/tickets", { params: filters }).then((r) => r.data),

  bulkUpdate: (ids: string[], update: { status?: TicketStatus; priority?: TicketPriority; assigneeId?: string | null }) =>
    api.post("/tickets/bulk", { ids, update }).then((r) => r.data),

  get: (id: string) =>
    api.get<TicketDetail>(`/tickets/${id}`).then((r) => r.data),

  create: (payload: CreateTicketPayload) =>
    api.post<Ticket>("/tickets", payload).then((r) => r.data),

  update: (id: string, payload: UpdateTicketPayload) =>
    api.put<Ticket>(`/tickets/${id}`, payload).then((r) => r.data),

  delete: (id: string) => api.delete(`/tickets/${id}`),

  restore: (id: string) => api.post<Ticket>(`/tickets/${id}/restore`).then((r) => r.data),

  auditEvents: (id: string) =>
    api.get<TicketAuditEvent[]>(`/tickets/${id}/audit-events`).then((r) => r.data),

  reversalPreview: (eventId: string) =>
    api.get<ReversalPreview>(`/audit-events/${eventId}/reversal-preview`).then((r) => r.data),

  reverseAuditEvent: (eventId: string, expectedVersion: number, reason?: string) =>
    api.post<{ reversalEventId: string; ticketId: string; version: number }>(`/audit-events/${eventId}/reverse`, { expectedVersion, reason }).then((r) => r.data),

  addComment: (id: string, content: string) =>
    api.post(`/tickets/${id}/comments`, { content }).then((r) => r.data),

  updateComment: (ticketId: string, commentId: string, content: string) =>
    api.put(`/tickets/${ticketId}/comments/${commentId}`, { content }).then((r) => r.data),

  deleteComment: (ticketId: string, commentId: string) =>
    api.delete(`/tickets/${ticketId}/comments/${commentId}`),

  logTime: (ticketId: string, minutes: number, notes?: string, workType?: string) =>
    api.post(`/tickets/${ticketId}/time`, { minutes, notes, workType }).then((r) => r.data),

  addLink: (ticketId: string, targetId: string, linkType: LinkType) =>
    api.post(`/tickets/${ticketId}/links`, { targetId, linkType }).then((r) => r.data),

  removeLink: (linkId: string) =>
    api.delete(`/tickets/links/${linkId}`),
};
