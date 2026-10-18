"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Space, Button, Avatar, Tag, Spin, Select,
  Tooltip, Badge, message,
} from "antd";
import { PlusOutlined, WarningOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { ticketsApi } from "@/lib/tickets";
import { projectsApi } from "@/lib/projects";
import { employeesApi } from "@/lib/employees";
import { Ticket, TicketStatus, TicketPriority, TicketType } from "@/types";
import { PriorityTag } from "@/components/tickets/TicketStatusBadge";
import CreateTicketModal from "@/components/tickets/CreateTicketModal";
import { useAuthStore } from "@/store/auth";

const { Title, Text } = Typography;

const COLUMNS: { key: TicketStatus; label: string; color: string; bg: string; dotColor: string }[] = [
  { key: "OPEN",        label: "Open",        color: "#595959", bg: "#fafafa",  dotColor: "#8c8c8c" },
  { key: "IN_PROGRESS", label: "In Progress", color: "#0958d9", bg: "#e6f4ff",  dotColor: "#1677ff" },
  { key: "IN_REVIEW",   label: "In Review",   color: "#d46b08", bg: "#fff7e6",  dotColor: "#fa8c16" },
  { key: "CLOSED",      label: "Closed",      color: "#389e0d", bg: "#f6ffed",  dotColor: "#52c41a" },
];

const TYPE_COLORS: Record<TicketType, string> = {
  BUG: "#f5222d", FEATURE: "#722ed1", TASK: "#1677ff", IMPROVEMENT: "#fa8c16",
};

const TYPE_LABELS: Record<TicketType, string> = {
  BUG: "Bug", FEATURE: "Feature", TASK: "Task", IMPROVEMENT: "Improvement",
};

const PRIORITY_BORDER: Record<TicketPriority, string> = {
  LOW: "#52c41a", MEDIUM: "#faad14", HIGH: "#fa8c16", CRITICAL: "#f5222d",
};

function TicketCard({
  ticket,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  ticket: Ticket;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onClick: () => void;
}) {
  const isOverdue = ticket.dueDate && dayjs(ticket.dueDate).isBefore(dayjs()) && ticket.status !== "CLOSED";

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(ticket.id); }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{
        background: "var(--app-surface)",
        border: "1px solid #f0f0f0",
        borderLeft: `3px solid ${PRIORITY_BORDER[ticket.priority]}`,
        borderRadius: 6,
        padding: "10px 12px",
        marginBottom: 8,
        cursor: "grab",
        userSelect: "none",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        transition: "box-shadow 0.15s, transform 0.1s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 3px 10px rgba(0,0,0,0.12)";
        el.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
        el.style.transform = "translateY(0)";
      }}
    >
      {/* Type tag + priority row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Tag
            style={{
              fontSize: 10, padding: "0 5px", margin: 0, fontWeight: 600,
              color: TYPE_COLORS[ticket.type],
              background: `${TYPE_COLORS[ticket.type]}15`,
              border: `1px solid ${TYPE_COLORS[ticket.type]}40`,
            }}
          >
            {TYPE_LABELS[ticket.type]}
          </Tag>
          <Text style={{ fontSize: 10, color: "#8c8c8c", fontFamily: "monospace" }}>
            {ticket.key}
          </Text>
        </div>
        <PriorityTag priority={ticket.priority} />
      </div>

      {/* Title */}
      <Text style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4, display: "block", marginBottom: 8 }}>
        {ticket.title}
      </Text>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {ticket.dueDate ? (
          <Space size={3}>
            {isOverdue && <WarningOutlined style={{ fontSize: 11, color: "#f5222d" }} />}
            <Text style={{ fontSize: 11, color: isOverdue ? "#f5222d" : "#8c8c8c" }}>
              {dayjs(ticket.dueDate).format("D MMM")}
            </Text>
          </Space>
        ) : <span />}

        {ticket.assignee ? (
          <Tooltip title={ticket.assignee.name}>
            <Avatar size={22} style={{ background: "#1677ff", fontSize: 10, cursor: "pointer", flexShrink: 0 }}>
              {ticket.assignee.name.charAt(0)}
            </Avatar>
          </Tooltip>
        ) : (
          <Tooltip title="Unassigned">
            <Avatar size={22} style={{ background: "var(--app-subtle)", color: "var(--app-muted)", fontSize: 10, flexShrink: 0 }}>—</Avatar>
          </Tooltip>
        )}
      </div>

      {/* Project tag (shown on global board) */}
      {ticket.project && (
        <div style={{ marginTop: 6 }}>
          <Tag style={{ fontSize: 10, padding: "0 4px" }}>{ticket.project.name}</Tag>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  col,
  tickets,
  onDragStart,
  onDragEnd,
  onDrop,
  onTicketClick,
  isDragOver,
  setDragOver,
  onAdd,
  canAdd,
}: {
  col: typeof COLUMNS[number];
  tickets: Ticket[];
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDrop: (status: TicketStatus) => void;
  onTicketClick: (id: string) => void;
  isDragOver: boolean;
  setDragOver: (v: boolean) => void;
  onAdd?: () => void;
  canAdd: boolean;
}) {
  const totalTickets = tickets.length;

  return (
    <div style={{ flex: "1 1 0", minWidth: 240, maxWidth: 320, display: "flex", flexDirection: "column" }}>
      {/* Column header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 14px 10px 12px",
        marginBottom: 10,
        borderRadius: 8,
        background: col.bg,
        border: `1px solid ${col.dotColor}25`,
      }}>
        <Space size={8}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: col.dotColor, flexShrink: 0,
          }} />
          <Text strong style={{ fontSize: 13, color: col.color }}>{col.label}</Text>
          <Badge
            count={totalTickets}
            style={{ background: col.dotColor, fontSize: 10, height: 18, lineHeight: "18px", minWidth: 18 }}
          />
        </Space>
        {canAdd && col.key === "OPEN" && (
          <Button
            type="text" size="small" icon={<PlusOutlined />}
            style={{ color: col.color, padding: "0 4px" }}
            onClick={onAdd}
          />
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(col.key); }}
        style={{
          flex: 1,
          minHeight: 200,
          padding: 4,
          borderRadius: 8,
          border: isDragOver ? `2px dashed ${col.dotColor}` : "2px dashed transparent",
          background: isDragOver ? `${col.dotColor}0d` : "transparent",
          transition: "all 0.15s",
        }}
      >
        {tickets.length === 0 && !isDragOver && (
          <div style={{
            height: 80, display: "flex", alignItems: "center", justifyContent: "center",
            color: "#d9d9d9", fontSize: 12, borderRadius: 6,
            border: "1px dashed #e8e8e8",
          }}>
            No tickets
          </div>
        )}
        {tickets.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={() => onTicketClick(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default function BoardPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [selectedProject, setSelectedProject] = useState<string | undefined>();
  const [filterAssignee, setFilterAssignee]   = useState<string | undefined>();
  const [filterType, setFilterType]           = useState<TicketType | undefined>();
  const [filterPriority, setFilterPriority]   = useState<string | undefined>();
  const [createOpen, setCreateOpen]           = useState(false);
  const [dragOverCol, setDragOverCol]         = useState<TicketStatus | null>(null);
  const dragTicketId  = useRef<string | null>(null);
  const ticketsRef    = useRef<Ticket[]>([]);

  const canManage = ["FOUNDER","CPO","CFO","HR","MANAGER","TEAM_LEAD"].includes(user?.role ?? "");

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => projectsApi.list(),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesApi.list({ isActive: true }),
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["board-tickets", selectedProject],
    queryFn: () => ticketsApi.list(selectedProject ? { projectId: selectedProject } : { pageSize: 200 }),
    select: (res) => res.items,
    refetchOnWindowFocus: true,
  });

  const updateMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      const ticket = tickets.find((item) => item.id === ticketId);
      if (!ticket) throw new Error("Ticket not found");
      return ticketsApi.update(ticketId, { status, version: ticket.version });
    },
    onMutate: async ({ ticketId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["board-tickets", selectedProject] });
      const prev = queryClient.getQueryData(["board-tickets", selectedProject]);
      queryClient.setQueryData<any>(
        ["board-tickets", selectedProject],
        (old: any) => old ? { ...old, items: old.items?.map((t: Ticket) => t.id === ticketId ? { ...t, status } : t) } : old,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(["board-tickets", selectedProject], ctx?.prev);
      message.error("Failed to move ticket");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["board-tickets", selectedProject] });
    },
  });

  // Keep ref current so handleDrop always sees the latest tickets list
  ticketsRef.current = tickets;

  // Apply filters
  const filtered = tickets.filter((t) => {
    if (filterAssignee && t.assignee?.id !== filterAssignee) return false;
    if (filterType     && t.type !== filterType)             return false;
    if (filterPriority && t.priority !== filterPriority)     return false;
    return true;
  });

  const byStatus = Object.fromEntries(
    COLUMNS.map((c) => [c.key, filtered.filter((t) => t.status === c.key)])
  ) as Record<TicketStatus, Ticket[]>;

  function handleDragStart(ticketId: string) {
    dragTicketId.current = ticketId;
  }

  function handleDragEnd() {
    dragTicketId.current = null;
    setDragOverCol(null);
  }

  function handleDrop(status: TicketStatus) {
    const ticketId = dragTicketId.current;
    if (!ticketId) return;
    dragTicketId.current = null;
    // Use ref so we're never operating on a stale closure
    const ticket = ticketsRef.current.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === status) return;
    updateMutation.mutate({ ticketId, status });
  }

  const hasFilters = !!(filterAssignee || filterType || filterPriority);

  return (
    <div className="workspace-viewport" style={{ display: "flex", flexDirection: "column", minHeight: 500 }}>
      {/* ── Header ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Space size={8} align="center">
            <Title level={4} style={{ margin: 0 }}>Board</Title>
            {selectedProject && (
              <Tag color="blue" style={{ fontSize: 12 }}>
                {projects.find((p: any) => p.id === selectedProject)?.name}
              </Tag>
            )}
            {!ticketsLoading && (
              <Text type="secondary" style={{ fontSize: 12 }}>{filtered.length} tickets</Text>
            )}
          </Space>

          <Space wrap size={8}>
            {/* Project picker */}
            <Select
              placeholder="All projects"
              allowClear
              value={selectedProject}
              onChange={setSelectedProject}
              showSearch
              optionFilterProp="children"
              style={{ width: 180 }}
              loading={projectsLoading}
            >
              {(projects as any[]).map((p) => (
                <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>
              ))}
            </Select>

            {/* Assignee filter */}
            <Select
              placeholder="Assignee"
              allowClear
              value={filterAssignee}
              onChange={setFilterAssignee}
              showSearch
              optionFilterProp="children"
              style={{ width: 140 }}
            >
              {(employees as any[]).map((e) => (
                <Select.Option key={e.id} value={e.id}>
                  <Space size={4}>
                    <Avatar size={16} style={{ background: "#1677ff", fontSize: 9 }}>{e.name.charAt(0)}</Avatar>
                    {e.name.split(" ")[0]}
                  </Space>
                </Select.Option>
              ))}
            </Select>

            {/* Type filter */}
            <Select
              placeholder="Type"
              allowClear
              value={filterType}
              onChange={setFilterType}
              style={{ width: 120 }}
            >
              {(["BUG","FEATURE","TASK","IMPROVEMENT"] as TicketType[]).map((t) => (
                <Select.Option key={t} value={t}>
                  <span style={{ color: TYPE_COLORS[t], fontWeight: 500 }}>{TYPE_LABELS[t]}</span>
                </Select.Option>
              ))}
            </Select>

            {/* Priority filter */}
            <Select
              placeholder="Priority"
              allowClear
              value={filterPriority}
              onChange={setFilterPriority}
              style={{ width: 120 }}
            >
              {["LOW","MEDIUM","HIGH","CRITICAL"].map((p) => (
                <Select.Option key={p} value={p}>{p}</Select.Option>
              ))}
            </Select>

            {hasFilters && (
              <Button
                size="small"
                onClick={() => { setFilterAssignee(undefined); setFilterType(undefined); setFilterPriority(undefined); }}
              >
                Clear filters
              </Button>
            )}

            {canManage && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                New Ticket
              </Button>
            )}
          </Space>
        </div>
      </div>

      {/* ── Board columns ── */}
      {ticketsLoading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spin size="large" />
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: "flex",
          gap: 16,
          overflowX: "auto",
          alignItems: "flex-start",
          paddingBottom: 16,
        }}>
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key}
              col={col}
              tickets={byStatus[col.key]}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onTicketClick={(id) => router.push(`/tickets/${id}`)}
              isDragOver={dragOverCol === col.key}
              setDragOver={(v) => setDragOverCol(v ? col.key : null)}
              onAdd={() => setCreateOpen(true)}
              canAdd={canManage}
            />
          ))}
        </div>
      )}

      {/* ── Totals bar ── */}
      {!ticketsLoading && filtered.length > 0 && (
        <div style={{
          display: "flex", gap: 16, paddingTop: 12,
          borderTop: "1px solid #f0f0f0", flexWrap: "wrap",
        }}>
          {COLUMNS.map((col) => (
            <Space key={col.key} size={4}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.dotColor }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {col.label}: <Text strong style={{ fontSize: 12 }}>{byStatus[col.key].length}</Text>
              </Text>
            </Space>
          ))}
        </div>
      )}

      <CreateTicketModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          queryClient.invalidateQueries({ queryKey: ["board-tickets", selectedProject] });
        }}
        projectId={selectedProject}
      />
    </div>
  );
}
