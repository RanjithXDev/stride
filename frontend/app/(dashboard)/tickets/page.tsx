"use client";
import { useState, useMemo, useCallback, useDeferredValue } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Typography, Space, Avatar, Tooltip, Tag, Spin,
  Select, Input, Checkbox, Dropdown, Badge, message,
  Popover,
} from "antd";
import {
  PlusOutlined, SearchOutlined, SortAscendingOutlined,
  FilterOutlined,
  BugOutlined, ThunderboltOutlined, CheckSquareOutlined, RocketOutlined,
  WarningOutlined, CaretDownOutlined, CaretRightOutlined,
  UserOutlined, CloseOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { ticketsApi, TicketFilters, TicketListResponse } from "@/lib/tickets";
import { projectsApi } from "@/lib/projects";
import { employeesApi } from "@/lib/employees";
import { Ticket, TicketStatus, TicketPriority, TicketType } from "@/types";
import { StatusTag } from "@/components/tickets/TicketStatusBadge";
import CreateTicketModal from "@/components/tickets/CreateTicketModal";
import { useAuthStore } from "@/store/auth";
import { MetricGrid, MetricTile, PageEmpty, PageError, PageHeader } from "@/components/ui/AppPage";

const { Text } = Typography;
const { Option } = Select;

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<TicketType, React.ReactNode> = {
  BUG:         <BugOutlined style={{ color: "#f5222d" }} />,
  FEATURE:     <RocketOutlined style={{ color: "#722ed1" }} />,
  TASK:        <CheckSquareOutlined style={{ color: "#1677ff" }} />,
  IMPROVEMENT: <ThunderboltOutlined style={{ color: "#fa8c16" }} />,
};

const TYPE_COLORS: Record<TicketType, string> = {
  BUG: "#fff1f0", FEATURE: "#f9f0ff", TASK: "#e6f4ff", IMPROVEMENT: "#fff7e6",
};
const TYPE_BORDER: Record<TicketType, string> = {
  BUG: "#ffccc7", FEATURE: "#d3adf7", TASK: "#91caff", IMPROVEMENT: "#ffd591",
};

const PRIORITY_DOT: Record<TicketPriority, string> = {
  LOW: "#52c41a", MEDIUM: "#faad14", HIGH: "#fa8c16", CRITICAL: "#f5222d",
};

const STATUS_COLORS: Record<TicketStatus, { bg: string; color: string; label: string }> = {
  OPEN:        { bg: "#f5f5f5",  color: "#8c8c8c",  label: "Open" },
  IN_PROGRESS: { bg: "#e6f4ff", color: "#1677ff",   label: "In Progress" },
  IN_REVIEW:   { bg: "#fff7e6", color: "#fa8c16",   label: "In Review" },
  CLOSED:      { bg: "#f6ffed", color: "#52c41a",   label: "Closed" },
};

const GROUP_LABELS: Record<TicketStatus, string> = {
  OPEN: "Open", IN_PROGRESS: "In Progress", IN_REVIEW: "In Review", CLOSED: "Closed",
};

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  CRITICAL: "Critical", HIGH: "High", MEDIUM: "Medium", LOW: "Low",
};
const PRIORITY_ORDER: TicketPriority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

// ─── Ticket ID helper ─────────────────────────────────────────────────────────

function ticketId(t: Ticket): string {
  return t.key;
}

// ─── Single row ───────────────────────────────────────────────────────────────

function TicketRow({
  ticket, selected, onSelect, onStatusChange, canEdit,
}: {
  ticket: Ticket;
  selected: boolean;
  onSelect: (id: string, checked: boolean) => void;
  onStatusChange: (id: string, status: TicketStatus) => void;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const isOverdue = ticket.dueDate && dayjs(ticket.dueDate).isBefore(dayjs()) && ticket.status !== "CLOSED";

  const statusMenu = {
    items: (["OPEN", "IN_PROGRESS", "IN_REVIEW", "CLOSED"] as TicketStatus[]).map((s) => ({
      key: s,
      label: (
        <span style={{ color: STATUS_COLORS[s].color, fontWeight: 500 }}>
          {STATUS_COLORS[s].label}
        </span>
      ),
    })),
    onClick: ({ key }: { key: string }) => onStatusChange(ticket.id, key as TicketStatus),
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 0,
        padding: "0 16px",
        borderBottom: "1px solid #f0f0f0",
        background: selected ? "#f0f7ff" : hovered ? "#fafafa" : "#fff",
        transition: "background 0.1s",
        minHeight: 44,
        cursor: "pointer",
      }}
    >
      {/* Checkbox */}
      <div
        style={{ width: 32, flexShrink: 0, display: "flex", alignItems: "center" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onChange={(e) => onSelect(ticket.id, e.target.checked)}
          style={{ opacity: hovered || selected ? 1 : 0, transition: "opacity 0.15s" }}
        />
      </div>

      {/* Type icon */}
      <Tooltip title={ticket.type.charAt(0) + ticket.type.slice(1).toLowerCase()}>
        <div style={{
          width: 20, flexShrink: 0, fontSize: 13,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {TYPE_ICONS[ticket.type]}
        </div>
      </Tooltip>

      {/* Ticket ID */}
      <div style={{ width: 100, flexShrink: 0, paddingLeft: 8 }}>
        <Text style={{
          fontFamily: "monospace", fontSize: 11, color: "#1677ff",
          fontWeight: 600, letterSpacing: 0.2, whiteSpace: "nowrap",
        }}>
          {ticketId(ticket)}
        </Text>
      </div>

      {/* Title */}
      <div
        style={{ flex: 1, minWidth: 0, paddingRight: 12, display: "flex", alignItems: "center", gap: 6 }}
        onClick={() => router.push(`/tickets/${ticket.id}`)}
      >
        <Text
          ellipsis
          style={{
            fontSize: 13, fontWeight: 500, color: "var(--app-text)",
            textDecoration: ticket.status === "CLOSED" ? "line-through" : "none",
            opacity: ticket.status === "CLOSED" ? 0.55 : 1,
          }}
        >
          {ticket.title}
        </Text>
        {isOverdue && (
          <Tooltip title="Overdue">
            <WarningOutlined style={{ color: "#f5222d", fontSize: 12, flexShrink: 0 }} />
          </Tooltip>
        )}
      </div>

      {/* Project */}
      <div style={{ width: 120, flexShrink: 0, paddingRight: 8 }}>
        {ticket.project ? (
          <Text type="secondary" ellipsis style={{ fontSize: 12 }}>{ticket.project.name}</Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        )}
      </div>

      {/* Assignee */}
      <div style={{ width: 100, flexShrink: 0, paddingRight: 8 }}>
        {ticket.assignee ? (
          <Tooltip title={ticket.assignee.name}>
            <Space size={5}>
              <Avatar size={20} style={{ background: "#1677ff", fontSize: 10 }}>
                {ticket.assignee.name.charAt(0)}
              </Avatar>
              <Text style={{ fontSize: 12 }} ellipsis>{ticket.assignee.name.split(" ")[0]}</Text>
            </Space>
          </Tooltip>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>Unassigned</Text>
        )}
      </div>

      {/* Due date */}
      <div style={{ width: 70, flexShrink: 0, paddingRight: 8 }}>
        {ticket.dueDate ? (
          <Text style={{ fontSize: 12, color: isOverdue ? "#f5222d" : "#8c8c8c" }}>
            {dayjs(ticket.dueDate).format("MMM D")}
          </Text>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
        )}
      </div>

      {/* Priority dot */}
      <div style={{ width: 80, flexShrink: 0, paddingRight: 8 }}>
        <Space size={5}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: PRIORITY_DOT[ticket.priority], flexShrink: 0,
          }} />
          <Text style={{ fontSize: 12, color: "#595959" }}>
            {PRIORITY_LABELS[ticket.priority]}
          </Text>
        </Space>
      </div>

      {/* Status — clickable if canEdit */}
      <div style={{ width: 100, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        {canEdit ? (
          <Dropdown menu={statusMenu} trigger={["click"]}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "2px 8px", borderRadius: 4, cursor: "pointer",
              background: STATUS_COLORS[ticket.status].bg,
              color: STATUS_COLORS[ticket.status].color,
              fontSize: 12, fontWeight: 500, userSelect: "none",
            }}>
              {STATUS_COLORS[ticket.status].label}
              <CaretDownOutlined style={{ fontSize: 9 }} />
            </div>
          </Dropdown>
        ) : (
          <StatusTag status={ticket.status} />
        )}
      </div>
    </div>
  );
}

// ─── Group section ─────────────────────────────────────────────────────────────

function GroupSection({
  label, count, color, children, defaultOpen = true,
}: {
  label: string; count: number; color: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 2 }}>
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 16px", background: "var(--app-subtle)",
          borderBottom: "1px solid #f0f0f0",
          cursor: "pointer", userSelect: "none",
        }}
      >
        {open
          ? <CaretDownOutlined style={{ fontSize: 11, color: "#8c8c8c" }} />
          : <CaretRightOutlined style={{ fontSize: 11, color: "#8c8c8c" }} />
        }
        <Text strong style={{ fontSize: 12, color }}>{label}</Text>
        <Badge count={count} color={color} size="small" />
      </div>
      {open && children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TicketsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const canEdit = user?.role !== "EMPLOYEE";

  const [filters, setFilters] = useState<TicketFilters>({ page: 1, pageSize: 50 });
  const [groupBy, setGroupBy] = useState<"status" | "priority" | "project" | "none">("status");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const deferredFilters = useDeferredValue(filters);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["tickets", deferredFilters],
    queryFn: () => ticketsApi.list(deferredFilters),
    placeholderData: (prev) => prev,
  });

  const tickets = useMemo(() => (data as TicketListResponse)?.items ?? [], [data]);
  const total   = (data as TicketListResponse)?.total ?? 0;

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesApi.list({ isActive: true }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) => {
      const ticket = tickets.find((item) => item.id === id);
      if (!ticket) throw new Error("Ticket not found");
      return ticketsApi.update(id, { status, version: ticket.version });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tickets"] }),
    onError: () => message.error("Failed to update ticket"),
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: { ids: string[]; update: Parameters<typeof ticketsApi.bulkUpdate>[1] }) =>
      ticketsApi.bulkUpdate(payload.ids, payload.update),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      setSelected(new Set());
      message.success("Tickets updated");
    },
    onError: () => message.error("Bulk update failed"),
  });

  const handleSort = useCallback((col: NonNullable<TicketFilters["sortBy"]>) => {
    setFilters((f) => ({
      ...f,
      sortBy: col,
      sortDir: f.sortBy === col && f.sortDir === "desc" ? "asc" : "desc",
      page: 1,
    }));
  }, []);

  const handleSelect = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(tickets.map((t) => t.id)) : new Set());
  };

  // Group tickets
  const grouped = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "All", color: "#1677ff", items: tickets }];
    if (groupBy === "status") {
      return (["OPEN", "IN_PROGRESS", "IN_REVIEW", "CLOSED"] as TicketStatus[]).map((s) => ({
        key: s,
        label: GROUP_LABELS[s],
        color: STATUS_COLORS[s].color,
        items: tickets.filter((t) => t.status === s),
      })).filter((g) => g.items.length > 0);
    }
    if (groupBy === "priority") {
      return PRIORITY_ORDER.map((p) => ({
        key: p,
        label: PRIORITY_LABELS[p],
        color: PRIORITY_DOT[p],
        items: tickets.filter((t) => t.priority === p),
      })).filter((g) => g.items.length > 0);
    }
    // project grouping
    const byProject: Record<string, Ticket[]> = {};
    tickets.forEach((t) => {
      const key = t.project?.id ?? "__none__";
      if (!byProject[key]) byProject[key] = [];
      byProject[key].push(t);
    });
    return Object.entries(byProject).map(([key, items]) => ({
      key,
      label: items[0]?.project?.name ?? "No Project",
      color: "#1677ff",
      items,
    }));
  }, [tickets, groupBy]);

  const allSelected = tickets.length > 0 && selected.size === tickets.length;
  const someSelected = selected.size > 0 && selected.size < tickets.length;

  const activeFilterCount = [
    filters.status, filters.priority, filters.type,
    filters.projectId, filters.assigneeId, filters.reporterId,
    filters.myIssues,
  ].filter(Boolean).length;
  const overdue = tickets.filter((ticket) => ticket.dueDate && dayjs(ticket.dueDate).isBefore(dayjs(), "day") && ticket.status !== "CLOSED").length;
  const critical = tickets.filter((ticket) => ticket.priority === "CRITICAL" && ticket.status !== "CLOSED").length;
  const inProgress = tickets.filter((ticket) => ticket.status === "IN_PROGRESS").length;

  const bulkMenu = {
    items: [
      {
        key: "status", label: "Change Status", children: (["OPEN","IN_PROGRESS","IN_REVIEW","CLOSED"] as TicketStatus[]).map((s) => ({
          key: `status:${s}`,
          label: <span style={{ color: STATUS_COLORS[s].color }}>{STATUS_COLORS[s].label}</span>,
        })),
      },
      {
        key: "priority", label: "Change Priority", children: PRIORITY_ORDER.map((p) => ({
          key: `priority:${p}`,
          label: <Space size={5}><div style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_DOT[p] }} />{PRIORITY_LABELS[p]}</Space>,
        })),
      },
      { type: "divider" as const },
      { key: "unassign", label: <Text type="danger">Unassign</Text> },
    ],
    onClick: ({ key }: { key: string }) => {
      const ids = Array.from(selected);
      if (key.startsWith("status:")) bulkMutation.mutate({ ids, update: { status: key.replace("status:", "") as TicketStatus } });
      else if (key.startsWith("priority:")) bulkMutation.mutate({ ids, update: { priority: key.replace("priority:", "") as TicketPriority } });
      else if (key === "unassign") bulkMutation.mutate({ ids, update: { assigneeId: null } });
    },
  };

  const filterContent = (
    <div style={{ width: 320, padding: 4 }}>
      <div style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: 600, color: "#8c8c8c", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 6 }}>Status</Text>
        <Select mode="multiple" placeholder="Any status" style={{ width: "100%" }} value={filters.status ? [filters.status] : []}
          onChange={(v) => setFilters((f) => ({ ...f, status: v[v.length - 1] as TicketStatus, page: 1 }))} allowClear>
          {(["OPEN","IN_PROGRESS","IN_REVIEW","CLOSED"] as TicketStatus[]).map((s) => (
            <Option key={s} value={s}><span style={{ color: STATUS_COLORS[s].color }}>{STATUS_COLORS[s].label}</span></Option>
          ))}
        </Select>
      </div>
      <div style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: 600, color: "#8c8c8c", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 6 }}>Priority</Text>
        <Select placeholder="Any priority" style={{ width: "100%" }} value={filters.priority} allowClear
          onChange={(v) => setFilters((f) => ({ ...f, priority: v, page: 1 }))}>
          {PRIORITY_ORDER.map((p) => (
            <Option key={p} value={p}><Space size={5}><div style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_DOT[p] }} />{PRIORITY_LABELS[p]}</Space></Option>
          ))}
        </Select>
      </div>
      <div style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: 600, color: "#8c8c8c", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 6 }}>Type</Text>
        <Select placeholder="Any type" style={{ width: "100%" }} value={filters.type} allowClear
          onChange={(v) => setFilters((f) => ({ ...f, type: v, page: 1 }))}>
          <Option value="BUG"><Space size={5}><BugOutlined style={{ color: "#f5222d" }} />Bug</Space></Option>
          <Option value="FEATURE"><Space size={5}><RocketOutlined style={{ color: "#722ed1" }} />Feature</Space></Option>
          <Option value="TASK"><Space size={5}><CheckSquareOutlined style={{ color: "#1677ff" }} />Task</Space></Option>
          <Option value="IMPROVEMENT"><Space size={5}><ThunderboltOutlined style={{ color: "#fa8c16" }} />Improvement</Space></Option>
        </Select>
      </div>
      <div style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: 600, color: "#8c8c8c", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 6 }}>Project</Text>
        <Select placeholder="Any project" style={{ width: "100%" }} value={filters.projectId} allowClear
          onChange={(v) => setFilters((f) => ({ ...f, projectId: v, page: 1 }))}>
          {projects.map((p) => <Option key={p.id} value={p.id}>{p.name}</Option>)}
        </Select>
      </div>
      <div style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 11, fontWeight: 600, color: "#8c8c8c", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 6 }}>Assignee</Text>
        <Select placeholder="Anyone" style={{ width: "100%" }} value={filters.assigneeId} allowClear
          onChange={(v) => setFilters((f) => ({ ...f, assigneeId: v, page: 1 }))}>
          {employees.map((e) => (
            <Option key={e.id} value={e.id}>
              <Space size={6}><Avatar size={18} style={{ background: "#1677ff", fontSize: 10 }}>{e.name.charAt(0)}</Avatar>{e.name}</Space>
            </Option>
          ))}
        </Select>
      </div>
      <div style={{ marginBottom: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: 600, color: "#8c8c8c", textTransform: "uppercase", letterSpacing: 0.4, display: "block", marginBottom: 6 }}>Reporter</Text>
        <Select placeholder="Anyone" style={{ width: "100%" }} value={filters.reporterId} allowClear
          onChange={(v) => setFilters((f) => ({ ...f, reporterId: v, page: 1 }))}>
          {employees.map((e) => (
            <Option key={e.id} value={e.id}>
              <Space size={6}><Avatar size={18} style={{ background: "#52c41a", fontSize: 10 }}>{e.name.charAt(0)}</Avatar>{e.name}</Space>
            </Option>
          ))}
        </Select>
      </div>
      {activeFilterCount > 0 && (
        <Button size="small" type="link" icon={<CloseOutlined />} style={{ paddingLeft: 0, marginTop: 8 }}
          onClick={() => setFilters({ page: 1, pageSize: filters.pageSize })}>
          Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <PageHeader eyebrow="Delivery workspace" title="Tickets" description="Prioritize, assign, and move work through delivery with a clear view of risk." action={canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New Ticket</Button> : undefined} />
      <MetricGrid>
        <MetricTile label="Total" value={total} color="#1677ff" hint="Matching this view" />
        <MetricTile label="In progress" value={inProgress} color="#2563eb" hint="Currently being worked" />
        <MetricTile label="Overdue" value={overdue} color="#dc2626" hint="Past their due date" />
        <MetricTile label="Critical" value={critical} color="#ea580c" hint="Open critical priority" />
      </MetricGrid>

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
        flexWrap: "wrap",
      }}>
        {/* Search */}
        <Input
          placeholder="Search tickets..."
          prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined, page: 1 }))}
          style={{ width: 240 }}
          allowClear
        />

        {/* My Issues quick toggle */}
        <Button
          type={filters.myIssues ? "primary" : "default"}
          icon={<UserOutlined />}
          size="middle"
          onClick={() => setFilters((f) => ({ ...f, myIssues: !f.myIssues, page: 1 }))}
        >
          My Issues
        </Button>

        {/* Filters popover */}
        <Popover
          content={filterContent}
          title="Filters"
          trigger="click"
          open={filterOpen}
          onOpenChange={setFilterOpen}
          placement="bottomLeft"
        >
          <Badge count={activeFilterCount} size="small">
            <Button icon={<FilterOutlined />}>
              Filter
            </Button>
          </Badge>
        </Popover>

        {/* Active filter chips */}
        {filters.status && (
          <Tag closable onClose={() => setFilters((f) => ({ ...f, status: undefined }))}
            color={STATUS_COLORS[filters.status].color} style={{ margin: 0 }}>
            {STATUS_COLORS[filters.status].label}
          </Tag>
        )}
        {filters.priority && (
          <Tag closable onClose={() => setFilters((f) => ({ ...f, priority: undefined }))}
            style={{ margin: 0, color: PRIORITY_DOT[filters.priority], borderColor: PRIORITY_DOT[filters.priority], background: "var(--app-surface)" }}>
            {PRIORITY_LABELS[filters.priority]}
          </Tag>
        )}
        {filters.type && (
          <Tag closable onClose={() => setFilters((f) => ({ ...f, type: undefined }))}
            style={{ margin: 0, background: TYPE_COLORS[filters.type as TicketType], borderColor: TYPE_BORDER[filters.type as TicketType] }}>
            {filters.type.charAt(0) + filters.type.slice(1).toLowerCase()}
          </Tag>
        )}

        <div style={{ flex: 1 }} />

        {/* Group by */}
        <Space size={6}>
          <Text style={{ fontSize: 12, color: "#8c8c8c" }}>Group:</Text>
          <Select value={groupBy} onChange={setGroupBy} size="small" style={{ width: 110 }}>
            <Option value="status">Status</Option>
            <Option value="priority">Priority</Option>
            <Option value="project">Project</Option>
            <Option value="none">None</Option>
          </Select>
        </Space>

        {/* Sort */}
        <Space size={6}>
          <SortAscendingOutlined style={{ color: "#8c8c8c" }} />
          <Select
            value={`${filters.sortBy ?? "createdAt"}:${filters.sortDir ?? "desc"}`}
            onChange={(v) => {
              const [sb, sd] = v.split(":");
              setFilters((f) => ({ ...f, sortBy: sb as TicketFilters["sortBy"], sortDir: sd as TicketFilters["sortDir"], page: 1 }));
            }}
            size="small" style={{ width: 160 }}
          >
            <Option value="createdAt:desc">Newest first</Option>
            <Option value="createdAt:asc">Oldest first</Option>
            <Option value="updatedAt:desc">Recently updated</Option>
            <Option value="priority:desc">Priority: High→Low</Option>
            <Option value="priority:asc">Priority: Low→High</Option>
            <Option value="dueDate:asc">Due date: Soonest</Option>
            <Option value="ticketNumber:asc">ID: Ascending</Option>
            <Option value="ticketNumber:desc">ID: Descending</Option>
            <Option value="title:asc">Title: A→Z</Option>
          </Select>
        </Space>

        {/* Page size */}
        <Select
          value={filters.pageSize}
          onChange={(v) => setFilters((f) => ({ ...f, pageSize: v, page: 1 }))}
          size="small" style={{ width: 80 }}
        >
          <Option value={25}>25</Option>
          <Option value={50}>50</Option>
          <Option value={100}>100</Option>
        </Select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "8px 16px", marginBottom: 8,
          background: "#e6f4ff", borderRadius: 6,
          border: "1px solid #91caff",
        }}>
          <Text strong style={{ fontSize: 13, color: "#1677ff" }}>
            {selected.size} ticket{selected.size > 1 ? "s" : ""} selected
          </Text>
          <Dropdown menu={bulkMenu} trigger={["click"]}>
            <Button size="small" type="primary">Actions <CaretDownOutlined /></Button>
          </Dropdown>
          <Button size="small" onClick={() => setSelected(new Set())}>Deselect all</Button>
        </div>
      )}

      {/* List */}
      <div style={{
        flex: 1, border: "1px solid #f0f0f0", borderRadius: 8,
        overflow: "hidden", background: "var(--app-surface)",
        display: "flex", flexDirection: "column",
      }}>
        {/* Column header */}
        <div style={{ display: "flex", alignItems: "center", padding: "8px 16px", borderBottom: "2px solid var(--shell-border)", background: "var(--app-subtle)", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ width: 32, flexShrink: 0 }}>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={(e) => handleSelectAll(e.target.checked)}
            />
          </div>
          <div style={{ width: 20, flexShrink: 0 }} />
          {[
            { label: "ID", key: "ticketNumber", width: 80 },
          ].map(({ label, key, width }) => (
            <div key={key} style={{ width, flexShrink: 0, cursor: "pointer" }} onClick={() => handleSort(key as NonNullable<TicketFilters["sortBy"]>)}>
              <Text style={{ fontSize: 11, fontWeight: 600, color: filters.sortBy === key ? "#1677ff" : "#8c8c8c", textTransform: "uppercase", letterSpacing: 0.4 }}>
                {label} {filters.sortBy === key ? (filters.sortDir === "asc" ? "↑" : "↓") : ""}
              </Text>
            </div>
          ))}
          <div style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: 600, color: "#8c8c8c", textTransform: "uppercase", letterSpacing: 0.4 }}>Title</Text>
          </div>
          <div style={{ width: 120, flexShrink: 0, cursor: "pointer" }} onClick={() => handleSort("title")}>
            <Text style={{ fontSize: 11, fontWeight: 600, color: "#8c8c8c", textTransform: "uppercase", letterSpacing: 0.4 }}>Project</Text>
          </div>
          <div style={{ width: 100, flexShrink: 0 }}>
            <Text style={{ fontSize: 11, fontWeight: 600, color: "#8c8c8c", textTransform: "uppercase", letterSpacing: 0.4 }}>Assignee</Text>
          </div>
          {[
            { label: "Due", key: "dueDate", width: 70 },
            { label: "Priority", key: "priority", width: 80 },
            { label: "Status", key: "createdAt", width: 100 },
          ].map(({ label, key, width }) => (
            <div key={key} style={{ width, flexShrink: 0, cursor: "pointer" }} onClick={() => handleSort(key as NonNullable<TicketFilters["sortBy"]>)}>
              <Text style={{ fontSize: 11, fontWeight: 600, color: filters.sortBy === key ? "#1677ff" : "#8c8c8c", textTransform: "uppercase", letterSpacing: 0.4 }}>
                {label} {filters.sortBy === key ? (filters.sortDir === "asc" ? "↑" : "↓") : ""}
              </Text>
            </div>
          ))}
        </div>

        {/* Rows */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {isError ? (
            <PageError onRetry={() => refetch()} />
          ) : isLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
              <Spin />
            </div>
          ) : tickets.length === 0 ? (
            <PageEmpty title="No tickets match this view" description="Try changing your search or filters, or create a new ticket to start planning work." />
          ) : groupBy === "none" ? (
            tickets.map((t) => (
              <TicketRow key={t.id} ticket={t}
                selected={selected.has(t.id)}
                onSelect={handleSelect}
                onStatusChange={(id, status) => updateMutation.mutate({ id, status })}
                canEdit={canEdit}
              />
            ))
          ) : (
            grouped.map((group) => (
              <GroupSection key={group.key} label={group.label} count={group.items.length} color={group.color}>
                {group.items.map((t) => (
                  <TicketRow key={t.id} ticket={t}
                    selected={selected.has(t.id)}
                    onSelect={handleSelect}
                    onStatusChange={(id, status) => updateMutation.mutate({ id, status })}
                    canEdit={canEdit}
                  />
                ))}
              </GroupSection>
            ))
          )}
        </div>

        {/* Pagination footer */}
        {total > 0 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 16px", borderTop: "1px solid var(--shell-border)", background: "var(--app-subtle)",
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Showing {((filters.page ?? 1) - 1) * (filters.pageSize ?? 50) + 1}–{Math.min((filters.page ?? 1) * (filters.pageSize ?? 50), total)} of {total} tickets
            </Text>
            <Space size={8}>
              <Button
                size="small"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              >
                ← Prev
              </Button>
              <Text style={{ fontSize: 12 }}>Page {filters.page ?? 1}</Text>
              <Button
                size="small"
                disabled={(filters.page ?? 1) * (filters.pageSize ?? 50) >= total}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              >
                Next →
              </Button>
            </Space>
          </div>
        )}
      </div>

      <CreateTicketModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          queryClient.invalidateQueries({ queryKey: ["tickets"] });
        }}
      />
    </div>
  );
}
