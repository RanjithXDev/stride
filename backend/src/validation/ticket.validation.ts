import { LinkType, TicketPriority, TicketStatus, TicketType, WorkType } from "@prisma/client";
import { ApiError } from "../lib/api-error";

type UnknownRecord = Record<string, unknown>;
const invalid = (message: string, field?: string, details?: unknown): never => { throw new ApiError(400, message, "VALIDATION_ERROR", { field, ...((details as object) ?? {}) }); };
function object(value: unknown): UnknownRecord { if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Request body must be an object"); return value as UnknownRecord; }
function text(value: unknown, field: string, options: { required?: boolean; max?: number } = {}) {
  if (value == null || value === "") { if (options.required) invalid(`${field} is required`, field); return undefined; }
  if (typeof value !== "string") invalid(`${field} must be a string`, field);
  const result = (value as string).trim();
  if (options.required && !result) invalid(`${field} is required`, field);
  if (options.max && result.length > options.max) invalid(`${field} must be at most ${options.max} characters`, field);
  return result;
}
function nullableText(value: unknown, field: string, max = 191): string | null | undefined { return value === null || value === "" ? null : text(value, field, { max }); }
function enumValue<T extends string>(value: unknown, field: string, values: readonly T[]): T | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || !values.includes(value as T)) invalid(`${field} is invalid`, field, { allowed: values });
  return value as T;
}
function integer(value: unknown, field: string, options: { min?: number; max?: number } = {}): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || (options.min != null && parsed < options.min) || (options.max != null && parsed > options.max)) invalid(`${field} is invalid`, field);
  return parsed;
}
function dateValue(value: unknown, field: string): Date | null | undefined {
  if (value === null || value === "") return null;
  if (value == null) return undefined;
  const result = new Date(String(value));
  if (Number.isNaN(result.getTime())) invalid(`${field} must be a valid date`, field);
  return result;
}

export function parseTicketCreate(body: unknown) {
  const value = object(body);
  return { title: text(value.title, "title", { required: true, max: 300 })!, description: nullableText(value.description, "description", 100_000), priority: enumValue(value.priority, "priority", Object.values(TicketPriority)), type: enumValue(value.type, "type", Object.values(TicketType)), projectId: nullableText(value.projectId, "projectId"), assigneeId: nullableText(value.assigneeId, "assigneeId"), parentId: nullableText(value.parentId, "parentId"), dueDate: dateValue(value.dueDate, "dueDate"), estimation: integer(value.estimation, "estimation", { min: 0, max: 100_000 }) };
}
export function parseTicketUpdate(body: unknown) {
  const value = object(body);
  const result = { title: value.title !== undefined ? text(value.title, "title", { required: true, max: 300 }) : undefined, description: value.description !== undefined ? nullableText(value.description, "description", 100_000) : undefined, priority: enumValue(value.priority, "priority", Object.values(TicketPriority)), type: enumValue(value.type, "type", Object.values(TicketType)), status: enumValue(value.status, "status", Object.values(TicketStatus)), assigneeId: value.assigneeId !== undefined ? nullableText(value.assigneeId, "assigneeId") : undefined, parentId: value.parentId !== undefined ? nullableText(value.parentId, "parentId") : undefined, dueDate: value.dueDate !== undefined ? dateValue(value.dueDate, "dueDate") : undefined, estimation: value.estimation !== undefined ? integer(value.estimation, "estimation", { min: 0, max: 100_000 }) ?? null : undefined, version: integer(value.version, "version", { min: 1 }) };
  if (result.version == null) invalid("version is required for updates", "version");
  return result;
}
export function parseBulkUpdate(body: unknown) {
  const value = object(body);
  if (!Array.isArray(value.ids) || value.ids.length === 0 || value.ids.length > 100 || value.ids.some((id) => typeof id !== "string")) invalid("ids must contain between 1 and 100 ticket IDs", "ids");
  const update = object(value.update);
  return { ids: [...new Set(value.ids as string[])], update: { status: enumValue(update.status, "status", Object.values(TicketStatus)), priority: enumValue(update.priority, "priority", Object.values(TicketPriority)), assigneeId: update.assigneeId !== undefined ? nullableText(update.assigneeId, "assigneeId") : undefined } };
}
export function parseComment(body: unknown) { return { content: text(object(body).content, "content", { required: true, max: 20_000 })! }; }
export function parseTimeLog(body: unknown) { const value = object(body); return { minutes: integer(value.minutes, "minutes", { min: 1, max: 1_440 })!, notes: nullableText(value.notes, "notes", 5_000), workType: enumValue(value.workType, "workType", Object.values(WorkType)) ?? WorkType.DEVELOPMENT }; }
export function parseLink(body: unknown) { const value = object(body); return { targetId: text(value.targetId, "targetId", { required: true, max: 191 })!, linkType: enumValue(value.linkType, "linkType", Object.values(LinkType)) ?? LinkType.RELATES_TO }; }
export function parsePagination(query: UnknownRecord) { return { page: integer(query.page ?? 1, "page", { min: 1, max: 1_000_000 }) ?? 1, pageSize: integer(query.pageSize ?? 25, "pageSize", { min: 1, max: 500 }) ?? 25 }; }
