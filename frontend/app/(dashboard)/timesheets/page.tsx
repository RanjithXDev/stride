"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Button, Select, Space, Tag, Spin, Tooltip,
  Modal, Form, InputNumber, Input, message,
} from "antd";
import { LeftOutlined, RightOutlined, PlusOutlined, ClockCircleOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import { timesheetsApi } from "@/lib/timesheets";
import { ticketsApi } from "@/lib/tickets";
import { TimesheetEntry, WorkType } from "@/types";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";

dayjs.extend(isoWeek);

const { Text } = Typography;
const { Option } = Select;

type ViewMode = "month" | "week" | "day";

const MINS_PER_DAY  = 8 * 60;
const MINS_PER_WEEK = 5 * MINS_PER_DAY;

const WORK_TYPE_COLORS: Record<WorkType, { bg: string; text: string; border: string }> = {
  DEVELOPMENT:   { bg: "#e6f4ff", text: "#0958d9", border: "#91caff" },
  TESTING:       { bg: "#f6ffed", text: "#389e0d", border: "#b7eb8f" },
  MEETING:       { bg: "#fff7e6", text: "#d46b08", border: "#ffd591" },
  DOCUMENTATION: { bg: "#f9f0ff", text: "#531dab", border: "#d3adf7" },
  REVIEW:        { bg: "#e6fffb", text: "#08979c", border: "#87e8de" },
  DESIGN:        { bg: "#fff0f6", text: "#c41d7f", border: "#ffadd2" },
  BUG_FIX:       { bg: "#fff1f0", text: "#cf1322", border: "#ffa39e" },
  PLANNING:      { bg: "#fffbe6", text: "#d48806", border: "#ffe58f" },
  OTHER:         { bg: "#f5f5f5", text: "#595959", border: "#d9d9d9" },
};

const WORK_TYPES: WorkType[] = [
  "DEVELOPMENT","TESTING","MEETING","DOCUMENTATION","REVIEW","DESIGN","BUG_FIX","PLANNING","OTHER",
];

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0)  return `${m}m`;
  if (m === 0)  return `${h}h`;
  return `${h}h ${m}m`;
}

function fmtDays(minutes: number): string {
  const days = (minutes / MINS_PER_DAY).toFixed(1);
  return `${days}d`;
}

function EntryChip({
  entry,
  compact = false,
  onClick,
}: {
  entry: TimesheetEntry;
  compact?: boolean;
  onClick?: () => void;
}) {
  const c = WORK_TYPE_COLORS[entry.workType] ?? WORK_TYPE_COLORS.OTHER;
  const label = entry.ticket?.title
    ? (compact ? entry.ticket.title.slice(0, 22) + (entry.ticket.title.length > 22 ? "…" : "") : entry.ticket.title)
    : entry.workType.replace(/_/g, " ");

  return (
    <Tooltip
      title={
        <div>
          <div style={{ fontWeight: 600 }}>{entry.ticket?.title ?? entry.workType.replace(/_/g, " ")}</div>
          <div style={{ fontSize: 11, opacity: 0.8 }}>{entry.project?.name}</div>
          <div style={{ marginTop: 2 }}>{fmtDuration(entry.minutes)} · {entry.workType.replace(/_/g, " ")}</div>
          {entry.notes && <div style={{ marginTop: 2, fontStyle: "italic" }}>{entry.notes}</div>}
        </div>
      }
    >
      <div
        onClick={onClick}
        style={{
          background: c.bg,
          color: c.text,
          border: `1px solid ${c.border}`,
          borderRadius: 3,
          padding: "1px 6px",
          fontSize: 11,
          lineHeight: "18px",
          cursor: onClick ? "pointer" : "default",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          marginBottom: 2,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span style={{ fontWeight: 600, flexShrink: 0 }}>{fmtDuration(entry.minutes)}</span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      </div>
    </Tooltip>
  );
}

// ─── Month view ─────────────────────────────────────────────────────────────
function MonthView({
  current,
  entriesByDay,
  today,
  onDayClick,
}: {
  current: Dayjs;
  entriesByDay: Map<string, TimesheetEntry[]>;
  today: string;
  onDayClick: (day: Dayjs) => void;
}) {
  const startOfMonth = current.startOf("month");
  const startOfGrid  = startOfMonth.startOf("week"); // Sunday
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const MAX_SHOW = 3;

  // Build 6 weeks × 7 days grid
  const weeks: Dayjs[][] = [];
  let day = startOfGrid;
  for (let w = 0; w < 6; w++) {
    const week: Dayjs[] = [];
    for (let d = 0; d < 7; d++) { week.push(day); day = day.add(1, "day"); }
    weeks.push(week);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #f0f0f0" }}>
        {DAYS.map((d) => (
          <div key={d} style={{
            padding: "6px 8px", textAlign: "right", fontSize: 12,
            fontWeight: 600, color: "#8c8c8c", letterSpacing: "0.04em",
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{
            display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
            flex: 1, borderBottom: "1px solid #f0f0f0", minHeight: 90,
          }}>
            {week.map((day) => {
              const key = day.format("YYYY-MM-DD");
              const entries = entriesByDay.get(key) ?? [];
              const totalMins = entries.reduce((s, e) => s + e.minutes, 0);
              const isToday = key === today;
              const isOtherMonth = day.month() !== current.month();
              const shown = entries.slice(0, MAX_SHOW);
              const more = entries.length - MAX_SHOW;

              return (
                <div
                  key={key}
                  onClick={() => onDayClick(day)}
                  style={{
                    borderRight: "1px solid #f0f0f0",
                    padding: "4px 6px",
                    cursor: "pointer",
                    background: isToday ? "#e6f4ff" : "transparent",
                    transition: "background 0.1s",
                    minHeight: 90,
                    overflow: "hidden",
                  }}
                  onMouseEnter={(e) => {
                    if (!isToday) (e.currentTarget as HTMLDivElement).style.background = "#fafafa";
                  }}
                  onMouseLeave={(e) => {
                    if (!isToday) (e.currentTarget as HTMLDivElement).style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 3 }}>
                    <div style={{
                      fontSize: 13, fontWeight: isToday ? 700 : 400,
                      width: 22, height: 22, borderRadius: "50%",
                      background: isToday ? "#1677ff" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: isToday ? "#fff" : isOtherMonth ? "#bfbfbf" : "#262626",
                    }}>
                      {day.date()}
                    </div>
                    {totalMins > 0 && (
                      <span style={{ fontSize: 10, color: "#1677ff", fontWeight: 600 }}>
                        {fmtDuration(totalMins)}
                      </span>
                    )}
                  </div>
                  {shown.map((e) => (
                    <EntryChip key={e.id} entry={e} compact />
                  ))}
                  {more > 0 && (
                    <div style={{ fontSize: 11, color: "#1677ff", paddingLeft: 2, marginTop: 1 }}>
                      +{more} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Week view ───────────────────────────────────────────────────────────────
function WeekView({
  current,
  entriesByDay,
  today,
  onDayClick,
}: {
  current: Dayjs;
  entriesByDay: Map<string, TimesheetEntry[]>;
  today: string;
  onDayClick: (day: Dayjs) => void;
}) {
  const startOfWeek = current.startOf("week"); // Sunday
  const days = Array.from({ length: 7 }, (_, i) => startOfWeek.add(i, "day"));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #f0f0f0" }}>
        {days.map((day) => {
          const key = day.format("YYYY-MM-DD");
          const isToday = key === today;
          const entries = entriesByDay.get(key) ?? [];
          const totalMins = entries.reduce((s, e) => s + e.minutes, 0);
          return (
            <div key={key} style={{
              padding: "8px 10px", textAlign: "center",
              background: isToday ? "#e6f4ff" : "transparent",
              borderRight: "1px solid #f0f0f0",
            }}>
              <div style={{ fontSize: 11, color: "#8c8c8c", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {day.format("ddd")}
              </div>
              <div style={{
                fontSize: 20, fontWeight: 700,
                color: isToday ? "#1677ff" : "#262626",
                lineHeight: 1.3,
              }}>
                {day.date()}
              </div>
              {totalMins > 0 && (
                <Tag color="blue" style={{ fontSize: 10, marginTop: 2 }}>
                  {fmtDuration(totalMins)}
                </Tag>
              )}
            </div>
          );
        })}
      </div>

      {/* Entries */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", flex: 1, overflow: "auto", alignItems: "flex-start" }}>
        {days.map((day) => {
          const key = day.format("YYYY-MM-DD");
          const entries = entriesByDay.get(key) ?? [];
          return (
            <div
              key={key}
              onClick={() => onDayClick(day)}
              style={{
                padding: "8px 6px",
                borderRight: "1px solid #f0f0f0",
                minHeight: 300,
                cursor: "pointer",
              }}
            >
              {entries.length === 0 ? (
                <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "#d9d9d9", fontSize: 12 }}>
                  —
                </div>
              ) : (
                entries.map((e) => <EntryChip key={e.id} entry={e} />)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day view ────────────────────────────────────────────────────────────────
function DayView({
  entries,
  onLogTime,
}: {
  entries: TimesheetEntry[];
  onLogTime: () => void;
}) {
  const totalMins = entries.reduce((s, e) => s + e.minutes, 0);
  const byType = new Map<WorkType, number>();
  for (const e of entries) byType.set(e.workType, (byType.get(e.workType) ?? 0) + e.minutes);
  const router = useRouter();

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "0 4px" }}>
      {/* Day summary */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 16px", background: "var(--app-subtle)", borderRadius: 8, marginBottom: 16,
      }}>
        <div>
          <Text style={{ fontSize: 13, color: "#8c8c8c" }}>Total logged</Text>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1677ff" }}>{fmtDuration(totalMins)}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{fmtDays(totalMins)} · {(totalMins / MINS_PER_WEEK * 5).toFixed(1)} week days</Text>
        </div>
        <Space wrap>
          {Array.from(byType.entries()).map(([type, mins]) => {
            const c = WORK_TYPE_COLORS[type];
            return (
              <div key={type} style={{
                background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                borderRadius: 4, padding: "4px 8px", fontSize: 11, fontWeight: 600,
              }}>
                {type.replace(/_/g, " ")} · {fmtDuration(mins)}
              </div>
            );
          })}
        </Space>
      </div>

      {entries.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "#bfbfbf" }}>
          <ClockCircleOutlined style={{ fontSize: 32, marginBottom: 8, display: "block" }} />
          <div>No time logged on this day</div>
          <Button type="primary" size="small" icon={<PlusOutlined />} style={{ marginTop: 12 }} onClick={onLogTime}>
            Log Time
          </Button>
        </div>
      ) : (
        <div>
          {entries.map((e) => {
            const c = WORK_TYPE_COLORS[e.workType] ?? WORK_TYPE_COLORS.OTHER;
            return (
              <div
                key={e.id}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px 14px", borderRadius: 6, marginBottom: 8,
                  border: `1px solid ${c.border}`,
                  background: c.bg,
                  cursor: e.ticket ? "pointer" : "default",
                }}
                onClick={() => e.ticket && router.push(`/tickets/${e.ticket.id}`)}
              >
                <div style={{
                  width: 4, alignSelf: "stretch", borderRadius: 2,
                  background: c.border, flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <Text strong style={{ fontSize: 13, color: c.text }}>
                        {e.ticket?.title ?? e.workType.replace(/_/g, " ")}
                      </Text>
                      {e.project && (
                        <Tag style={{ marginLeft: 6, fontSize: 10 }}>{e.project.name}</Tag>
                      )}
                    </div>
                    <Text strong style={{ fontSize: 14, color: c.text, whiteSpace: "nowrap" }}>
                      {fmtDuration(e.minutes)}
                    </Text>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 4, alignItems: "center" }}>
                    <div style={{
                      fontSize: 10, fontWeight: 600, color: c.text,
                      background: "rgba(0,0,0,0.06)", borderRadius: 3, padding: "1px 5px",
                      textTransform: "uppercase", letterSpacing: "0.04em",
                    }}>
                      {e.workType.replace(/_/g, " ")}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(e.loggedAt).format("h:mm A")}
                    </Text>
                    {e.notes && (
                      <Text type="secondary" style={{ fontSize: 12, fontStyle: "italic" }}>{e.notes}</Text>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      <Text strong style={{ fontSize: 11 }}>{fmtDays(e.minutes)}</Text>
                      {" "}({(e.minutes / MINS_PER_WEEK).toFixed(2)}w)
                    </Text>
                  </div>
                </div>
              </div>
            );
          })}
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <Button size="small" icon={<PlusOutlined />} onClick={onLogTime}>Log More</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TimesheetsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [view, setView]         = useState<ViewMode>("month");
  const [current, setCurrent]   = useState<Dayjs>(dayjs());
  const [selectedDay, setSelectedDay] = useState<Dayjs | null>(null);
  const [logOpen, setLogOpen]   = useState(false);
  const [logForm] = Form.useForm();
  const today = dayjs().format("YYYY-MM-DD");

  // Date range to fetch based on view
  const { startDate, endDate } = useMemo(() => {
    if (view === "month") {
      return {
        startDate: current.startOf("month").startOf("week").format("YYYY-MM-DD"),
        endDate:   current.endOf("month").endOf("week").format("YYYY-MM-DD"),
      };
    }
    if (view === "week") {
      return {
        startDate: current.startOf("week").format("YYYY-MM-DD"),
        endDate:   current.endOf("week").format("YYYY-MM-DD"),
      };
    }
    // day
    return {
      startDate: current.format("YYYY-MM-DD"),
      endDate:   current.format("YYYY-MM-DD"),
    };
  }, [view, current]);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["timesheets", startDate, endDate],
    queryFn: () => timesheetsApi.list({ startDate, endDate }),
  });

  // Group entries by YYYY-MM-DD
  const entriesByDay = useMemo(() => {
    const map = new Map<string, TimesheetEntry[]>();
    for (const e of entries) {
      const key = dayjs(e.loggedAt).format("YYYY-MM-DD");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [entries]);

  // Navigation labels
  const navLabel = useMemo(() => {
    if (view === "month") return current.format("MMMM YYYY");
    if (view === "week") {
      const s = current.startOf("week");
      const e = current.endOf("week");
      return s.month() === e.month()
        ? `${s.format("D")} – ${e.format("D MMM YYYY")}`
        : `${s.format("D MMM")} – ${e.format("D MMM YYYY")}`;
    }
    return current.format("dddd, D MMMM YYYY");
  }, [view, current]);

  function navigate(dir: -1 | 1) {
    if (view === "month") setCurrent((c) => c.add(dir, "month"));
    else if (view === "week") setCurrent((c) => c.add(dir, "week"));
    else setCurrent((c) => c.add(dir, "day"));
  }

  function goToday() { setCurrent(dayjs()); }

  function handleDayClick(day: Dayjs) {
    setSelectedDay(day);
    setView("day");
    setCurrent(day);
  }

  const dayEntries = selectedDay
    ? (entriesByDay.get(selectedDay.format("YYYY-MM-DD")) ?? [])
    : (entriesByDay.get(current.format("YYYY-MM-DD")) ?? []);

  // Total for the current view window
  const totalMins = entries.reduce((s, e) => s + e.minutes, 0);

  // Only fetch tickets the current user is involved with (assigned or reported)
  // The backend already filters by user for EMPLOYEE role; for others we request their assigned tickets
  const { data: myTickets = [] } = useQuery({
    queryKey: ["my-tickets", user?.id],
    queryFn: () => ticketsApi.list({ assigneeId: user?.id, pageSize: 200 }),
    select: (res) => res.items,
    enabled: logOpen && !!user,
  });
  const { data: reportedTickets = [] } = useQuery({
    queryKey: ["reported-tickets", user?.id],
    queryFn: () => ticketsApi.list({ pageSize: 200 }),
    select: (res) => res.items,
    enabled: logOpen && !!user && (user.role === "FOUNDER" || user.role === "MANAGER" || user.role === "CFO"),
  });

  // Merge and deduplicate
  const logTickets = useMemo(() => {
    const seen = new Set<string>();
    const combined = [...myTickets, ...reportedTickets];
    return combined.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [myTickets, reportedTickets]);

  const logMutation = useMutation({
    mutationFn: async (values: any) => {
      if (values.ticketId) {
        return ticketsApi.logTime(values.ticketId, values.minutes, values.notes, values.workType);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheets"] });
      logForm.resetFields();
      setLogOpen(false);
      message.success("Time logged");
    },
    onError: () => message.error("Failed to log time"),
  });

  return (
    <div className="workspace-viewport" style={{ display: "flex", flexDirection: "column", minHeight: 500 }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 12, flexWrap: "wrap", gap: 8,
      }}>
        <Space size={4}>
          <Button size="small" icon={<LeftOutlined />} onClick={() => navigate(-1)} />
          <Button size="small" onClick={goToday}>Today</Button>
          <Button size="small" icon={<RightOutlined />} onClick={() => navigate(1)} />
        </Space>

        <div style={{ fontWeight: 600, fontSize: 16, flex: 1, textAlign: "center" }}>
          {navLabel}
        </div>

        <Space size={4}>
          {totalMins > 0 && (
            <Tag color="blue" style={{ fontSize: 12 }}>
              {fmtDuration(totalMins)} total
              <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
                ({(totalMins / MINS_PER_DAY).toFixed(1)}d)
              </Text>
            </Tag>
          )}
          <Button
            size="small" type="primary" icon={<PlusOutlined />}
            onClick={() => setLogOpen(true)}
          >
            Log Time
          </Button>
          <div style={{
            display: "inline-flex", border: "1px solid #d9d9d9", borderRadius: 6, overflow: "hidden",
          }}>
            {(["day","week","month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "3px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
                  background: view === v ? "#1677ff" : "#fff",
                  color: view === v ? "#fff" : "#595959",
                  border: "none", borderRight: v !== "month" ? "1px solid #d9d9d9" : "none",
                  outline: "none",
                }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </Space>
      </div>

      {/* ── Calendar body ── */}
      {isLoading ? (
        <Spin style={{ margin: "60px auto" }} />
      ) : view === "month" ? (
        <MonthView
          current={current}
          entriesByDay={entriesByDay}
          today={today}
          onDayClick={handleDayClick}
        />
      ) : view === "week" ? (
        <WeekView
          current={current}
          entriesByDay={entriesByDay}
          today={today}
          onDayClick={handleDayClick}
        />
      ) : (
        <DayView
          entries={dayEntries}
          onLogTime={() => setLogOpen(true)}
        />
      )}

      {/* ── Log Time Modal ── */}
      <Modal
        title={`Log Time${view === "day" ? ` — ${current.format("D MMM YYYY")}` : ""}`}
        open={logOpen}
        onCancel={() => setLogOpen(false)}
        footer={null}
        destroyOnHidden
        width={480}
      >
        <Form form={logForm} layout="vertical" onFinish={logMutation.mutate} style={{ marginTop: 16 }}>
          <Form.Item name="ticketId" label="Ticket" rules={[{ required: true, message: "Select a ticket" }]}>
            <Select showSearch placeholder="Search tickets assigned to or reported by you…" optionFilterProp="label"
              options={logTickets.map((t) => ({
                value: t.id,
                label: t.title,
                status: t.status,
              }))}
              optionRender={(opt) => (
                <Space size={6}>
                  <span style={{ fontSize: 11, color: "#8c8c8c" }}>{(opt.data as any).status?.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: 13 }}>{opt.data.label}</span>
                </Space>
              )}
            />
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="minutes" label="Duration (minutes)" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: "100%" }} placeholder="e.g. 90" />
            </Form.Item>
            <Form.Item name="workType" label="Work Type" initialValue="DEVELOPMENT">
              <Select>
                {WORK_TYPES.map((t) => (
                  <Option key={t} value={t}>{t.replace(/_/g, " ")}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="notes" label="Notes">
            <Input placeholder="What did you work on?" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
            <Button onClick={() => setLogOpen(false)} style={{ marginRight: 8 }}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={logMutation.isPending}>Log</Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
