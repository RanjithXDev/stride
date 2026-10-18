"use client";
import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Space, Select, Button, Input, Avatar,
  Form, Spin, message, Tag, Timeline,
  Card, Row, Col, InputNumber, DatePicker, Modal,
  Tabs, Badge, Popconfirm, Empty,
} from "antd";
import {
  ArrowLeftOutlined, ClockCircleOutlined, CommentOutlined,
  EditOutlined, CheckOutlined, CloseOutlined, PlusOutlined,
  LinkOutlined, BranchesOutlined, HistoryOutlined, DeleteOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { ticketsApi, TicketAuditEvent } from "@/lib/tickets";
import { employeesApi } from "@/lib/employees";
import { TicketStatus, TicketComment, TicketActivity, TicketMini, LinkType, UpdateTicketPayload } from "@/types";
import { StatusTag, PriorityTag } from "@/components/tickets/TicketStatusBadge";
import { useAuthStore } from "@/store/auth";

dayjs.extend(relativeTime);

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const statusOrder: TicketStatus[] = ["OPEN", "IN_PROGRESS", "IN_REVIEW", "CLOSED"];
const roleColors: Record<string, string> = { FOUNDER: "purple", CFO: "green", MANAGER: "blue", EMPLOYEE: "default" };

function ticketId(ticket: { key: string }): string {
  return ticket.key;
}

const LINK_LABELS: Record<string, { from: string; to: string }> = {
  RELATES_TO: { from: "Relates to", to: "Relates to" },
  BLOCKS:     { from: "Blocks",     to: "Blocked by" },
  BLOCKED_BY: { from: "Blocked by", to: "Blocks" },
  DUPLICATES: { from: "Duplicates", to: "Duplicated by" },
};

const ACTIVITY_ICONS: Record<string, string> = {
  CREATED:          "🎯",
  STATUS_CHANGED:   "🔄",
  PRIORITY_CHANGED: "⚡",
  ASSIGNEE_CHANGED: "👤",
  ESTIMATION_SET:   "⏱",
  DUE_DATE_SET:     "📅",
  PARENT_SET:       "🔗",
  COMMENT_ADDED:    "💬",
  LINKED:           "🔗",
};

function activityText(a: TicketActivity): string {
  switch (a.type) {
    case "CREATED":          return "created this ticket";
    case "STATUS_CHANGED":   return `changed status from ${a.from} to ${a.to}`;
    case "PRIORITY_CHANGED": return `changed priority from ${a.from} to ${a.to}`;
    case "ASSIGNEE_CHANGED": return `changed assignee from ${a.from} to ${a.to}`;
    case "ESTIMATION_SET":   return a.from ? `updated estimation from ${a.from} to ${a.to}` : `set estimation to ${a.to}`;
    case "DUE_DATE_SET":     return a.from ? `changed deadline from ${a.from} to ${a.to}` : `set deadline to ${a.to}`;
    case "PARENT_SET":       return a.to ? `set parent ticket to "${a.to}"` : "removed parent ticket";
    case "COMMENT_ADDED":    return "added a comment";
    case "LINKED":           return `linked ticket: ${a.to}`;
    default:                 return a.type.toLowerCase().replace(/_/g, " ");
  }
}

/* ── Inline editable field ───────────────────────────── */
function InlineEdit({
  label, value, onSave, children, canEdit,
}: {
  label: string;
  value: React.ReactNode;
  onSave?: () => void;
  children?: React.ReactNode;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div style={{ marginBottom: 12 }}>
      <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
        textTransform: "uppercase", display: "block", marginBottom: 4 }}>
        {label}
      </Text>
      {editing && canEdit ? (
        <Space wrap>
          {children}
          <Button size="small" type="primary" icon={<CheckOutlined />}
            onClick={() => { onSave?.(); setEditing(false); }} />
          <Button size="small" icon={<CloseOutlined />} onClick={() => setEditing(false)} />
        </Space>
      ) : (
        <Space>
          <span style={{ fontSize: 13 }}>{value}</span>
          {canEdit && (
            <Button size="small" type="text" icon={<EditOutlined />}
              style={{ opacity: 0.4, padding: "0 4px" }}
              onClick={() => setEditing(true)} />
          )}
        </Space>
      )}
    </div>
  );
}

/* ── Sub-ticket row ───────────────────────────── */
function SubTicketRow({ ticket }: { ticket: TicketMini }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(`/tickets/${ticket.id}`)}
      style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
        borderRadius: 6, cursor: "pointer", marginBottom: 4,
        background: "var(--sub-ticket-bg, rgba(0,0,0,0.03))",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      <Text code style={{ fontSize: 11, color: "#8c8c8c", flexShrink: 0 }}>{ticket.key}</Text>
      <StatusTag status={ticket.status} />
      <PriorityTag priority={ticket.priority} />
      <Text style={{ flex: 1, fontSize: 13 }}>{ticket.title}</Text>
      <Tag style={{ fontSize: 10 }}>{ticket.type}</Tag>
    </div>
  );
}

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [comment, setComment] = useState("");
  const [logForm] = Form.useForm();
  const [linkForm] = Form.useForm();
  const [logOpen, setLogOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [createSubOpen, setCreateSubOpen] = useState(false);
  const [subForm] = Form.useForm();

  // Local state for inline edits
  const [pendingAssignee, setPendingAssignee] = useState<string | null | undefined>(undefined);
  const [pendingEstimation, setPendingEstimation] = useState<number | null>(null);
  const [pendingDue, setPendingDue] = useState<any>(null);
  const [pendingParent, setPendingParent] = useState<string | null | undefined>(undefined);

  const { id } = use(params);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => ticketsApi.get(id),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesApi.list({ isActive: true }),
    enabled: !!ticket,
  });

  const { data: auditEvents = [], isLoading: auditLoading } = useQuery({
    queryKey: ["ticket-audit", id],
    queryFn: () => ticketsApi.auditEvents(id),
    enabled: !!ticket,
  });

  // All tickets for link/parent search
  const { data: allTicketsData } = useQuery({
    queryKey: ["tickets"],
    queryFn: () => ticketsApi.list({ pageSize: 200 }),
    enabled: linkOpen || createSubOpen,
  });
  const allTickets = allTicketsData?.items ?? [];

  const updateMutation = useMutation({
    mutationFn: (payload: Omit<UpdateTicketPayload, "version">) => {
      if (!ticket) throw new Error("Ticket not found");
      return ticketsApi.update(id, { ...payload, version: ticket.version });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["tickets"] });
      message.success("Updated");
    },
    onError: () => message.error("Update failed"),
  });

  const commentMutation = useMutation({
    mutationFn: (content: string) => ticketsApi.addComment(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      setComment("");
    },
    onError: () => message.error("Failed to post comment"),
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => ticketsApi.deleteComment(id, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", id] }),
  });

  const logTimeMutation = useMutation({
    mutationFn: ({ minutes, notes, workType }: { minutes: number; notes?: string; workType?: string }) =>
      ticketsApi.logTime(id, minutes, notes, workType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      logForm.resetFields();
      setLogOpen(false);
      message.success("Time logged");
    },
    onError: () => message.error("Failed to log time"),
  });

  const addLinkMutation = useMutation({
    mutationFn: ({ targetId, linkType }: { targetId: string; linkType: LinkType }) =>
      ticketsApi.addLink(id, targetId, linkType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      linkForm.resetFields();
      setLinkOpen(false);
      message.success("Link added");
    },
    onError: () => message.error("Failed to add link"),
  });

  const removeLinkMutation = useMutation({
    mutationFn: (linkId: string) => ticketsApi.removeLink(linkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", id] }),
  });

  const createSubMutation = useMutation({
    mutationFn: (values: any) =>
      ticketsApi.create({ ...values, parentId: id, projectId: ticket?.project?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      subForm.resetFields();
      setCreateSubOpen(false);
      message.success("Sub-ticket created");
    },
    onError: () => message.error("Failed to create sub-ticket"),
  });

  const reverseMutation = useMutation({
    mutationFn: ({ eventId, version }: { eventId: string; version: number }) =>
      ticketsApi.reverseAuditEvent(eventId, version, "Reversed from ticket activity history"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["ticket-audit", id] });
      message.success("Change reversed");
    },
    onError: () => message.error("The change could not be reversed. Refresh and try again."),
  });

  const previewAndReverse = async (event: TicketAuditEvent) => {
    try {
      const preview = await ticketsApi.reversalPreview(event.id);
      if (!preview.allowed) return message.warning(preview.message ?? "This change cannot be reversed");
      Modal.confirm({
        title: "Reverse this change?",
        content: (
          <div>
            <Text>This restores {preview.changes.length} field{preview.changes.length === 1 ? "" : "s"}:</Text>
            <ul style={{ marginBottom: 0 }}>
              {preview.changes.map((change) => <li key={change.field}><Text code>{change.field}</Text></li>)}
            </ul>
          </div>
        ),
        okText: "Reverse change",
        okButtonProps: { danger: true },
        onOk: () => reverseMutation.mutateAsync({ eventId: event.id, version: preview.currentVersion }),
      });
    } catch {
      message.error("Unable to preview this reversal");
    }
  };

  if (isLoading) return <Spin style={{ display: "block", margin: "80px auto" }} />;
  if (!ticket)   return <Text type="danger">Ticket not found.</Text>;

  const canEdit =
    user?.role === "FOUNDER" ||
    user?.role === "MANAGER" ||
    ticket.reporter.id === user?.id;

  // Only the assignee or reporter can log time (Managers/Founders can log on any ticket)
  const canLogTime =
    user?.role === "FOUNDER" ||
    user?.role === "MANAGER" ||
    user?.role === "CFO" ||
    ticket.assignee?.id === user?.id ||
    ticket.reporter.id === user?.id;

  const totalMinutes = ticket.timeLogs.reduce((s, l) => s + l.minutes, 0);
  const loggedHrs = (totalMinutes / 60).toFixed(1);
  const estHrs = ticket.estimation;
  const progressPct = estHrs && totalMinutes > 0
    ? Math.min(100, Math.round((totalMinutes / 60 / estHrs) * 100))
    : null;

  // Build unified activity + comment timeline sorted by time
  type TimelineItem =
    | { kind: "activity"; item: TicketActivity }
    | { kind: "comment";  item: TicketComment };

  const timeline: TimelineItem[] = [
    ...(ticket.activities ?? []).map((a) => ({ kind: "activity" as const, item: a })),
    ...(ticket.comments ?? []).map((c) => ({ kind: "comment" as const, item: c })),
  ].sort((a, b) => new Date(a.item.createdAt).getTime() - new Date(b.item.createdAt).getTime());

  const otherTickets = allTickets.filter((t) => t.id !== id);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <Button icon={<ArrowLeftOutlined />} type="link" style={{ paddingLeft: 0, marginBottom: 16 }}
        onClick={() => router.push("/tickets")}>
        Back to Tickets
      </Button>

      {/* Breadcrumb parent */}
      {ticket.parent && (
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <ApartmentOutlined /> Parent:{" "}
            <Text code style={{ fontSize: 11 }}>{ticket.parent.key}</Text>{" "}
            <a onClick={() => router.push(`/tickets/${ticket.parent!.id}`)} style={{ fontSize: 12 }}>
              {ticket.parent.title}
            </a>
          </Text>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <Space style={{ marginBottom: 8 }}>
            <Text code style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em", color: "#1677ff" }}>
              {ticketId(ticket)}
            </Text>
            <StatusTag status={ticket.status} />
            <PriorityTag priority={ticket.priority} />
            <Tag>{ticket.type.charAt(0) + ticket.type.slice(1).toLowerCase()}</Tag>
            {ticket.project && <Tag color="blue">{ticket.project.name}</Tag>}
            {(ticket.children ?? []).length > 0 && (
              <Tag color="purple" icon={<BranchesOutlined />}>
                {ticket.children.length} sub-ticket{ticket.children.length !== 1 ? "s" : ""}
              </Tag>
            )}
          </Space>
          <Title level={3} style={{ margin: 0 }}>{ticket.title}</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Reported by <Text strong>{ticket.reporter.name}</Text> · {dayjs(ticket.createdAt).fromNow()}
          </Text>
        </div>

        {canEdit && (
          <Select
            value={ticket.status}
            onChange={(status) => updateMutation.mutate({ status })}
            style={{ width: 160 }}
            loading={updateMutation.isPending}
          >
            {statusOrder.map((s) => (
              <Option key={s} value={s}>{s.replace(/_/g, " ")}</Option>
            ))}
          </Select>
        )}
      </div>

      <Row gutter={24}>
        {/* ── LEFT: tabbed content ── */}
        <Col xs={24} md={16}>
          {ticket.description && (
            <Card style={{ marginBottom: 16 }} styles={{ body: { padding: "14px 18px" } }}>
              <Text style={{ whiteSpace: "pre-wrap" }}>{ticket.description}</Text>
            </Card>
          )}

          <Tabs
            defaultActiveKey="activity"
            items={[
              {
                key: "activity",
                label: (
                  <Space size={4}>
                    <HistoryOutlined />
                    Activity
                    <Badge count={timeline.length} size="small" color="#1677ff" />
                  </Space>
                ),
                children: (
                  <div>
                    {timeline.length === 0 ? (
                      <Empty description="No activity yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    ) : (
                      <Timeline
                        style={{ marginTop: 8 }}
                        items={timeline.map((entry) => {
                          if (entry.kind === "activity") {
                            const a = entry.item as TicketActivity;
                            return {
                              icon: (
                                <span style={{ fontSize: 14 }}>
                                  {ACTIVITY_ICONS[a.type] ?? "•"}
                                </span>
                              ),
                              content: (
                                <div style={{ paddingBottom: 8 }}>
                                  <Space wrap size={4}>
                                    <Text strong style={{ fontSize: 13 }}>{a.user.name}</Text>
                                    <Text style={{ fontSize: 13 }}>{activityText(a)}</Text>
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                      {dayjs(a.createdAt).fromNow()}
                                    </Text>
                                  </Space>
                                </div>
                              ),
                            };
                          } else {
                            const c = entry.item as TicketComment;
                            return {
                              icon: <CommentOutlined style={{ color: "#52c41a" }} />,
                              content: (
                                <div style={{ paddingBottom: 8 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                    <Space size={4} wrap>
                                      <Avatar size={20} style={{ background: "#52c41a", fontSize: 10 }}>
                                        {c.author.name.charAt(0)}
                                      </Avatar>
                                      <Text strong style={{ fontSize: 13 }}>{c.author.name}</Text>
                                      <Text type="secondary" style={{ fontSize: 11 }}>
                                        {dayjs(c.createdAt).fromNow()}
                                      </Text>
                                    </Space>
                                    {(c.author.id === user?.id || ["FOUNDER", "MANAGER"].includes(user?.role ?? "")) && (
                                      <Button
                                        type="text" size="small" danger icon={<DeleteOutlined />}
                                        onClick={() => deleteCommentMutation.mutate(c.id)}
                                      />
                                    )}
                                  </div>
                                  <div style={{
                                    marginTop: 6, padding: "8px 12px", borderRadius: 6,
                                    background: "rgba(0,0,0,0.04)", fontSize: 13, whiteSpace: "pre-wrap",
                                  }}>
                                    {c.content}
                                  </div>
                                </div>
                              ),
                            };
                          }
                        })}
                      />
                    )}

                    {/* Comment input */}
                    <div style={{ marginTop: 16, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 16 }}>
                      <TextArea
                        rows={3}
                        placeholder="Write a comment..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        style={{ marginBottom: 8 }}
                      />
                      <Button
                        type="primary"
                        onClick={() => commentMutation.mutate(comment)}
                        loading={commentMutation.isPending}
                        disabled={!comment.trim()}
                        icon={<CommentOutlined />}
                      >
                        Post Comment
                      </Button>
                    </div>
                  </div>
                ),
              },
              {
                key: "audit",
                label: (
                  <Space size={4}>
                    <HistoryOutlined /> Audit history
                    <Badge count={auditEvents.length} size="small" color="#722ed1" />
                  </Space>
                ),
                children: auditLoading ? <Spin /> : auditEvents.length === 0 ? (
                  <Empty description="No audited changes yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                ) : (
                  <Timeline items={auditEvents.map((event) => ({
                    color: event.reversesEventId ? "purple" : event.reversedByEvent ? "gray" : "blue",
                    content: (
                      <div style={{ paddingBottom: 10 }}>
                        <Space wrap>
                          <Text strong>{event.actor?.name ?? "System"}</Text>
                          <Text>{event.action.replace(/[._]/g, " ")}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(event.createdAt).fromNow()}</Text>
                          {event.reversedByEvent && <Tag>Reversed</Tag>}
                          {event.reversible && !event.reversedByEvent && (
                            <Button size="small" onClick={() => previewAndReverse(event)} loading={reverseMutation.isPending}>
                              Reverse
                            </Button>
                          )}
                        </Space>
                      </div>
                    ),
                  }))} />
                ),
              },
              {
                key: "sub-tickets",
                label: (
                  <Space size={4}>
                    <BranchesOutlined />
                    Sub-tickets
                    <Badge count={(ticket.children ?? []).length} size="small" color="#722ed1" />
                  </Space>
                ),
                children: (
                  <div>
                    {(ticket.children ?? []).length === 0 ? (
                      <Empty description="No sub-tickets" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginBottom: 16 }} />
                    ) : (
                      <div style={{ marginBottom: 12 }}>
                        {ticket.children.map((child) => (
                          <SubTicketRow key={child.id} ticket={child} />
                        ))}
                      </div>
                    )}
                    {canEdit && (
                      <Button
                        icon={<PlusOutlined />}
                        onClick={() => setCreateSubOpen(true)}
                        size="small"
                      >
                        Create Sub-ticket
                      </Button>
                    )}
                  </div>
                ),
              },
              {
                key: "links",
                label: (
                  <Space size={4}>
                    <LinkOutlined />
                    Links
                    <Badge count={(ticket.links ?? []).length} size="small" color="#fa8c16" />
                  </Space>
                ),
                children: (
                  <div>
                    {(ticket.links ?? []).length === 0 ? (
                      <Empty description="No linked tickets" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginBottom: 16 }} />
                    ) : (
                      <div style={{ marginBottom: 12 }}>
                        {ticket.links.map((link) => {
                          const label = LINK_LABELS[link.linkType]?.[link.direction === "FROM" ? "from" : "to"] ?? link.linkType;
                          return (
                            <div
                              key={link.id}
                              style={{
                                display: "flex", alignItems: "center", gap: 8,
                                padding: "8px 12px", borderRadius: 6, marginBottom: 6,
                                border: "1px solid rgba(0,0,0,0.08)",
                              }}
                            >
                              <Tag color="orange" style={{ minWidth: 90, textAlign: "center", fontSize: 11 }}>
                                {label}
                              </Tag>
                              <StatusTag status={link.ticket.status} />
                              <a
                                onClick={() => router.push(`/tickets/${link.ticket.id}`)}
                                style={{ flex: 1, fontSize: 13 }}
                              >
                                {link.ticket.title}
                              </a>
                              <Text code style={{ fontSize: 11, color: "#8c8c8c", flexShrink: 0 }}>
                                {link.ticket.key}
                              </Text>
                              {canEdit && (
                                <Popconfirm
                                  title="Remove this link?"
                                  onConfirm={() => removeLinkMutation.mutate(link.id)}
                                >
                                  <Button type="text" size="small" danger icon={<CloseOutlined />} />
                                </Popconfirm>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {canEdit && (
                      <Button icon={<PlusOutlined />} onClick={() => setLinkOpen(true)} size="small">
                        Add Link
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Col>

        {/* ── RIGHT: metadata sidebar ── */}
        <Col xs={24} md={8}>
          <Card styles={{ body: { padding: "16px 20px" } }}>

            {/* Assignee */}
            <InlineEdit
              label="Assignee"
              canEdit={canEdit}
              value={
                ticket.assignee ? (
                  <Space size={6}>
                    <Avatar size={22} style={{ background: "#1677ff", fontSize: 11 }}>
                      {ticket.assignee.name.charAt(0)}
                    </Avatar>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{ticket.assignee.name}</div>
                      {ticket.assignee.department && (
                        <div style={{ fontSize: 11, color: "#888" }}>{ticket.assignee.department.name}</div>
                      )}
                    </div>
                    {ticket.assignee.role && (
                      <Tag color={roleColors[ticket.assignee.role] ?? "default"} style={{ fontSize: 10 }}>
                        {ticket.assignee.role}
                      </Tag>
                    )}
                  </Space>
                ) : <Text type="secondary">Unassigned</Text>
              }
              onSave={() =>
                updateMutation.mutate({ assigneeId: pendingAssignee === null ? null : pendingAssignee })
              }
            >
              <Select
                showSearch
                allowClear
                placeholder="Select employee..."
                defaultValue={ticket.assignee?.id}
                onChange={(v) => setPendingAssignee(v ?? null)}
                optionFilterProp="label"
                style={{ width: 220 }}
                options={employees.map((e) => ({
                  value: e.id,
                  label: `${e.name} — ${e.role}`,
                  name: e.name,
                  role: e.role,
                  dept: (e as any).department?.name,
                }))}
                optionRender={(opt) => (
                  <Space>
                    <Avatar size={20} style={{ background: "#1677ff", fontSize: 10, flexShrink: 0 }}>
                      {String(opt.data.name).charAt(0)}
                    </Avatar>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{opt.data.name}</div>
                      <div style={{ fontSize: 11, color: "#888" }}>
                        {opt.data.role}{opt.data.dept ? ` · ${opt.data.dept}` : ""}
                      </div>
                    </div>
                  </Space>
                )}
              />
            </InlineEdit>

            <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "12px 0" }} />

            {/* Dev Estimation */}
            <InlineEdit
              label="Dev Estimation"
              canEdit={canEdit}
              value={
                estHrs
                  ? <Space>
                      <Text>{estHrs}h estimated</Text>
                      {progressPct !== null && (
                        <Tag color={progressPct >= 100 ? "red" : progressPct >= 75 ? "orange" : "green"}>
                          {loggedHrs}h / {estHrs}h
                        </Tag>
                      )}
                    </Space>
                  : <Text type="secondary">Not set</Text>
              }
              onSave={() => updateMutation.mutate({ estimation: pendingEstimation ?? undefined })}
            >
              <InputNumber
                min={0.5} step={0.5} precision={1}
                defaultValue={estHrs ?? undefined}
                onChange={(v) => setPendingEstimation(v as number)}
                addonAfter="hrs"
                style={{ width: 130 }}
              />
            </InlineEdit>

            <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "12px 0" }} />

            {/* Deadline */}
            <InlineEdit
              label="Deadline"
              canEdit={canEdit}
              value={
                ticket.dueDate ? (
                  <Text type={dayjs(ticket.dueDate).isBefore(dayjs()) && ticket.status !== "CLOSED" ? "danger" : undefined}>
                    {dayjs(ticket.dueDate).format("D MMM YYYY")}
                    <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>
                      ({dayjs(ticket.dueDate).fromNow()})
                    </Text>
                  </Text>
                ) : <Text type="secondary">No deadline</Text>
              }
              onSave={() => updateMutation.mutate({ dueDate: pendingDue?.toISOString() })}
            >
              <DatePicker
                defaultValue={ticket.dueDate ? dayjs(ticket.dueDate) : undefined}
                onChange={(v) => setPendingDue(v)}
              />
            </InlineEdit>

            <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "12px 0" }} />

            {/* Priority */}
            <InlineEdit
              label="Priority"
              canEdit={canEdit}
              value={<PriorityTag priority={ticket.priority} />}
              onSave={() => {}}
            >
              <Select
                defaultValue={ticket.priority}
                onChange={(v) => updateMutation.mutate({ priority: v })}
                style={{ width: 130 }}
              >
                {["LOW","MEDIUM","HIGH","CRITICAL"].map((p) => (
                  <Option key={p} value={p}>{p}</Option>
                ))}
              </Select>
            </InlineEdit>

            <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "12px 0" }} />

            {/* Parent Ticket */}
            <InlineEdit
              label="Parent Ticket"
              canEdit={canEdit}
              value={
                ticket.parent
                  ? <Space size={4}>
                      <Text code style={{ fontSize: 11 }}>{ticket.parent.key}</Text>
                      <a onClick={() => router.push(`/tickets/${ticket.parent!.id}`)} style={{ fontSize: 13 }}>
                        {ticket.parent.title}
                      </a>
                    </Space>
                  : <Text type="secondary">None</Text>
              }
              onSave={() =>
                updateMutation.mutate({ parentId: pendingParent === null ? null : pendingParent })
              }
            >
              <Select
                showSearch
                allowClear
                placeholder="Select parent ticket..."
                defaultValue={ticket.parent?.id}
                onChange={(v) => setPendingParent(v ?? null)}
                optionFilterProp="label"
                style={{ width: 220 }}
                options={allTickets
                  .filter((t) => t.id !== id)
                  .map((t) => ({ value: t.id, label: t.title }))}
              />
            </InlineEdit>

            <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "12px 0" }} />

            {/* Time logged */}
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
                textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                Time Logged
              </Text>
              <Space>
                <ClockCircleOutlined style={{ color: "#1677ff" }} />
                <Text style={{ fontSize: 13 }}>{loggedHrs}h</Text>
                {estHrs && progressPct !== null && (
                  <Text type="secondary" style={{ fontSize: 12 }}>of {estHrs}h ({progressPct}%)</Text>
                )}
                {canLogTime && (
                  <Button size="small" onClick={() => setLogOpen(true)}>+ Log</Button>
                )}
              </Space>
              {!canLogTime && (
                <Text type="secondary" style={{ fontSize: 11, display: "block", marginTop: 2 }}>
                  Only assignee or reporter can log time
                </Text>
              )}
            </div>

            <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "12px 0" }} />

            {/* Reporter */}
            <div>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
                textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                Reporter
              </Text>
              <Space size={6}>
                <Avatar size={22} style={{ background: "#722ed1", fontSize: 11 }}>
                  {ticket.reporter.name.charAt(0)}
                </Avatar>
                <Text style={{ fontSize: 13 }}>{ticket.reporter.name}</Text>
              </Space>
            </div>

            {ticket.closedAt && (
              <>
                <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "12px 0" }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
                    textTransform: "uppercase", display: "block", marginBottom: 4 }}>
                    Closed
                  </Text>
                  <Text style={{ fontSize: 13 }}>{dayjs(ticket.closedAt).format("D MMM YYYY")}</Text>
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* Log Time Modal — only for assignee / reporter / manager / founder */}
      <Modal title="Log Time" open={logOpen && canLogTime} onCancel={() => setLogOpen(false)} footer={null} destroyOnHidden>
        <Form form={logForm} layout="vertical" onFinish={(v) => logTimeMutation.mutate(v)} style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="minutes" label="Minutes spent" rules={[{ required: true, message: "Enter minutes" }]}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="e.g. 90" />
            </Form.Item>
            <Form.Item name="workType" label="Work Type" initialValue="DEVELOPMENT">
              <Select>
                {["DEVELOPMENT","TESTING","MEETING","DOCUMENTATION","REVIEW","DESIGN","BUG_FIX","PLANNING","OTHER"].map((t) => (
                  <Option key={t} value={t}>{t.replace(/_/g, " ")}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notes">
            <Input placeholder="What was done?" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button onClick={() => setLogOpen(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={logTimeMutation.isPending}>Log</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add Link Modal */}
      <Modal title="Link Ticket" open={linkOpen} onCancel={() => setLinkOpen(false)} footer={null} destroyOnHidden>
        <Form form={linkForm} layout="vertical" onFinish={addLinkMutation.mutate} style={{ marginTop: 16 }}>
          <Form.Item name="linkType" label="Link Type" initialValue="RELATES_TO">
            <Select>
              <Option value="RELATES_TO">Relates to</Option>
              <Option value="BLOCKS">Blocks</Option>
              <Option value="BLOCKED_BY">Blocked by</Option>
              <Option value="DUPLICATES">Duplicates</Option>
            </Select>
          </Form.Item>
          <Form.Item name="targetId" label="Ticket" rules={[{ required: true, message: "Select a ticket" }]}>
            <Select
              showSearch
              placeholder="Search tickets..."
              optionFilterProp="label"
              options={otherTickets.map((t) => ({ value: t.id, label: t.title }))}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button onClick={() => setLinkOpen(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={addLinkMutation.isPending}>Add Link</Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Sub-ticket Modal */}
      <Modal
        title={`Create Sub-ticket under: ${ticket.title}`}
        open={createSubOpen}
        onCancel={() => setCreateSubOpen(false)}
        footer={null}
        destroyOnHidden
        width={520}
      >
        <Form form={subForm} layout="vertical" onFinish={createSubMutation.mutate} style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required" }]}>
            <Input placeholder="Short description of this sub-task" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="type" label="Type" initialValue="TASK">
              <Select>
                {["TASK","BUG","FEATURE","IMPROVEMENT"].map((t) => (
                  <Option key={t} value={t}>{t}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="priority" label="Priority" initialValue="MEDIUM">
              <Select>
                {["LOW","MEDIUM","HIGH","CRITICAL"].map((p) => (
                  <Option key={p} value={p}>{p}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="assigneeId" label="Assign To">
            <Select
              showSearch allowClear placeholder="Select employee..."
              optionFilterProp="label"
              options={employees.map((e) => ({ value: e.id, label: `${e.name} — ${e.role}` }))}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button onClick={() => setCreateSubOpen(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={createSubMutation.isPending}>Create</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
