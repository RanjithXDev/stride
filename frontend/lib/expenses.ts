import api from "./api";

export type ExpenseStatus = "DRAFT" | "SUBMITTED" | "L1_APPROVED" | "APPROVED" | "REJECTED" | "PAID";
export type ExpenseCategory = "TRAVEL" | "MEALS" | "EQUIPMENT" | "SOFTWARE" | "TRAINING" | "OFFICE" | "OTHER";

export interface ExpenseApproval {
  id: string;
  level: number;
  decision: string;
  note?: string | null;
  decidedAt: string;
  approver: { id: string; name: string; role: string };
}

export interface Expense {
  id: string;
  title: string;
  amount: string;
  category: ExpenseCategory;
  description?: string | null;
  status: ExpenseStatus;
  proofUrl?: string | null;
  proofName?: string | null;
  proofType?: string | null;
  createdAt: string;
  updatedAt: string;
  submittedBy: {
    id: string; name: string; role: string;
    department?: { id: string; name: string } | null;
    manager?: { id: string; name: string; role: string } | null;
  };
  approvals: ExpenseApproval[];
}

export const expensesApi = {
  list: (params?: Record<string, any>) =>
    api.get<Expense[]>("/expenses", { params }).then((r) => r.data),

  get: (id: string) =>
    api.get<Expense>(`/expenses/${id}`).then((r) => r.data),

  create: (formData: FormData) =>
    api.post<Expense>("/expenses", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data),

  update: (id: string, formData: FormData) =>
    api.put<Expense>(`/expenses/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then((r) => r.data),

  approve: (id: string, decision: "APPROVED" | "REJECTED", note?: string) =>
    api.post<Expense>(`/expenses/${id}/approve`, { decision, note }).then((r) => r.data),

  markAsPaid: (id: string) =>
    api.post<Expense>(`/expenses/${id}/pay`).then((r) => r.data),

  revokePayment: (id: string) =>
    api.post<Expense>(`/expenses/${id}/revoke-payment`).then((r) => r.data),

  revokeApproval: (id: string) =>
    api.post<Expense>(`/expenses/${id}/revoke-approval`).then((r) => r.data),

  revokeL1Approval: (id: string) =>
    api.post<Expense>(`/expenses/${id}/revoke-l1-approval`).then((r) => r.data),

  pending: () =>
    api.get<Expense[]>("/expenses/pending").then((r) => r.data),

  financial: () =>
    api.get<any>("/expenses/financial").then((r) => r.data),
};

export const STATUS_LABELS: Record<ExpenseStatus, { label: string; color: string }> = {
  DRAFT:       { label: "Draft",       color: "default" },
  SUBMITTED:   { label: "Submitted",   color: "processing" },
  L1_APPROVED: { label: "L1 Approved", color: "warning" },
  APPROVED:    { label: "Approved",    color: "cyan" },
  REJECTED:    { label: "Rejected",    color: "error" },
  PAID:        { label: "Paid",        color: "success" },
};

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  TRAVEL: "Travel", MEALS: "Meals", EQUIPMENT: "Equipment",
  SOFTWARE: "Software", TRAINING: "Training", OFFICE: "Office", OTHER: "Other",
};
