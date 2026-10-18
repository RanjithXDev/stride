"use client";
import { Tag } from "antd";
import { TicketStatus, TicketPriority } from "@/types";

const statusConfig: Record<TicketStatus, { color: string; label: string }> = {
  OPEN:        { color: "default",  label: "Open" },
  IN_PROGRESS: { color: "processing", label: "In Progress" },
  IN_REVIEW:   { color: "warning",  label: "In Review" },
  CLOSED:      { color: "success",  label: "Closed" },
};

const priorityConfig: Record<TicketPriority, { color: string; label: string }> = {
  LOW:      { color: "default", label: "Low" },
  MEDIUM:   { color: "blue",    label: "Medium" },
  HIGH:     { color: "orange",  label: "High" },
  CRITICAL: { color: "red",     label: "Critical" },
};

export function StatusTag({ status }: { status: TicketStatus }) {
  const cfg = statusConfig[status];
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
}

export function PriorityTag({ priority }: { priority: TicketPriority }) {
  const cfg = priorityConfig[priority];
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
}
