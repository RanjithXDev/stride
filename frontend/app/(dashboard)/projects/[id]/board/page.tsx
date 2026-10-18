"use client";
import { use, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Space, Button, Avatar, Tag, Spin, Select,
  Tooltip, Badge, message,
} from "antd";
import {
  ArrowLeftOutlined, PlusOutlined,
} from "@ant-design/icons";
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

const COLUMNS: { key: TicketStatus; label: string; color: string; bg: string }[] = [
  { key: "OPEN",      label: "Open",       color: "#8c8c8c", bg: "#fafafa" },
  { key: "IN_PROGRESS", label: "In Progress", color: "#1677ff", bg: "#f0f7ff" },
  { key: "IN_REVIEW", label: "In Review",  color: "#fa8c16", bg: "#fff7e6" },
  { key: "CLOSED",    label: "Closed",     color: "#52c41a", bg: "#f6ffed" },
];

const TYPE_COLORS: Record<TicketType, string> = {
  BUG: "#f5222d", FEATURE: "#722ed1", TASK: "#1677ff", IMPROVEMENT: "#fa8c16",
};
const TYPE_LABELS: Record<TicketType, string> = {
  BUG: "Bug", FEATURE: "Feature", TASK: "Task", IMPROVEMENT: "Improvement",
};

const PRIORITY_DOT: Record<TicketPriority, string> = {
  LOW: "#52c41a", MEDIUM: "#faad14", HIGH: "#fa8c16", CRITICAL: "#f5222d",
};

function TicketCard({
  ticket,
  onDragStart,
  onClick,
}: {
  ticket: Ticket;
  onDragStart: (id: string) => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(ticket.id);
      }}
      onClick={onClick}
      style={{
        background: "var(--app-surface)",
        border: "1px solid rgba(0,0,0,0.08)",
        borderLeft: `3px solid ${PRIORITY_DOT[ticket.priority]}`,
        borderRadius: 6,
        padding: "10px 12px",
        marginBottom: 8,
        cursor: "grab",
        userSelect: "none",
        transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ flex: 1, paddingRight: 4 }}>
          <Text style={{ fontSize: 10, color: "#8c8c8c", fontFamily: "monospace", display: "block", marginBottom: 2 }}>
            {ticket.key}
          </Text>
          <Text style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
            {ticket.title}
          </Text>
        </div>
        <Tag style={{
          fontSize: 10, padding: "0 5px", margin: 0, fontWeight: 600, flexShrink: 0,
          color: TYPE_COLORS[ticket.type],
          background: `${TYPE_COLORS[ticket.type]}15`,
          border: `1px solid ${TYPE_COLORS[ticket.type]}40`,
        }}>
          {TYPE_LABELS[ticket.type]}
        </Tag>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <PriorityTag priority={ticket.priority} />
        {ticket.dueDate && (
          <Text
            type={dayjs(ticket.dueDate).isBefore(dayjs()) && ticket.status !== "CLOSED" ? "danger" : "secondary"}
            style={{ fontSize: 11 }}
          >
            {dayjs(ticket.dueDate).format("D MMM")}
          </Text>
        )}
        {ticket.assignee ? (
          <Tooltip title={ticket.assignee.name}>
            <Avatar size={20} style={{ background: "#1677ff", fontSize: 10, cursor: "pointer" }}>
              {ticket.assignee.name.charAt(0)}
            </Avatar>
          </Tooltip>
        ) : (
          <Avatar size={20} style={{ background: "#d9d9d9", fontSize: 10 }}>?</Avatar>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  column,
  tickets,
  onDragStart,
  onDrop,
  onTicketClick,
  isDragOver,
  setDragOver,
}: {
  column: typeof COLUMNS[number];
  tickets: Ticket[];
  onDragStart: (id: string) => void;
  onDrop: (status: TicketStatus) => void;
  onTicketClick: (id: string) => void;
  isDragOver: boolean;
  setDragOver: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 220,
        maxWidth: 300,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Column header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "10px 14px", marginBottom: 8,
        borderRadius: 6, background: column.bg,
        border: `1px solid ${column.color}30`,
      }}>
        <Space size={6}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: column.color }} />
          <Text strong style={{ fontSize: 13, color: column.color }}>{column.label}</Text>
        </Space>
        <Badge count={tickets.length} color={column.color} />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onDrop(column.key); }}
        style={{
          flex: 1,
          minHeight: 120,
          padding: "4px 2px",
          borderRadius: 6,
          background: isDragOver ? `${column.color}10` : "transparent",
          border: isDragOver ? `2px dashed ${column.color}` : "2px dashed transparent",
          transition: "all 0.15s",
        }}
      >
        {tickets.length === 0 && (
          <div style={{
            height: 80, display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 6, color: "#bbb", fontSize: 12,
          }}>
            Drop here
          </div>
        )}
        {tickets.map((t) => (
          <TicketCard
            key={t.id}
            ticket={t}
            onDragStart={onDragStart}
            onClick={() => onTicketClick(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default function ProjectBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState<string | undefined>();
  const [filterType, setFilterType]         = useState<string | undefined>();
  const dragTicketId = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TicketStatus | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => projectsApi.get(id),
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["tickets", { projectId: id }],
    queryFn: () => ticketsApi.list({ projectId: id, pageSize: 200 }),
    select: (res) => res.items,
    refetchOnWindowFocus: true,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesApi.list({ isActive: true }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      const ticket = tickets.find((item) => item.id === ticketId);
      if (!ticket) throw new Error("Ticket not found");
      return ticketsApi.update(ticketId, { status, version: ticket.version });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tickets", { projectId: id }] });
    },
    onError: () => message.error("Failed to move ticket"),
  });

  const canEdit = user?.role === "FOUNDER" || user?.role === "MANAGER";

  // Apply filters
  const filtered = tickets.filter((t) => {
    if (filterAssignee && t.assignee?.id !== filterAssignee) return false;
    if (filterType && t.type !== filterType) return false;
    return true;
  });

  // Group by status
  const byStatus = Object.fromEntries(
    COLUMNS.map((c) => [c.key, filtered.filter((t) => t.status === c.key)])
  ) as Record<TicketStatus, Ticket[]>;

  function handleDragStart(ticketId: string) {
    dragTicketId.current = ticketId;
  }

  function handleDrop(status: TicketStatus) {
    const ticketId = dragTicketId.current;
    if (!ticketId) return;
    const ticket = tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === status) return;
    updateMutation.mutate({ ticketId, status });
    dragTicketId.current = null;
  }

  if (projectLoading) return <Spin style={{ display: "block", margin: "80px auto" }} />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />} type="link"
          style={{ paddingLeft: 0, marginBottom: 8 }}
          onClick={() => router.push(`/projects/${id}`)}
        >
          {project?.name ?? "Project"}
        </Button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <Space size={6} align="center">
            <Title level={4} style={{ margin: 0 }}>Board</Title>
            <Tag color="blue">{filtered.length} tickets</Tag>
          </Space>
          <Space wrap>
            <Select
              placeholder="Assignee"
              allowClear
              value={filterAssignee}
              onChange={setFilterAssignee}
              showSearch
              optionFilterProp="children"
              style={{ width: 140 }}
              size="small"
            >
              {employees.map((e: any) => (
                <Select.Option key={e.id} value={e.id}>{e.name}</Select.Option>
              ))}
            </Select>
            <Select
              placeholder="Type"
              allowClear
              value={filterType}
              onChange={setFilterType}
              style={{ width: 120 }}
              size="small"
            >
              {(["BUG","FEATURE","TASK","IMPROVEMENT"] as TicketType[]).map((t) => (
                <Select.Option key={t} value={t}>
                  <span style={{ color: TYPE_COLORS[t], fontWeight: 500 }}>{TYPE_LABELS[t]}</span>
                </Select.Option>
              ))}
            </Select>
            {canEdit && (
              <Button
                type="primary" size="small" icon={<PlusOutlined />}
                onClick={() => setCreateOpen(true)}
              >
                New Ticket
              </Button>
            )}
          </Space>
        </div>
      </div>

      {/* Board columns */}
      <div
        style={{
          display: "flex",
          gap: 16,
          overflowX: "auto",
          alignItems: "flex-start",
          flex: 1,
          paddingBottom: 16,
        }}
      >
        {ticketsLoading ? (
          <Spin style={{ margin: "40px auto" }} />
        ) : (
          COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key}
              column={col}
              tickets={byStatus[col.key]}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              onTicketClick={(tid) => router.push(`/tickets/${tid}`)}
              isDragOver={dragOverCol === col.key}
              setDragOver={(v) => setDragOverCol(v ? col.key : null)}
            />
          ))
        )}
      </div>

      <CreateTicketModal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          queryClient.invalidateQueries({ queryKey: ["tickets", { projectId: id }] });
        }}
        projectId={id}
      />
    </div>
  );
}
