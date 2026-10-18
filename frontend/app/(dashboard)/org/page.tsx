"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Typography, Tag, Spin, Empty, Tooltip, Button, Modal, Form,
  Input, Select, message, Badge,
} from "antd";
import {
  ApartmentOutlined, UserOutlined, MinusOutlined, PlusOutlined,
  ApiOutlined, LinkOutlined, CloseCircleOutlined, SwapOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { employeesApi, OrgNode } from "@/lib/employees";
import { orgApi } from "@/lib/organization";
import { OrgSettings } from "@/types";
import { useAuthStore } from "@/store/auth";

const { Title, Text } = Typography;
const { Option } = Select;

/* ─── Constants ──────────────────────────────────────────────────────────── */
const ROLE_STYLE: Record<string, { bg: string; border: string; text: string; tag: string }> = {
  FOUNDER:   { bg: "#fff1f0", border: "#ff4d4f", text: "#cf1322", tag: "red"      },
  CPO:       { bg: "#fff0f6", border: "#eb2f96", text: "#c41d7f", tag: "magenta"  },
  CFO:       { bg: "#fff7e6", border: "#fa8c16", text: "#d46b08", tag: "volcano"  },
  HR:        { bg: "#e6fffb", border: "#13c2c2", text: "#006d75", tag: "cyan"     },
  MANAGER:   { bg: "#e6f4ff", border: "#1677ff", text: "#0958d9", tag: "blue"     },
  TEAM_LEAD: { bg: "#f0f5ff", border: "#597ef7", text: "#2f54eb", tag: "geekblue" },
  EMPLOYEE:  { bg: "#f6ffed", border: "#52c41a", text: "#389e0d", tag: "green"    },
};
const ROLE_LABELS: Record<string, string> = {
  FOUNDER:"Founder", CPO:"CPO", CFO:"CFO", HR:"HR Manager", MANAGER:"Manager", TEAM_LEAD:"Team Lead", EMPLOYEE:"Employee",
};
const ALL_ROLES = ["FOUNDER","CPO","CFO","HR","MANAGER","TEAM_LEAD","EMPLOYEE"];
const LINE_COLOR = "#d0d0d0";
const LINE_W = 2;
const STEM_H = 24;

/* ─── Shared state types ─────────────────────────────────────────────────── */
interface DragState {
  sourceId:   string;
  sourceName: string;
  portX: number; // viewport coords of source output port centre
  portY: number;
  curX: number;
  curY: number;
}

interface OrgPageCtx {
  mode:         "view" | "remap";
  dragging:     DragState | null;
  hoveredId:    string | null;
  onPortDown:   (e: React.MouseEvent, node: OrgNode) => void;
  onNodeEnter:  (id: string, name: string) => void;
  onNodeLeave:  () => void;
  onNodeUp:     (targetId: string, targetName: string) => void;
  onAddChild:   (managerNode: OrgNode) => void;
  canEdit:      boolean;
  roleLabels:   Record<string, string>;
  roleColors:   Record<string, string>;
}

/* ─── Node card ─────────────────────────────────────────────────────────── */
function NodeCard({ node, ctx, expanded, onToggle }: {
  node: OrgNode; ctx: OrgPageCtx; expanded: boolean; onToggle: () => void;
}) {
  const base = ROLE_STYLE[node.role] ?? ROLE_STYLE.EMPLOYEE;
  const customHex = ctx.roleColors?.[node.role];
  const s = customHex
    ? { bg: customHex + "18", border: customHex, text: customHex, tag: customHex }
    : base;
  const isSource  = ctx.dragging?.sourceId === node.id;
  const isHovered = ctx.hoveredId === node.id && ctx.dragging && ctx.dragging.sourceId !== node.id;
  const isRemap   = ctx.mode === "remap";

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => isRemap && ctx.onNodeEnter(node.id, node.name)}
      onMouseLeave={() => isRemap && ctx.onNodeLeave()}
    >
      {/* Input port — top centre, only visible in remap mode */}
      {isRemap && (
        <div style={{
          position: "absolute", top: -7, left: "50%",
          transform: "translateX(-50%)",
          width: 14, height: 14, borderRadius: "50%",
          background: isHovered ? "#52c41a" : "#fff",
          border: `2px solid ${isHovered ? "#52c41a" : LINE_COLOR}`,
          zIndex: 10,
          transition: "background 0.15s, border-color 0.15s",
          boxShadow: isHovered ? "0 0 0 4px #52c41a33" : "none",
        }} />
      )}

      {/* Card body */}
      <div
        onClick={!isRemap ? onToggle : undefined}
        style={{
          cursor: isRemap ? "default" : (node.children?.length ? "pointer" : "default"),
          background: isSource  ? "#e6f4ff" :
                      isHovered ? "#f6ffed" : s.bg,
          border: `1.5px solid ${isSource ? "#1677ff" : isHovered ? "#52c41a" : s.border}`,
          borderRadius: 10,
          padding: "10px 14px",
          minWidth: 150, maxWidth: 190,
          userSelect: "none",
          position: "relative", zIndex: 1,
          transition: "box-shadow 0.18s, transform 0.15s, background 0.15s, border-color 0.15s",
          boxShadow: isSource || isHovered
            ? `0 0 0 3px ${isHovered ? "#52c41a44" : "#1677ff44"}, 0 4px 16px rgba(0,0,0,0.1)`
            : "0 1px 5px rgba(0,0,0,0.07)",
        }}
        onMouseEnter={(e) => {
          if (isRemap) return;
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateY(-2px)";
          el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)";
        }}
        onMouseLeave={(e) => {
          if (isRemap) return;
          const el = e.currentTarget as HTMLDivElement;
          el.style.transform = "translateY(0)";
          el.style.boxShadow = "0 1px 5px rgba(0,0,0,0.07)";
        }}
      >
        {/* Avatar + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: s.border + "20", border: `1.5px solid ${s.border}`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <UserOutlined style={{ color: s.text, fontSize: 15 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 12.5, color: "var(--app-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.3 }}>
              {node.name}
            </div>
            {(node as any).jobTitle && (
              <div style={{ fontSize: 10, color: s.text, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontStyle: "italic" }}>
                {(node as any).jobTitle}
              </div>
            )}
            {node.department && (
              <div style={{ fontSize: 10.5, color: "#777", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {node.department.name}
              </div>
            )}
          </div>
        </div>

        {/* Role + actions row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
          <Tag color={s.tag} style={{ margin: 0, fontSize: 10, lineHeight: "18px", padding: "0 6px" }}>
            {ctx.roleLabels?.[node.role] ?? ROLE_LABELS[node.role] ?? node.role}
          </Tag>
          <div style={{ display: "flex", gap: 4 }}>
            {/* Add direct report button (view mode) */}
            {!isRemap && ctx.canEdit && (
              <Tooltip title="Add direct report" mouseEnterDelay={0.4}>
                <div
                  onClick={(e) => { e.stopPropagation(); ctx.onAddChild(node); }}
                  style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#1677ff", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <PlusOutlined style={{ fontSize: 9, color: "#fff" }} />
                </div>
              </Tooltip>
            )}
            {/* Expand / collapse toggle (view mode) */}
            {!isRemap && node.children?.length > 0 && (
              <div
                onClick={onToggle}
                style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: expanded ? "#ff4d4f" : "#52c41a",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                {expanded
                  ? <MinusOutlined style={{ fontSize: 9, color: "#fff" }} />
                  : <PlusOutlined  style={{ fontSize: 9, color: "#fff" }} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Output port — bottom centre, remap mode only */}
      {isRemap && (
        <div
          onMouseDown={(e) => ctx.onPortDown(e, node)}
          style={{
            position: "absolute", bottom: -7, left: "50%",
            transform: "translateX(-50%)",
            width: 14, height: 14, borderRadius: "50%",
            background: isSource ? "#1677ff" : "#fff",
            border: `2px solid ${isSource ? "#1677ff" : "#1677ff"}`,
            zIndex: 10, cursor: "crosshair",
            transition: "background 0.15s",
            boxShadow: isSource ? "0 0 0 4px #1677ff33" : "none",
          }}
        >
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1677ff", margin: "2px auto" }} />
        </div>
      )}
    </div>
  );
}

/* ─── Recursive tree node ────────────────────────────────────────────────── */
function TreeNode({ node, ctx }: { node: OrgNode; ctx: OrgPageCtx }) {
  const [expanded, setExpanded] = useState(true);
  const { children } = node;
  const hasChildren = children.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <NodeCard
        node={node} ctx={ctx}
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
      />

      {hasChildren && expanded && (
        <>
          <div style={{ width: LINE_W, height: STEM_H, background: LINE_COLOR, flexShrink: 0 }} />
          {children.length === 1 ? (
            <TreeNode node={children[0]} ctx={ctx} />
          ) : (
            <div style={{ display: "flex", alignItems: "flex-start" }}>
              {children.map((child, i) => (
                <div key={child.id} style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  padding: "0 16px", position: "relative",
                }}>
                  <div style={{
                    position: "absolute", top: 0,
                    left:  i === 0                    ? "50%" : 0,
                    right: i === children.length - 1  ? "50%" : 0,
                    height: LINE_W, background: LINE_COLOR,
                  }} />
                  <div style={{ width: LINE_W, height: STEM_H, background: LINE_COLOR, flexShrink: 0 }} />
                  <TreeNode node={child} ctx={ctx} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── SVG bezier line during drag ─────────────────────────────────────────
   Rendered in a fixed viewport overlay so coordinates are always correct.  */
function DragLine({ drag }: { drag: DragState }) {
  const { portX, portY, curX, curY } = drag;
  const dy = Math.abs(curY - portY);
  const cpOff = Math.max(60, dy * 0.5);
  const path = `M${portX},${portY} C${portX},${portY + cpOff} ${curX},${curY - cpOff} ${curX},${curY}`;
  return (
    <svg
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 9999 }}
    >
      {/* Shadow */}
      <path d={path} fill="none" stroke="#0003" strokeWidth={5} strokeDasharray="8 5" strokeLinecap="round" />
      {/* Main line */}
      <path d={path} fill="none" stroke="#1677ff" strokeWidth={2.5} strokeDasharray="8 5" strokeLinecap="round">
        <animate attributeName="stroke-dashoffset" from="0" to="-26" dur="0.5s" repeatCount="indefinite" />
      </path>
      {/* Endpoint dot */}
      <circle cx={curX} cy={curY} r={5} fill="#1677ff" opacity="0.8" />
      {/* Source dot */}
      <circle cx={portX} cy={portY} r={5} fill="#1677ff" />
    </svg>
  );
}

/* ─── Add Employee modal ─────────────────────────────────────────────────── */
function AddEmployeeModal({ open, managerNode, allNodes, onClose, onCreated, hierarchyAdminRoles, roleLabels }: {
  open: boolean;
  managerNode: OrgNode | null;
  allNodes: OrgNode[];
  onClose: () => void;
  hierarchyAdminRoles?: string[];
  roleLabels?: Record<string, string>;
  onCreated: () => void;
}) {
  const [form] = Form.useForm();
  const { user } = useAuthStore();

  // Flatten tree to get all node options for manager dropdown
  function flatten(nodes: OrgNode[]): OrgNode[] {
    return nodes.flatMap((n) => [n, ...flatten(n.children)]);
  }
  const flat = flatten(allNodes);

  useEffect(() => {
    if (open) {
      form.resetFields();
      if (managerNode) form.setFieldValue("managerId", managerNode.id);
    }
  }, [open, managerNode, form]);

  const mutation = useMutation({
    mutationFn: employeesApi.create,
    onSuccess: () => {
      message.success("Employee added");
      onCreated();
      onClose();
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Failed to create employee"),
  });

  function submit(values: any) {
    mutation.mutate(values);
  }

  const adminRoles = hierarchyAdminRoles ?? ["FOUNDER","CPO","CFO","HR"];
  const canPickManager = !user || adminRoles.includes(user.role) || user.isSuperAdmin;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span>
          <UserAddOutlined style={{ marginRight: 8, color: "#1677ff" }} />
          {managerNode ? `Add report under ${managerNode.name}` : "Add Employee"}
        </span>
      }
      footer={null}
      width={480}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={submit} style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
          <Input placeholder="Jane Smith" />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
          <Input placeholder="jane@company.com" />
        </Form.Item>
        <Form.Item name="password" label="Temporary Password" rules={[{ required: true, min: 6 }]}>
          <Input.Password placeholder="Min 6 characters" />
        </Form.Item>
        <Form.Item name="jobTitle" label="Job Title / Position">
          <Input placeholder="e.g. Senior Engineer, VP Product" />
        </Form.Item>
        <Form.Item name="role" label="Role" initialValue="EMPLOYEE">
          <Select>
            {ALL_ROLES.map((r) => (
              <Option key={r} value={r}>{roleLabels?.[r] ?? ROLE_LABELS[r] ?? r}</Option>
            ))}
          </Select>
        </Form.Item>
        {canPickManager && (
          <Form.Item name="managerId" label="Reports to (Manager)">
            <Select allowClear showSearch optionFilterProp="label"
              placeholder="Select manager">
              {flat
                .filter((n) => adminRoles.includes(n.role) || ["MANAGER","TEAM_LEAD"].includes(n.role))
                .map((n) => (
                  <Option key={n.id} value={n.id} label={n.name}>
                    <Tag color={ROLE_STYLE[n.role]?.tag ?? "default"} style={{ fontSize: 10, marginRight: 6 }}>
                      {roleLabels?.[n.role] ?? ROLE_LABELS[n.role] ?? n.role}
                    </Tag>
                    {n.name}
                  </Option>
                ))
              }
            </Select>
          </Form.Item>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>
            Add Employee
          </Button>
        </div>
      </Form>
    </Modal>
  );
}

/* ─── Remap confirm modal ────────────────────────────────────────────────── */
function RemapConfirmModal({ open, sourceId, sourceName, targetId, targetName, onConfirm, onCancel }: {
  open: boolean; sourceId: string; sourceName: string;
  targetId: string; targetName: string;
  onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal
      open={open} onCancel={onCancel} footer={null}
      title={<span><SwapOutlined style={{ marginRight: 8, color: "#1677ff" }} />Reassign Manager</span>}
      width={420}
    >
      <div style={{ padding: "8px 0 16px" }}>
        <Text>
          Set <strong>{targetName}</strong>&apos;s manager to{" "}
          <strong>{sourceName}</strong>?
        </Text>
        <div style={{ marginTop: 8, padding: "10px 14px", background: "var(--app-subtle)", borderRadius: 8, fontSize: 12, color: "var(--app-muted)" }}>
          This will move <strong>{targetName}</strong> to report directly under <strong>{sourceName}</strong>.
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="primary" onClick={onConfirm}>Confirm Reassign</Button>
      </div>
    </Modal>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function OrgPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: org } = useQuery({
    queryKey: ["org-settings"],
    queryFn: orgApi.getSettings,
    enabled: !!user,
  });

  const s = org?.settings;
  const hierarchyAdminRoles: string[] = s?.hierarchyAdminRoles ?? ["FOUNDER","CPO","CFO","HR"];
  const roleLabels: Record<string, string> = { ...ROLE_LABELS, ...(s?.roleLabels ?? {}) };
  const roleColors: Record<string, string> = s?.roleColors ?? {};

  const canEdit = hierarchyAdminRoles.includes(user?.role ?? "") || !!user?.isSuperAdmin;

  const { data: roots = [], isLoading } = useQuery<OrgNode[]>({
    queryKey: ["org-tree"],
    queryFn: employeesApi.orgTree,
  });

  // ── Mode & drag state ──
  const [mode, setMode]         = useState<"view" | "remap">("view");
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Refs so window mouseup can read the latest values without stale closures
  const draggingRef  = useRef<DragState | null>(null);
  const hoveredIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { draggingRef.current  = dragging;  }, [dragging]);
  useEffect(() => { hoveredIdRef.current = hoveredId; }, [hoveredId]);

  // ── Pending remap confirmation ──
  const [remapPending, setRemapPending] = useState<{
    sourceId: string; sourceName: string;
    targetId: string; targetName: string;
  } | null>(null);

  // ── Add employee modal ──
  const [addOpen, setAddOpen]           = useState(false);
  const [addManager, setAddManager]     = useState<OrgNode | null>(null);

  const updateMutation = useMutation({
    mutationFn: ({ id, managerId }: { id: string; managerId: string }) =>
      employeesApi.update(id, { managerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-tree"] });
      message.success("Manager updated");
      setRemapPending(null);
    },
    onError: (e: any) => message.error(e?.response?.data?.message ?? "Update failed"),
  });

  // ── Drag handlers ──
  const onPortDown = useCallback((e: React.MouseEvent, node: OrgNode) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const state: DragState = {
      sourceId: node.id, sourceName: node.name,
      portX: rect.left + rect.width / 2,
      portY: rect.top  + rect.height / 2,
      curX:  e.clientX, curY: e.clientY,
    };
    draggingRef.current = state;
    setDragging(state);
  }, []);

  // hoveredNode ref — keyed by id+name so window mouseup can read both
  const hoveredNodeRef = useRef<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      setDragging((d) => d ? { ...d, curX: e.clientX, curY: e.clientY } : null);
    }
    function onUp() {
      const d = draggingRef.current;
      const target = hoveredNodeRef.current;
      // Trigger remap here — before clearing state — so we never miss the target
      if (d && target && target.id !== d.sourceId) {
        setRemapPending({
          sourceId: d.sourceId, sourceName: d.sourceName,
          targetId: target.id, targetName: target.name,
        });
      }
      draggingRef.current  = null;
      hoveredNodeRef.current = null;
      setDragging(null);
      setHoveredId(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [!!dragging]);

  // onNodeUp is now only a fallback noop — real remap is handled in window mouseup
  const onNodeUp = useCallback((_targetId: string, _targetName: string) => {}, []);

  // ── Context passed to every tree node ──
  const ctx: OrgPageCtx = {
    mode,
    dragging,
    hoveredId,
    onPortDown,
    onNodeEnter: (id, name) => {
      if (dragging && id !== dragging.sourceId) {
        setHoveredId(id);
        hoveredNodeRef.current = { id, name };
      }
    },
    onNodeLeave: () => { setHoveredId(null); hoveredNodeRef.current = null; },
    onNodeUp,
    onAddChild: (managerNode) => { setAddManager(managerNode); setAddOpen(true); },
    canEdit: !!canEdit,
    roleLabels,
    roleColors,
  };

  return (
    <div style={{ userSelect: dragging ? "none" : "auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ApartmentOutlined style={{ fontSize: 24, color: "#1677ff" }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>Organisation Chart</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {mode === "remap"
                ? "Drag an output port (bottom ●) to an input port (top ●) to reassign a manager"
                : "Click − / + to collapse · Click + on a card to add a direct report"}
            </Text>
          </div>
        </div>

        {canEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              icon={<UserAddOutlined />}
              onClick={() => { setAddManager(null); setAddOpen(true); }}
            >
              Add Employee
            </Button>
            <Button
              type={mode === "remap" ? "primary" : "default"}
              icon={mode === "remap" ? <CloseCircleOutlined /> : <ApiOutlined />}
              onClick={() => {
                setMode((m) => (m === "remap" ? "view" : "remap"));
                setDragging(null);
                setHoveredId(null);
              }}
              danger={mode === "remap"}
            >
              {mode === "remap" ? "Exit Remap" : "Remap Connections"}
            </Button>
          </div>
        )}
      </div>

      {/* Remap hint banner */}
      {mode === "remap" && (
        <div style={{
          background: "#e6f4ff", border: "1px solid #91caff", borderRadius: 8,
          padding: "10px 16px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 10, fontSize: 13,
        }}>
          <LinkOutlined style={{ color: "#1677ff", fontSize: 16 }} />
          <span>
            <strong>Remap mode active.</strong> Drag from a <span style={{ color: "#1677ff", fontWeight: 600 }}>blue output port ●</span> at the bottom of a card
            to the <span style={{ color: "#52c41a", fontWeight: 600 }}>green input port ●</span> at the top of the target card to change the reporting line.
          </span>
        </div>
      )}

      {isLoading && <div style={{ textAlign: "center", padding: 64 }}><Spin size="large" /></div>}
      {!isLoading && roots.length === 0 && <Empty description="No employees" style={{ padding: 48 }} />}

      {roots.length > 0 && (
        <div style={{ overflowX: "auto", paddingBottom: 40 }}>
          <div style={{
            display: "flex", gap: 48, justifyContent: "center",
            paddingTop: 16, paddingBottom: 8, minWidth: "max-content",
          }}>
            {roots.map((root) => (
              <TreeNode key={root.id} node={root} ctx={ctx} />
            ))}
          </div>
        </div>
      )}

      {/* Animated bezier line during drag */}
      {dragging && <DragLine drag={dragging} />}

      {/* Remap confirmation modal */}
      {remapPending && (
        <RemapConfirmModal
          open
          sourceId={remapPending.sourceId}
          sourceName={remapPending.sourceName}
          targetId={remapPending.targetId}
          targetName={remapPending.targetName}
          onConfirm={() =>
            updateMutation.mutate({ id: remapPending.targetId, managerId: remapPending.sourceId })
          }
          onCancel={() => setRemapPending(null)}
        />
      )}

      {/* Add employee modal */}
      <AddEmployeeModal
        open={addOpen}
        managerNode={addManager}
        allNodes={roots}
        onClose={() => setAddOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["org-tree"] })}
        hierarchyAdminRoles={hierarchyAdminRoles}
        roleLabels={roleLabels}
      />
    </div>
  );
}
