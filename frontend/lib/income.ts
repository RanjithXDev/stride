import api from "./api";

export type IncomeStatus =
  | "PENDING"
  | "RECEIVED"
  | "CANCELLED";

export type IncomeCategory =
  | "CLIENT_PAYMENT"
  | "PROJECT_REVENUE"
  | "INVESTMENT"
  | "GRANT"
  | "SERVICE"
  | "PRODUCT_SALE"
  | "REFUND"
  | "OTHER";

export interface Income {
  id: string;
  title: string;
  amount: string;
  category: IncomeCategory;
  description?: string;
  status: IncomeStatus;
  proofUrl?: string;
  proofName?: string;
  proofType?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  recordedBy: {
    id: string;
    name: string;
    role: string;
    department?: { id: string; name: string };
  };
}

export const STATUS_LABELS: Record<IncomeStatus, { label: string; color: string }> = {
  PENDING:   { label: "Pending",   color: "warning" },
  RECEIVED:  { label: "Received",  color: "success" },
  CANCELLED: { label: "Cancelled", color: "error" },
};

export const CATEGORY_LABELS: Record<IncomeCategory, string> = {
  CLIENT_PAYMENT:  "Client Payment",
  PROJECT_REVENUE: "Project Revenue",
  INVESTMENT:      "Investment",
  GRANT:           "Grant",
  SERVICE:         "Service",
  PRODUCT_SALE:    "Product Sale",
  REFUND:          "Refund",
  OTHER:           "Other",
};

export const incomeApi = {
  list: (params?: Record<string, string>) =>
    api.get<Income[]>("/incomes", { params }).then((r) => r.data),
  get: (id: string) =>
    api.get<Income>(`/incomes/${id}`).then((r) => r.data),
  create: (data: FormData) =>
    api.post<Income>("/incomes", data, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data),
  update: (id: string, data: FormData) =>
    api.put<Income>(`/incomes/${id}`, data, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data),
  delete: (id: string) => api.delete(`/incomes/${id}`),
  summary: () =>
    api.get<{
      monthly: { total: number; count: number };
      yearly:  { total: number; count: number };
      byCategory: { category: string; _sum: { amount: string }; _count: number }[];
      byStatus:   { status: string;   _sum: { amount: string }; _count: number }[];
    }>("/incomes/summary").then((r) => r.data),
};
