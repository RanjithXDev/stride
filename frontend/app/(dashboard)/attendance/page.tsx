"use client";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Button, Card, Row, Col, Table, Tag, Avatar,
  Select, DatePicker, Space, Statistic, Badge, Spin, message,
  Segmented, Tooltip, Modal, Switch,
} from "antd";
import {
  LoginOutlined, LogoutOutlined, ClockCircleOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  TeamOutlined, UserOutlined, CalendarOutlined,
  EnvironmentOutlined, AimOutlined, HomeOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useAuthStore } from "@/store/auth";
import {
  attendanceApi, AttendanceRecord, AttendanceUser,
  TodayResponse, STATUS_CONFIG, AttendanceFilters,
} from "@/lib/attendance";
import { employeesApi } from "@/lib/employees";

dayjs.extend(duration);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

type GeoState = "idle" | "requesting" | "granted" | "denied" | "unavailable";
interface GeoCoords { latitude: number; longitude: number; address?: string }

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    const { road, suburb, city, town, village, state, country } = data.address ?? {};
    const parts = [road, suburb, city ?? town ?? village, state, country].filter(Boolean);
    return parts.slice(0, 3).join(", ");
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

/* ── Live Clock ─────────────────────────────────────────────────────── */
function LiveClock() {
  const [time, setTime] = useState(() => dayjs());
  useEffect(() => {
    const id = setInterval(() => setTime(dayjs()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {time.format("hh:mm")}
        <span style={{ fontSize: 16, fontWeight: 500, marginLeft: 4, opacity: 0.7 }}>
          {time.format("ss")}
        </span>
        <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 6 }}>
          {time.format("A")}
        </span>
      </div>
      <div style={{ fontSize: 12, opacity: 0.6, marginTop: 2 }}>
        {time.format("ddd, DD MMM YYYY")}
      </div>
    </div>
  );
}

/* ── Live Duration Counter ──────────────────────────────────────────── */
function LiveDuration({ since, extraMinutes = 0 }: { since: string; extraMinutes?: number }) {
  const [mins, setMins] = useState(() =>
    Math.floor((Date.now() - new Date(since).getTime()) / 60000) + extraMinutes
  );
  useEffect(() => {
    const id = setInterval(() => {
      setMins(Math.floor((Date.now() - new Date(since).getTime()) / 60000) + extraMinutes);
    }, 30000);
    return () => clearInterval(id);
  }, [since, extraMinutes]);
  return <>{fmt(mins)}</>;
}

/* ── Check-In Bar (always visible at top) ───────────────────────────── */
function CheckInBar() {
  const queryClient = useQueryClient();
  const [geoState, setGeoState]     = useState<GeoState>("idle");
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [isWFH, setIsWFH]           = useState(false);

  const { data: todayData, isLoading } = useQuery<TodayResponse>({
    queryKey: ["attendance-today"],
    queryFn: attendanceApi.getToday,
    refetchInterval: 30000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["attendance-today"] });
    queryClient.invalidateQueries({ queryKey: ["attendance"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-team-today"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-stats"] });
  }, [queryClient]);

  const checkInMutation = useMutation({
    mutationFn: (payload?: GeoCoords) =>
      attendanceApi.checkIn({ ...payload, workMode: isWFH ? "WFH" : "OFFICE" }),
    onSuccess: () => { invalidate(); message.success(isWFH ? "Checked in (WFH)!" : "Checked in!"); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Check-in failed"),
  });

  const checkOutMutation = useMutation({
    mutationFn: attendanceApi.checkOut,
    onSuccess: () => { invalidate(); message.success("Checked out!"); },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Check-out failed"),
  });

  function doGetLocation(onDone: (geo?: GeoCoords) => void) {
    if (!navigator.geolocation) { setGeoState("unavailable"); onDone(undefined); return; }
    setGeoState("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setGeoState("granted");
        const { latitude, longitude } = pos.coords;
        const address = await reverseGeocode(latitude, longitude);
        onDone({ latitude, longitude, address });
      },
      () => { setGeoState("denied"); onDone(undefined); },
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  function handleCheckIn() { setLocModalOpen(true); }
  function handleLocationAllow() { setLocModalOpen(false); doGetLocation((geo) => checkInMutation.mutate(geo)); }
  function handleLocationSkip()  { setLocModalOpen(false); checkInMutation.mutate(undefined); }

  const sessions      = todayData?.sessions      ?? [];
  const hasActive     = todayData?.hasActive      ?? false;
  const activeSession = todayData?.activeSession  ?? null;
  const totalMinutes  = todayData?.totalMinutes   ?? 0;
  const dayStatus     = todayData?.dayStatus      ?? null;
  const hasSessions   = sessions.length > 0;

  const accent = hasActive ? "#1677ff" : hasSessions ? "#52c41a" : "#fa8c16";
  const barBg  = hasActive
    ? "linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%)"
    : hasSessions
      ? "linear-gradient(135deg, #f6ffed 0%, #e6f4ff 100%)"
      : "linear-gradient(135deg, #fff7e6 0%, #fff1f0 100%)";

  return (
    <>
      <Card
        style={{ background: barBg, border: `1.5px solid ${accent}44`, marginBottom: 20, borderRadius: 12 }}
        styles={{ body: { padding: "16px 24px" } }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap", justifyContent: "space-between" }}>

          {/* Clock */}
          <LiveClock />

          {/* Status */}
          <div style={{ flex: 1, minWidth: 220 }}>
            {isLoading ? <Spin size="small" /> : (
              <>
                {/* Main status line */}
                {hasActive ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <Badge status="processing" />
                      <Text style={{ fontWeight: 600, fontSize: 15 }}>Currently In</Text>
                      <Tag color="blue" style={{ fontSize: 11 }}>
                        Session {sessions.length}
                      </Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Since {dayjs(activeSession!.checkIn).format("hh:mm A")}
                      {activeSession?.address && (
                        <span style={{ marginLeft: 8 }}>
                          <EnvironmentOutlined style={{ color: "#1677ff", marginRight: 3 }} />
                          {activeSession.address}
                        </span>
                      )}
                    </Text>
                    {totalMinutes > 0 && (
                      <Text type="secondary" style={{ fontSize: 12, marginTop: 2, display: "block" }}>
                        Total today:{" "}
                        <Text style={{ fontWeight: 600, color: "#1677ff" }}>
                          <LiveDuration since={activeSession!.checkIn} extraMinutes={totalMinutes} />
                        </Text>
                      </Text>
                    )}
                  </div>
                ) : hasSessions ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <CheckCircleOutlined style={{ color: "#52c41a", fontSize: 16 }} />
                      <Text style={{ fontWeight: 600, fontSize: 15 }}>Checked Out</Text>
                      {dayStatus && <Tag color={STATUS_CONFIG[dayStatus].color}>{STATUS_CONFIG[dayStatus].label}</Tag>}
                    </div>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Total worked today:{" "}
                      <Text style={{ fontWeight: 600 }}>{fmt(totalMinutes)}</Text>
                      {" "}across {sessions.filter(s => s.checkOut).length} session{sessions.filter(s => s.checkOut).length !== 1 ? "s" : ""}
                    </Text>
                  </div>
                ) : (
                  <div>
                    <Text style={{ fontWeight: 600, fontSize: 15, display: "block" }}>Not Checked In</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>Mark your attendance for today</Text>
                    {geoState === "requesting" && (
                      <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                        <AimOutlined spin style={{ marginRight: 4 }} />Getting your location…
                      </Text>
                    )}
                    {geoState === "denied" && (
                      <Text style={{ fontSize: 12, color: "#fa8c16", display: "block", marginTop: 4 }}>
                        <EnvironmentOutlined style={{ marginRight: 4 }} />Location denied — checking in without location
                      </Text>
                    )}
                  </div>
                )}

                {/* Session timeline — shown when 2+ sessions or when checked out */}
                {sessions.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {sessions.map((s, i) => (
                      <Tooltip
                        key={s.id}
                        title={
                          s.checkOut
                            ? `Session ${i + 1}: ${dayjs(s.checkIn).format("hh:mm A")} → ${dayjs(s.checkOut).format("hh:mm A")} (${fmt(s.duration ?? 0)})`
                            : `Session ${i + 1}: ${dayjs(s.checkIn).format("hh:mm A")} → active`
                        }
                      >
                        <div style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: s.checkOut ? "#f6ffed" : "#e6f7ff",
                          border: `1px solid ${s.checkOut ? "#b7eb8f" : "#91caff"}`,
                          borderRadius: 6, padding: "2px 8px", fontSize: 11,
                          color: s.checkOut ? "#52c41a" : "#1677ff", cursor: "default",
                        }}>
                          <span style={{ fontWeight: 600 }}>S{i + 1}</span>
                          <span>{dayjs(s.checkIn).format("HH:mm")}</span>
                          {s.checkOut && <span>→ {dayjs(s.checkOut).format("HH:mm")}</span>}
                          {s.checkOut && s.duration != null && <span style={{ opacity: 0.8 }}>· {fmt(s.duration)}</span>}
                          {!s.checkOut && <Badge status="processing" />}
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action button */}
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            {!hasActive && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <HomeOutlined style={{ color: isWFH ? "#722ed1" : "#bbb", fontSize: 14 }} />
                <Switch
                  size="small"
                  checked={isWFH}
                  onChange={setIsWFH}
                  style={{ background: isWFH ? "#722ed1" : undefined }}
                />
                <span style={{ fontSize: 12, color: isWFH ? "#722ed1" : "#888", fontWeight: isWFH ? 600 : 400 }}>
                  WFH
                </span>
              </div>
            )}
            {!hasActive && (
              <Button
                type="primary"
                size="large"
                icon={<LoginOutlined />}
                loading={checkInMutation.isPending || geoState === "requesting"}
                onClick={handleCheckIn}
                style={{
                  height: 52, paddingInline: 36, fontSize: 15, fontWeight: 600, borderRadius: 8,
                  background: hasSessions ? "#52c41a" : "#1677ff",
                  borderColor: hasSessions ? "#52c41a" : "#1677ff",
                  boxShadow: `0 4px 12px ${hasSessions ? "rgba(82,196,26,.3)" : "rgba(22,119,255,.3)"}`,
                }}
              >
                {hasSessions ? "Re-check In" : "Check In"}
              </Button>
            )}
            {hasActive && (
              <Button
                danger
                size="large"
                icon={<LogoutOutlined />}
                loading={checkOutMutation.isPending}
                onClick={() => checkOutMutation.mutate()}
                style={{
                  height: 52, paddingInline: 36, fontSize: 15, fontWeight: 600, borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(255,77,79,.25)",
                }}
              >
                Check Out
              </Button>
            )}
            {hasSessions && (
              <Text type="secondary" style={{ fontSize: 11, textAlign: "right" }}>
                {sessions.length} session{sessions.length !== 1 ? "s" : ""} · {fmt(totalMinutes)} worked
              </Text>
            )}
          </div>
        </div>
      </Card>

      {/* Location permission modal */}
      <Modal
        open={locModalOpen}
        onCancel={() => setLocModalOpen(false)}
        footer={null}
        width={420}
        centered
        title={<Space><EnvironmentOutlined style={{ color: "#1677ff" }} /><span>Share Your Location?</span></Space>}
      >
        <div style={{ padding: "4px 0 8px" }}>
          <Text style={{ display: "block", marginBottom: 12, fontSize: 14, lineHeight: 1.6 }}>
            Your browser will ask permission to access your location. This helps record where you checked in — it&apos;s completely optional.
          </Text>
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            background: "var(--app-subtle)", borderRadius: 8, padding: "10px 12px", marginBottom: 20,
          }}>
            <EnvironmentOutlined style={{ color: "#1677ff", marginTop: 2, flexShrink: 0 }} />
            <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
              Your location is stored only for attendance records and visible only to managers.
            </Text>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Button
              type="primary"
              icon={<AimOutlined />}
              onClick={handleLocationAllow}
              block
              size="large"
              style={{ height: 44 }}
            >
              Allow Location &amp; Check In
            </Button>
            <Button
              onClick={handleLocationSkip}
              block
              size="large"
              style={{ height: 44 }}
            >
              Skip — Check In Without Location
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ── Stats Row ──────────────────────────────────────────────────────── */
function StatsRow({ userId, month, year }: { userId?: string; month: number; year: number }) {
  const { data: stats } = useQuery({
    queryKey: ["attendance-stats", userId, month, year],
    queryFn: () => attendanceApi.stats({ userId, month, year }),
  });

  if (!stats) return null;

  return (
    <Row gutter={[12, 12]}>
      {[
        { title: "Present",     value: stats.present,    color: "#52c41a", icon: <CheckCircleOutlined /> },
        { title: "Late",        value: stats.late,       color: "#fa8c16", icon: <ExclamationCircleOutlined /> },
        { title: "Half Day",    value: stats.halfDay,    color: "#1677ff", icon: <ClockCircleOutlined /> },
        { title: "Total Days",  value: stats.totalDays,  color: "#722ed1", icon: <CalendarOutlined /> },
        { title: "Total Hours", value: stats.totalHours, color: "#13c2c2", icon: <ClockCircleOutlined />, suffix: "h" },
      ].map((s) => (
        <Col key={s.title} xs={12} sm={8} md={4} lg={4}>
          <Card styles={{ body: { padding: "14px 16px" } }} style={{ borderRadius: 8 }}>
            <Statistic
              title={s.title}
              value={s.value}
              suffix={s.suffix}
              valueStyle={{ color: s.color, fontSize: 22 }}
              prefix={s.icon}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

/* ── Team Today Panel ───────────────────────────────────────────────── */
function TeamTodayPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-team-today"],
    queryFn: attendanceApi.teamToday,
    refetchInterval: 60000,
  });

  if (isLoading) return <Spin />;
  if (!data) return null;

  const presentCols = [
    {
      title: "Employee",
      render: (_: any, r: AttendanceRecord) => (
        <Space>
          <Avatar size={28} style={{ background: "#1677ff", fontSize: 12 }}>
            {r.user.name.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{r.user.name}</div>
            <div style={{ fontSize: 11, color: "#888" }}>{r.user.department?.name ?? r.user.role}</div>
          </div>
        </Space>
      ),
    },
    {
      title: "In",
      render: (_: any, r: AttendanceRecord) => (
        <Text style={{ fontSize: 13 }}>{dayjs(r.checkIn).format("hh:mm A")}</Text>
      ),
      width: 90,
    },
    {
      title: "Out",
      render: (_: any, r: AttendanceRecord) => r.checkOut
        ? <Text style={{ fontSize: 13 }}>{dayjs(r.checkOut).format("hh:mm A")}</Text>
        : <Badge status="processing" text="Active" />,
      width: 110,
    },
    {
      title: "Status",
      render: (_: any, r: AttendanceRecord) => {
        const c = STATUS_CONFIG[r.status];
        return <Tag color={c.color}>{c.label}</Tag>;
      },
      width: 100,
    },
    {
      title: "Location",
      render: (_: any, r: AttendanceRecord) => r.address
        ? (
          <Tooltip title={r.latitude ? `${r.latitude.toFixed(5)}, ${r.longitude?.toFixed(5)}` : ""}>
            <Text style={{ fontSize: 12 }}>
              <EnvironmentOutlined style={{ marginRight: 4, color: "#1677ff" }} />
              {r.address}
            </Text>
          </Tooltip>
        )
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
  ];

  return (
    <Row gutter={16}>
      <Col xs={24} md={16}>
        <Card
          title={
            <Space>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <span>Present Today ({data.present.length})</span>
            </Space>
          }
          styles={{ body: { padding: 0 } }}
          style={{ borderRadius: 8 }}
        >
          <Table
            dataSource={data.present}
            columns={presentCols}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{ emptyText: "No one checked in yet" }}
          />
        </Card>
      </Col>
      <Col xs={24} md={8}>
        <Card
          title={
            <Space>
              <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />
              <span>Not Yet In ({data.absent.length})</span>
            </Space>
          }
          style={{ borderRadius: 8 }}
        >
          {data.absent.length === 0 ? (
            <Text type="secondary">Everyone is in!</Text>
          ) : (
            <div>
              {data.absent.map((u: AttendanceUser) => (
                <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Avatar size={24} style={{ background: "#bfbfbf", fontSize: 11 }}>
                    {u.name.charAt(0)}
                  </Avatar>
                  <div>
                    <div style={{ fontSize: 13 }}>{u.name}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>{u.department?.name ?? u.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Col>
    </Row>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function AttendancePage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isManager = user?.role !== "EMPLOYEE";

  const [view, setView]           = useState<"my" | "team">(isManager ? "team" : "my");
  const [selectedUser, setSelectedUser] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [page, setPage]           = useState(1);

  const fillAbsencesMut = useMutation({
    mutationFn: () => {
      const yesterday = dayjs().subtract(1, "day");
      const start = dateRange ? dateRange[0].format("YYYY-MM-DD") : dayjs().subtract(30, "day").format("YYYY-MM-DD");
      const end   = dateRange ? dateRange[1].format("YYYY-MM-DD") : yesterday.format("YYYY-MM-DD");
      return attendanceApi.fillAbsences(start, end);
    },
    onSuccess: (data: any) => {
      const total = data?.results?.reduce((s: number, r: any) => s + r.marked, 0) ?? 0;
      message.success(`Filled ${total} absent record${total !== 1 ? "s" : ""}`);
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-stats"] });
    },
    onError: () => message.error("Failed to fill absences"),
  });

  const now = dayjs();
  const [statsMonth] = useState(now.month() + 1);
  const [statsYear]  = useState(now.year());

  const filters: AttendanceFilters = {
    page,
    pageSize: 30,
    userId: view === "my" ? user?.id : selectedUser,
    ...(dateRange ? {
      startDate: dateRange[0].format("YYYY-MM-DD"),
      endDate:   dateRange[1].format("YYYY-MM-DD"),
    } : {}),
  };

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ["attendance", filters],
    queryFn: () => attendanceApi.list(filters),
    placeholderData: (prev) => prev,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesApi.list({ isActive: true }),
    enabled: isManager,
  });

  const records = listData?.items ?? [];
  const total   = listData?.total ?? 0;

  const columns = [
    {
      title: "Date",
      dataIndex: "date",
      render: (d: string) => (
        <Text style={{ fontSize: 13, fontWeight: 500 }}>
          {dayjs(d).format("ddd, DD MMM YYYY")}
        </Text>
      ),
      width: 160,
    },
    ...(view === "team" ? [{
      title: "Employee",
      render: (_: any, r: AttendanceRecord) => (
        <Space>
          <Avatar size={24} style={{ background: "#1677ff", fontSize: 11 }}>
            {r.user.name.charAt(0)}
          </Avatar>
          <div>
            <div style={{ fontSize: 13 }}>{r.user.name}</div>
            <div style={{ fontSize: 11, color: "#888" }}>{r.user.department?.name}</div>
          </div>
        </Space>
      ),
      width: 180,
    }] : []),
    {
      title: "Check In",
      render: (_: any, r: AttendanceRecord) => (
        <Text style={{ fontSize: 13 }}>{dayjs(r.checkIn).format("hh:mm A")}</Text>
      ),
      width: 100,
    },
    {
      title: "Check Out",
      render: (_: any, r: AttendanceRecord) => r.checkOut
        ? <Text style={{ fontSize: 13 }}>{dayjs(r.checkOut).format("hh:mm A")}</Text>
        : <Badge status="processing" text="Active" />,
      width: 110,
    },
    {
      title: "Duration",
      render: (_: any, r: AttendanceRecord) => r.duration != null
        ? <Text style={{ fontSize: 13 }}>{fmt(r.duration)}</Text>
        : <Text type="secondary">—</Text>,
      width: 90,
    },
    {
      title: "Status",
      render: (_: any, r: AttendanceRecord) => {
        const c = STATUS_CONFIG[r.status];
        return <Tag color={c.color}>{c.label}</Tag>;
      },
      width: 100,
    },
    {
      title: "Location",
      render: (_: any, r: AttendanceRecord) => r.address
        ? (
          <Tooltip title={r.latitude ? `${r.latitude.toFixed(5)}, ${r.longitude?.toFixed(5)}` : ""}>
            <Text style={{ fontSize: 12 }}>
              <EnvironmentOutlined style={{ marginRight: 4, color: "#1677ff" }} />
              {r.address}
            </Text>
          </Tooltip>
        )
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>

      {/* Page header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 20,
      }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Attendance</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Track your check-in, check-out and work hours
          </Text>
        </div>
        <Space wrap>
          {isManager && (
            <Segmented
              value={view}
              onChange={(v) => { setView(v as "my" | "team"); setPage(1); }}
              options={[
                { label: <Space><UserOutlined /> My Attendance</Space>, value: "my" },
                { label: <Space><TeamOutlined /> Team</Space>,          value: "team" },
              ]}
            />
          )}
          {isManager && (
            <Tooltip title="Mark absent for all employees who didn't check in on past days (within selected date range or last 30 days)">
              <Button
                icon={<SyncOutlined />}
                size="small"
                loading={fillAbsencesMut.isPending}
                onClick={() => fillAbsencesMut.mutate()}
              >
                Fill Absences
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Always-visible check-in bar */}
      <CheckInBar />

      {/* My stats */}
      {view === "my" && (
        <Card
          title={<Space><CalendarOutlined /> This Month</Space>}
          style={{ marginBottom: 20, borderRadius: 8 }}
          styles={{ body: { paddingBottom: 4 } }}
        >
          <StatsRow userId={user?.id} month={statsMonth} year={statsYear} />
        </Card>
      )}

      {/* Team view */}
      {view === "team" && (
        <>
          <div style={{ marginBottom: 20 }}>
            <Title level={5} style={{ marginBottom: 12 }}>Today's Overview</Title>
            <TeamTodayPanel />
          </div>
          <div style={{ marginBottom: 20 }}>
            <Title level={5} style={{ marginBottom: 12 }}>Monthly Stats (All Team)</Title>
            <StatsRow month={statsMonth} year={statsYear} />
          </div>
        </>
      )}

      {/* History table */}
      <Card
        title={
          <Space>
            <CalendarOutlined />
            <span>{view === "my" ? "My History" : "Attendance Log"}</span>
          </Space>
        }
        extra={
          <Space wrap>
            {view === "team" && (
              <Select
                allowClear
                placeholder="Filter by employee"
                style={{ width: 200 }}
                showSearch
                optionFilterProp="label"
                onChange={(v) => { setSelectedUser(v); setPage(1); }}
                options={employees.map((e) => ({ value: e.id, label: e.name }))}
              />
            )}
            <RangePicker
              size="small"
              onChange={(dates) => {
                setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null);
                setPage(1);
              }}
              style={{ width: 220 }}
            />
          </Space>
        }
        style={{ borderRadius: 8 }}
      >
        <Table
          dataSource={records}
          columns={columns}
          rowKey="id"
          loading={listLoading}
          size="small"
          pagination={{
            current: page,
            pageSize: 30,
            total,
            onChange: (p) => setPage(p),
            showTotal: (t) => `${t} records`,
            showSizeChanger: false,
          }}
          locale={{ emptyText: "No attendance records found" }}
          scroll={{ x: 700 }}
        />
      </Card>
    </div>
  );
}
