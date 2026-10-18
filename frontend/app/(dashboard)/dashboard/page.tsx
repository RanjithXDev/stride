"use client";
import { useQuery } from "@tanstack/react-query";
import { Typography, Tag, Spin, Progress, theme as antTheme } from "antd";
import {
  TeamOutlined, ProjectOutlined, TagsOutlined, DollarOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined, CheckCircleOutlined,
  ArrowRightOutlined, LoginOutlined, RiseOutlined,
  FileTextOutlined, FieldTimeOutlined,
  CalendarOutlined, WarningOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dayjs from "dayjs";
import api from "@/lib/api";
import { attendanceApi, TodayResponse, STATUS_CONFIG } from "@/lib/attendance";
import { useAuthStore } from "@/store/auth";
import { StatusTag, PriorityTag } from "@/components/tickets/TicketStatusBadge";
import { STATUS_LABELS, CATEGORY_LABELS } from "@/lib/expenses";
import styles from "./dashboard.module.css";

const { Text } = Typography;

/* ── helpers ──────────────────────────────────────────────────────── */
const fmtINR = (n: number | string) =>
  `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

function greeting(name: string) {
  const h = new Date().getHours();
  const salut = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  return `${salut}, ${name.split(" ")[0]}`;
}

/* ── Metric Card ──────────────────────────────────────────────────── */
function MetricCard({
  label, value, sub, icon, accent, onClick,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; accent: string; onClick?: () => void;
}) {
  const { token } = antTheme.useToken();
  return (
    <div
      onClick={onClick}
      className={`${styles.metricCard} ${onClick ? styles.clickable : ""}`}
      style={{
        "--metric-accent": accent,
        background: token.colorBgContainer,
        borderColor: token.colorBorderSecondary,
      } as React.CSSProperties}
    >
      <div className={styles.metricContent}>
        <div>
          <div className={styles.metricLabel} style={{ color: token.colorTextSecondary }}>
            {label}
          </div>
          <div className={styles.metricValue} style={{ color: token.colorText }}>
            {value}
          </div>
          {sub && <div className={styles.metricSub} style={{ color: token.colorTextSecondary }}>{sub}</div>}
        </div>
        <div className={styles.metricIcon} style={{ background: `${accent}18`, color: accent }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ── Section Header ───────────────────────────────────────────────── */
function SectionHead({ title, action, href }: { title: string; action?: string; href?: string }) {
  const { token } = antTheme.useToken();
  return (
    <div className={styles.sectionHead}>
      <Text style={{ color: token.colorText }}>{title}</Text>
      {action && href && (
        <Link href={href} className={styles.sectionAction}>
          {action} <ArrowRightOutlined style={{ fontSize: 10 }} />
        </Link>
      )}
    </div>
  );
}

/* ── Panel ────────────────────────────────────────────────────────── */
function Panel({ children, style, onClick }: { children: React.ReactNode; style?: React.CSSProperties; onClick?: () => void }) {
  const { token } = antTheme.useToken();
  return (
    <div className={styles.panel} onClick={onClick} style={{ background: token.colorBgContainer, borderColor: token.colorBorderSecondary, ...style }}>
      {children}
    </div>
  );
}

type ProjectPulse = {
  id: string;
  name: string;
  status: string;
  deadline?: string | null;
  tickets?: Array<{ status: string; priority?: string; dueDate?: string | null }>;
  _count?: { members?: number };
};

const completedTicket = (status: string) => status === "RESOLVED" || status === "CLOSED";

function projectHealth(project: ProjectPulse) {
  const tickets = project.tickets ?? [];
  const complete = tickets.filter((ticket) => completedTicket(ticket.status)).length;
  const progress = tickets.length ? Math.round((complete / tickets.length) * 100) : 0;
  const overdue = tickets.filter((ticket) =>
    ticket.dueDate && !completedTicket(ticket.status) && dayjs(ticket.dueDate).isBefore(dayjs(), "day")
  ).length;
  const deadlineRisk = project.deadline && project.status !== "COMPLETED" && dayjs(project.deadline).isBefore(dayjs(), "day");
  const highPriority = tickets.filter((ticket) =>
    !completedTicket(ticket.status) && (ticket.priority === "HIGH" || ticket.priority === "URGENT")
  ).length;
  return { complete, progress, overdue, highPriority, atRisk: Boolean(deadlineRisk || overdue > 0) };
}

function PortfolioChart({ projects }: { projects: ProjectPulse[] }) {
  const { token } = antTheme.useToken();
  const statuses = [
    { key: "ACTIVE", label: "Active", color: "#1677ff" },
    { key: "PLANNING", label: "Planning", color: "#8b5cf6" },
    { key: "ON_HOLD", label: "On hold", color: "#f59e0b" },
    { key: "COMPLETED", label: "Completed", color: "#16a34a" },
  ];
  const total = projects.length;
  let cursor = 0;
  const stops = statuses.map((status) => {
    const count = projects.filter((project) => project.status === status.key).length;
    const start = cursor;
    cursor += total ? (count / total) * 100 : 0;
    return { ...status, count, start, end: cursor };
  });
  const gradient = total
    ? `conic-gradient(${stops.filter((item) => item.count).map((item) => `${item.color} ${item.start}% ${item.end}%`).join(", ")})`
    : token.colorBorderSecondary;

  return (
    <Panel>
      <SectionHead title="Project Portfolio" action="Open projects" href="/projects" />
      <div className={styles.portfolioChart}>
        <div className={styles.donut} style={{ background: gradient }}>
          <div className={styles.donutCenter} style={{ background: token.colorBgContainer }}>
            <strong style={{ color: token.colorText }}>{total}</strong>
            <span style={{ color: token.colorTextSecondary }}>projects</span>
          </div>
        </div>
        <div className={styles.chartLegend}>
          {stops.map((item) => (
            <div className={styles.legendRow} key={item.key}>
              <span className={styles.legendDot} style={{ background: item.color }} />
              <span style={{ color: token.colorTextSecondary }}>{item.label}</span>
              <strong style={{ color: token.colorText }}>{item.count}</strong>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function ProjectTracker({ projects, title = "Project Health" }: { projects: ProjectPulse[]; title?: string }) {
  const router = useRouter();
  const { token } = antTheme.useToken();
  const ranked = [...projects].sort((a, b) => {
    const aHealth = projectHealth(a), bHealth = projectHealth(b);
    return Number(bHealth.atRisk) - Number(aHealth.atRisk) || bHealth.highPriority - aHealth.highPriority;
  });

  return (
    <Panel>
      <SectionHead title={title} action="View all" href="/projects" />
      {ranked.length === 0 ? <Text type="secondary">No projects to track yet</Text> : (
        <div className={styles.projectList}>
          {ranked.slice(0, 6).map((project) => {
            const health = projectHealth(project);
            const accent = health.atRisk ? "#ef4444" : health.progress >= 75 ? "#16a34a" : "#1677ff";
            return (
              <button className={styles.projectRow} key={project.id} onClick={() => router.push(`/projects/${project.id}`)}>
                <div className={styles.projectTopline}>
                  <div className={styles.projectIdentity}>
                    <span className={styles.projectMark} style={{ background: `${accent}18`, color: accent }}>{project.name.charAt(0).toUpperCase()}</span>
                    <div>
                      <strong style={{ color: token.colorText }}>{project.name}</strong>
                      <span style={{ color: token.colorTextSecondary }}>
                        {project.tickets?.length ?? 0} tickets · {project._count?.members ?? 0} members
                      </span>
                    </div>
                  </div>
                  <div className={styles.healthMeta}>
                    {health.atRisk && <span className={styles.riskBadge}><WarningOutlined /> At risk</span>}
                    <strong style={{ color: accent }}>{health.progress}%</strong>
                  </div>
                </div>
                <div className={styles.progressTrack} style={{ background: token.colorBorderSecondary }}>
                  <span style={{ width: `${health.progress}%`, background: accent }} />
                </div>
                <div className={styles.projectFooter} style={{ color: token.colorTextSecondary }}>
                  <span>{health.complete} completed</span>
                  <span><CalendarOutlined /> {project.deadline ? dayjs(project.deadline).format("D MMM YYYY") : "No deadline"}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function fmtMin(m: number) {
  const h = Math.floor(m / 60), mins = m % 60;
  return mins > 0 ? `${h}h ${mins}m` : `${h}h`;
}

/* ── Attendance Mini Widget ───────────────────────────────────────── */
function AttendanceWidget() {
  const router = useRouter();
  const { token } = antTheme.useToken();
  const { data: todayData, isLoading } = useQuery<TodayResponse>({
    queryKey: ["attendance-today"],
    queryFn: attendanceApi.getToday,
  });

  if (isLoading) return (
    <Panel style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <Spin size="small" />
      <Text type="secondary" style={{ fontSize: 13 }}>Loading attendance…</Text>
    </Panel>
  );

  const sessions     = todayData?.sessions ?? [];
  const hasActive    = todayData?.hasActive ?? false;
  const totalMinutes = todayData?.totalMinutes ?? 0;
  const dayStatus    = todayData?.dayStatus ?? null;
  const active       = todayData?.activeSession;
  const hasSessions  = sessions.length > 0;

  const accent = hasActive ? "#1677ff" : hasSessions ? "#52c41a" : "#fa8c16";

  return (
    <Panel
      onClick={() => router.push("/attendance")}
      style={{ cursor: "pointer", borderLeft: `4px solid ${accent}` }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: `${accent}18`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>
            {hasActive
              ? <FieldTimeOutlined style={{ color: "#1677ff" }} />
              : hasSessions
                ? <CheckCircleOutlined style={{ color: "#52c41a" }} />
                : <LoginOutlined style={{ color: "#fa8c16" }} />}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
              {hasActive
                ? `In since ${dayjs(active!.checkIn).format("hh:mm A")}`
                : hasSessions
                  ? `${fmtMin(totalMinutes)} worked today`
                  : "Not checked in today"}
            </div>
            <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 2 }}>
              {hasActive
                ? `Session ${sessions.length} · ${fmtMin(totalMinutes)} prior sessions`
                : hasSessions
                  ? <>
                      {dayStatus && <Tag color={STATUS_CONFIG[dayStatus].color} style={{ fontSize: 11 }}>{STATUS_CONFIG[dayStatus].label}</Tag>}
                      {sessions.length} session{sessions.length !== 1 ? "s" : ""}
                    </>
                  : "Tap to mark attendance"}
            </div>
          </div>
        </div>
        <ArrowRightOutlined style={{ color: token.colorTextSecondary, fontSize: 12 }} />
      </div>
    </Panel>
  );
}

/* ── Ticket Row ───────────────────────────────────────────────────── */
function TicketList({ tickets, maxRows = 6 }: { tickets: any[]; maxRows?: number }) {
  const router = useRouter();
  const { token } = antTheme.useToken();
  return (
    <div>
      {tickets.slice(0, maxRows).map((t: any, i: number) => (
        <div
          key={t.id}
          onClick={() => router.push(`/tickets/${t.id}`)}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "9px 0",
            borderBottom: i < Math.min(tickets.length, maxRows) - 1 ? `1px solid ${token.colorBorderSecondary}` : "none",
            cursor: "pointer",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: token.colorText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t.title}
            </div>
            <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
              {t.assignee?.name ?? "Unassigned"} · {dayjs(t.updatedAt).format("MMM D")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <StatusTag status={t.status} />
            <PriorityTag priority={t.priority} />
          </div>
        </div>
      ))}
      {tickets.length === 0 && (
        <Text type="secondary" style={{ fontSize: 13 }}>No open tickets</Text>
      )}
    </div>
  );
}

/* ── Expense Approval Row ─────────────────────────────────────────── */
function ExpenseApprovalList({ items }: { items: any[] }) {
  const router = useRouter();
  const { token } = antTheme.useToken();
  return (
    <div>
      {items.map((e: any, i: number) => (
        <div
          key={e.id}
          onClick={() => router.push(`/expenses/${e.id}`)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 0",
            borderBottom: i < items.length - 1 ? `1px solid ${token.colorBorderSecondary}` : "none",
            cursor: "pointer",
          }}
        >
          <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: token.colorText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {e.title}
            </div>
            <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
              <Tag style={{ fontSize: 10, padding: "0 4px" }}>
                {CATEGORY_LABELS[e.category as keyof typeof CATEGORY_LABELS] ?? e.category}
              </Tag>
              {e.submittedBy?.name} · {dayjs(e.createdAt).format("MMM D")}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <Text style={{ fontSize: 14, fontWeight: 700, color: "#1677ff", fontVariantNumeric: "tabular-nums" }}>
              {fmtINR(e.amount)}
            </Text>
            <ArrowRightOutlined style={{ fontSize: 11, color: token.colorTextSecondary }} />
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <Text type="secondary" style={{ fontSize: 13 }}>No pending approvals</Text>
      )}
    </div>
  );
}

/* ── FOUNDER DASH ─────────────────────────────────────────────────── */
function FounderDash({ data }: { data: any }) {
  const router = useRouter();
  const { token } = antTheme.useToken();
  const projectMap = Object.fromEntries((data.projects ?? []).map((p: any) => [p.status, p._count]));
  const ticketMap  = Object.fromEntries((data.tickets  ?? []).map((t: any) => [t.status, t._count]));
  const openTickets = (ticketMap.OPEN?._all ?? 0) + (ticketMap.IN_PROGRESS?._all ?? 0);
  const closedTickets = ticketMap.CLOSED?._all ?? 0;
  const totalTickets  = openTickets + closedTickets + (ticketMap.RESOLVED?._all ?? 0);
  const doneRatio = totalTickets > 0 ? Math.round(((closedTickets + (ticketMap.RESOLVED?._all ?? 0)) / totalTickets) * 100) : 0;
  const incomeMonth  = data.income?.monthly?.total ?? 0;
  const expenseMonth = data.expenses?.total ?? 0;
  const netMonth     = incomeMonth - expenseMonth;

  return (
    <div className={styles.dashboardStack}>

      {/* Metrics */}
      <div className={styles.metricGrid}>
        <MetricCard label="Active Employees"   value={data.employees}                                icon={<TeamOutlined />}    accent="#1677ff" onClick={() => router.push("/employees")} />
        <MetricCard label="Active Projects"    value={projectMap.ACTIVE?._all ?? 0}                 icon={<ProjectOutlined />} accent="#52c41a" onClick={() => router.push("/projects")} />
        <MetricCard label="Open Tickets"       value={openTickets}                                   icon={<TagsOutlined />}    accent="#fa8c16" onClick={() => router.push("/tickets")} />
        <MetricCard label="Income This Month"  value={fmtINR(incomeMonth)}                           icon={<RiseOutlined />}    accent="#52c41a" onClick={() => router.push("/income")}
          sub={`${data.income?.monthly?.count ?? 0} entr${(data.income?.monthly?.count ?? 0) !== 1 ? "ies" : "y"}`} />
        <MetricCard label="Expenses This Month" value={fmtINR(expenseMonth)}                         icon={<DollarOutlined />}  accent="#722ed1" onClick={() => router.push("/expenses")}
          sub={`${data.expenses?.count ?? 0} expense${(data.expenses?.count ?? 0) !== 1 ? "s" : ""}`} />
        <MetricCard label="Net This Month"     value={fmtINR(Math.abs(netMonth))}                    icon={<RiseOutlined />}    accent={netMonth >= 0 ? "#52c41a" : "#f5222d"}
          sub={netMonth >= 0 ? "Surplus" : "Deficit"} />
        <MetricCard label="Awaiting Approval"  value={data.pendingExpenses ?? 0}                     icon={<ClockCircleOutlined />} accent={data.pendingExpenses > 0 ? "#f5222d" : "#52c41a"} onClick={() => router.push("/expenses")} />
      </div>

      {/* Ticket resolution + expense pipeline */}
      <div className={styles.twoColumnGrid}>
        <PortfolioChart projects={data.projectSummaries ?? []} />
        <ProjectTracker projects={data.projectSummaries ?? []} />
      </div>

      <div className={styles.twoColumnGrid}>
        <Panel>
          <SectionHead title="Ticket Resolution" />
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
              {closedTickets + (ticketMap.RESOLVED?._all ?? 0)} of {totalTickets} resolved
            </Text>
            <Text style={{ fontSize: 12, fontWeight: 600, color: "#1677ff" }}>{doneRatio}%</Text>
          </div>
          <Progress percent={doneRatio} showInfo={false} strokeColor="#1677ff" trailColor={token.colorBorderSecondary} />
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            {(data.tickets ?? []).map((t: any) => (
              <div key={t.status} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background:
                  t.status === "OPEN" ? "#fa8c16" : t.status === "IN_PROGRESS" ? "#1677ff" :
                  t.status === "RESOLVED" ? "#52c41a" : "#8c8c8c" }} />
                <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                  {t.status.replace("_", " ")} <strong>{t._count._all}</strong>
                </Text>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionHead title="Expense Pipeline" action="Review all" href="/expenses" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
            {(data.expenses?.allByStatus ?? []).map((s: any) => (
              <div key={s.status} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Tag color={
                  s.status === "PAID"        ? "success"    :
                  s.status === "REJECTED"    ? "error"      :
                  s.status === "L1_APPROVED" ? "processing" :
                  s.status === "SUBMITTED"   ? "warning"    : "default"
                } style={{ fontSize: 11 }}>
                  {s.status.replace("_", " ")}
                </Tag>
                <Text style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>
                  {s._count}
                </Text>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Recent tickets */}
      <Panel>
        <SectionHead title="Recent Open Tickets" action="View all" href="/tickets" />
        <TicketList tickets={data.recentTickets ?? []} />
      </Panel>
    </div>
  );
}

/* ── CFO DASH ─────────────────────────────────────────────────────── */
function CFODash({ data }: { data: any }) {
  const router = useRouter();
  const { token } = antTheme.useToken();
  const sorted = [...(data.byCategory ?? [])].sort(
    (a: any, b: any) => Number(b._sum.amount) - Number(a._sum.amount)
  );
  const catTotal = sorted.reduce((s: number, c: any) => s + Number(c._sum.amount), 0);
  const netMonth = (data.income?.monthly?.total ?? 0) - (data.monthlySpend?.total ?? 0);

  return (
    <div className={styles.dashboardStack}>

      <div className={styles.metricGrid}>
        <MetricCard label="Income This Month"    value={fmtINR(data.income?.monthly?.total ?? 0)} icon={<RiseOutlined />}        accent="#52c41a"
          sub={`${data.income?.monthly?.count ?? 0} received`} onClick={() => router.push("/income")} />
        <MetricCard label="Income This Year"     value={fmtINR(data.income?.yearly?.total ?? 0)}  icon={<RiseOutlined />}        accent="#13c2c2"
          sub={`${data.income?.yearly?.count ?? 0} received`} onClick={() => router.push("/income")} />
        <MetricCard label="Expenses This Month"  value={fmtINR(data.monthlySpend?.total ?? 0)}    icon={<DollarOutlined />}      accent="#722ed1"
          sub={`${data.monthlySpend?.count ?? 0} expenses`} />
        <MetricCard label="Expenses This Year"   value={fmtINR(data.yearlySpend?.total ?? 0)}     icon={<DollarOutlined />}      accent="#1677ff"
          sub={`${data.yearlySpend?.count ?? 0} expenses`} />
        <MetricCard label="Net This Month"       value={fmtINR(Math.abs(netMonth))}                icon={<RiseOutlined />}        accent={netMonth >= 0 ? "#52c41a" : "#f5222d"}
          sub={netMonth >= 0 ? "Surplus" : "Deficit"} />
        <MetricCard label="Pending L2 Approval"  value={data.pendingL2?.length ?? 0}              icon={<ClockCircleOutlined />} accent={data.pendingL2?.length > 0 ? "#f5222d" : "#52c41a"}
          sub={data.pendingL2?.length > 0 ? "Needs your review" : "All clear"} />
      </div>

      <div className={styles.twoColumnGrid}>
        {/* Pending L2 */}
        <Panel style={{ borderLeft: (data.pendingL2?.length ?? 0) > 0 ? "4px solid #f5222d" : undefined }}>
          <SectionHead title="Awaiting Your Approval" action="View all" href="/expenses" />
          <ExpenseApprovalList items={data.pendingL2 ?? []} />
        </Panel>

        {/* Spend by category */}
        <Panel>
          <SectionHead title="Spend by Category (This Year)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {sorted.slice(0, 6).map((c: any) => {
              const pct = catTotal > 0 ? Math.round((Number(c._sum.amount) / catTotal) * 100) : 0;
              return (
                <div key={c.category}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
                      {CATEGORY_LABELS[c.category as keyof typeof CATEGORY_LABELS] ?? c.category}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: 600, color: token.colorText, fontVariantNumeric: "tabular-nums" }}>
                      {fmtINR(c._sum.amount)}
                    </Text>
                  </div>
                  <Progress percent={pct} showInfo={false} size="small" strokeColor="#722ed1" trailColor={token.colorBorderSecondary} />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ── MANAGER DASH ─────────────────────────────────────────────────── */
function ManagerDash({ data }: { data: any }) {
  const router = useRouter();

  return (
    <div className={styles.dashboardStack}>

      <div className={styles.metricGrid}>
        <MetricCard label="Team Size"           value={data.teamSize ?? 0}                         icon={<TeamOutlined />}           accent="#1677ff" onClick={() => router.push("/employees")} />
        <MetricCard label="Active Projects"     value={(data.myProjects ?? []).filter((p: any) => p.status === "ACTIVE").length} icon={<ProjectOutlined />} accent="#52c41a" onClick={() => router.push("/projects")} />
        <MetricCard label="Open Tickets"        value={(data.openTickets ?? []).length}             icon={<TagsOutlined />}           accent="#fa8c16" onClick={() => router.push("/tickets")} />
        <MetricCard label="Team Expenses"       value={fmtINR(data.teamExpenses?.total ?? 0)}       icon={<DollarOutlined />}         accent="#722ed1"
          sub={`${data.teamExpenses?.count ?? 0} this month`} />
        <MetricCard label="Pending Approvals"   value={(data.pendingL1 ?? []).length}               icon={<ExclamationCircleOutlined />} accent={(data.pendingL1 ?? []).length > 0 ? "#f5222d" : "#52c41a"}
          sub={(data.pendingL1 ?? []).length > 0 ? "Action needed" : "All clear"} />
      </div>

      {(data.pendingL1 ?? []).length > 0 && (
        <Panel style={{ borderLeft: "4px solid #f5222d" }}>
          <SectionHead title="Expense Approvals Needed" action="View all" href="/expenses" />
          <ExpenseApprovalList items={data.pendingL1} />
        </Panel>
      )}

      <div className={styles.twoColumnGrid}>
        <ProjectTracker projects={data.myProjects ?? []} title="Team Project Health" />

        <Panel>
          <SectionHead title="Team Open Tickets" action="View all" href="/tickets" />
          <TicketList tickets={data.openTickets ?? []} maxRows={5} />
        </Panel>
      </div>
    </div>
  );
}

/* ── EMPLOYEE DASH ────────────────────────────────────────────────── */
function EmployeeDash({ data }: { data: any }) {
  const router = useRouter();
  const { token } = antTheme.useToken();

  return (
    <div className={styles.dashboardStack}>

      <div className={styles.metricGrid}>
        <MetricCard label="My Open Tickets" value={(data.myTickets ?? []).length}   icon={<TagsOutlined />}    accent="#fa8c16" onClick={() => router.push("/tickets")} />
        <MetricCard label="My Projects"     value={(data.myProjects ?? []).length}  icon={<ProjectOutlined />} accent="#1677ff" onClick={() => router.push("/projects")} />
        <MetricCard label="My Expenses"     value={(data.myExpenses ?? []).length}  icon={<FileTextOutlined />} accent="#722ed1" onClick={() => router.push("/expenses")} />
      </div>

      <div className={styles.employeeGrid}>
        <Panel>
          <SectionHead title="My Open Tickets" action="View all" href="/tickets" />
          <TicketList tickets={data.myTickets ?? []} />
        </Panel>

        <Panel>
          <SectionHead title="Recent Expenses" action="View all" href="/expenses" />
          {(data.myExpenses ?? []).length === 0 ? (
            <Text type="secondary" style={{ fontSize: 13 }}>No expenses yet</Text>
          ) : (
            <div>
              {(data.myExpenses ?? []).map((e: any, i: number) => (
                <div
                  key={e.id}
                  onClick={() => router.push(`/expenses/${e.id}`)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "9px 0",
                    borderBottom: i < (data.myExpenses ?? []).length - 1 ? `1px solid ${token.colorBorderSecondary}` : "none",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, marginRight: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: token.colorText, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.title}
                    </div>
                    <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
                      <Tag color={STATUS_LABELS[e.status as keyof typeof STATUS_LABELS]?.color ?? "default"} style={{ fontSize: 10, padding: "0 4px" }}>
                        {STATUS_LABELS[e.status as keyof typeof STATUS_LABELS]?.label ?? e.status}
                      </Tag>
                      {dayjs(e.createdAt).format("MMM D")}
                    </div>
                  </div>
                  <Text style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#722ed1", flexShrink: 0 }}>
                    {fmtINR(e.amount)}
                  </Text>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <ProjectTracker projects={data.myProjects ?? []} title="My Project Progress" />
    </div>
  );
}

/* ── ROOT ─────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get("/dashboard").then((r) => r.data),
    enabled: !!user,
  });

  if (isLoading || !data) return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 80 }}>
      <Spin size="large" />
    </div>
  );

  const roleSubtitle: Record<string, string> = {
    FOUNDER:  "Company overview",
    CFO:      "Finance & approvals",
    MANAGER:  "Team overview",
    EMPLOYEE: "Your workspace",
  };

  return (
    <div className={styles.dashboardPage}>

      {/* Header */}
      <div className={styles.welcomePanel}>
        <div>
          <span className={styles.welcomeEyebrow}>{roleSubtitle[user?.role ?? "EMPLOYEE"]}</span>
          <h2>
            {user ? greeting(user.name) : "Dashboard"}
          </h2>
          <Text>Here&apos;s what&apos;s happening across your workspace today.</Text>
        </div>
        <div className={styles.datePill}><span>{dayjs().format("DD")}</span><div><strong>{dayjs().format("MMMM")}</strong><small>{dayjs().format("dddd, YYYY")}</small></div></div>
      </div>

      {/* Attendance widget — always at top */}
      <div className={styles.attendanceWrap}>
        <AttendanceWidget />
      </div>

      {/* Role dashboards */}
      {data.role === "FOUNDER"  && <FounderDash  data={data} />}
      {data.role === "CFO"      && <CFODash       data={data} />}
      {data.role === "MANAGER"  && <ManagerDash   data={data} />}
      {data.role === "EMPLOYEE" && <EmployeeDash  data={data} />}

    </div>
  );
}
