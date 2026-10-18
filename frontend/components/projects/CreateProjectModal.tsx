"use client";
import { useState } from "react";
import { Modal, Form, Input, Select, DatePicker, Button, message, Steps, Space, Radio, Spin, Table, Tag } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GithubOutlined, LinkOutlined, TeamOutlined } from "@ant-design/icons";
import { projectsApi, CreateProjectPayload } from "@/lib/projects";
import { employeesApi } from "@/lib/employees";
import { integrationApi } from "@/lib/integrations";
import { ScmConnection, ProviderRepo } from "@/types";

const { TextArea } = Input;
const { Option } = Select;

const PERM_OPTIONS = [
  { value: "VIEWER", label: "Viewer — read-only" },
  { value: "DEVELOPER", label: "Developer — push" },
  { value: "MAINTAINER", label: "Maintainer" },
  { value: "ADMIN", label: "Admin" },
];

interface MemberPerm { userId: string; name: string; role: string; permission: string }

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CreateProjectModal({ open, onClose }: Props) {
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [projectValues, setProjectValues] = useState<any>(null);

  // Step 2: repo
  const [repoChoice, setRepoChoice] = useState<"skip" | "github" | "gitlab">("skip");
  const [setupMode, setSetupMode] = useState<"create" | "map">("map");
  const [selectedConn, setSelectedConn] = useState<string>("");
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [newRepoName, setNewRepoName] = useState("");
  const [defaultPerm, setDefaultPerm] = useState("DEVELOPER");

  // Step 3: per-member permissions
  const [memberPerms, setMemberPerms] = useState<MemberPerm[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const queryClient = useQueryClient();

  const { data: departments = [] } = useQuery({ queryKey: ["departments"], queryFn: () => employeesApi.departments() });
  const { data: allEmployees = [] } = useQuery({ queryKey: ["employees"], queryFn: () => employeesApi.list() });
  const { data: connections = [] } = useQuery<ScmConnection[]>({ queryKey: ["scm-connections"], queryFn: integrationApi.getConnections });

  const filteredConns = connections.filter(
    (c) => c.status === "ACTIVE" && (repoChoice === "skip" || c.provider === repoChoice.toUpperCase())
  );

  const { data: repos = [], isFetching: reposFetching } = useQuery<ProviderRepo[]>({
    queryKey: ["provider-repos", selectedConn],
    queryFn: () => integrationApi.getRepositories(selectedConn),
    enabled: !!selectedConn && setupMode === "map",
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (payload: any) => {
      const base: CreateProjectPayload = {
        ...projectValues,
        startDate: projectValues.startDate?.toISOString(),
        deadline: projectValues.deadline?.toISOString(),
      };
      const body: any = { ...base, memberIds: selectedMembers };
      if (payload.repository) body.repository = payload.repository;
      if (payload.memberPermissions) body.memberPermissions = payload.memberPermissions;
      return projectsApi.create(body);
    },
    onSuccess: () => {
      message.success("Project created");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      handleClose();
    },
    onError: () => message.error("Failed to create project"),
  });

  function handleClose() {
    form.resetFields();
    setStep(0);
    setProjectValues(null);
    setRepoChoice("skip");
    setSetupMode("map");
    setSelectedConn("");
    setSelectedRepo("");
    setNewRepoName("");
    setDefaultPerm("DEVELOPER");
    setMemberPerms([]);
    setSelectedMembers([]);
    onClose();
  }

  function onStep1Finish(values: any) {
    setProjectValues(values);
    setStep(1);
  }

  function onStep2Next() {
    if (repoChoice !== "skip") {
      if (!selectedConn) { message.warning("Please select a connection"); return; }
      if (setupMode === "map" && !selectedRepo) { message.warning("Please select a repository"); return; }
      if (setupMode === "create" && !newRepoName.trim()) { message.warning("Please enter a repository name"); return; }
    }
    // Init member perms for step 3
    const initialPerms: MemberPerm[] = allEmployees
      .filter((e: any) => selectedMembers.includes(e.id))
      .map((e: any) => ({ userId: e.id, name: e.name, role: e.role, permission: defaultPerm }));
    setMemberPerms(initialPerms.length ? initialPerms : []);
    setStep(2);
  }

  function onFinish() {
    let repository: any = null;
    if (repoChoice !== "skip" && selectedConn) {
      if (setupMode === "create") {
        repository = { connectionId: selectedConn, createNew: true, repoName: newRepoName.trim(), defaultPermission: defaultPerm };
      } else {
        const repo = repos.find((r) => r.id === selectedRepo);
        if (repo) {
          repository = { connectionId: selectedConn, providerRepositoryId: repo.id, namespace: repo.namespace, repositoryName: repo.name, fullName: repo.fullName, webUrl: repo.webUrl, defaultBranch: repo.defaultBranch, isPrivate: repo.isPrivate, defaultPermission: defaultPerm };
        }
      }
    }

    const memberPermissions = memberPerms.reduce((acc: Record<string, string>, mp) => {
      acc[mp.userId] = mp.permission;
      return acc;
    }, {});

    mutate({ repository, memberPermissions });
  }

  const updateMemberPerm = (userId: string, permission: string) => {
    setMemberPerms((prev) => prev.map((mp) => mp.userId === userId ? { ...mp, permission } : mp));
  };

  const repoSummary = repoChoice === "skip"
    ? "No repository — skip"
    : setupMode === "create"
      ? `New ${repoChoice} repo: ${newRepoName || "…"}`
      : repos.find((r) => r.id === selectedRepo)?.fullName ?? "…";

  return (
    <Modal
      title="New Project"
      open={open}
      onCancel={handleClose}
      footer={null}
      destroyOnClose
      width={600}
    >
      <Steps
        current={step}
        size="small"
        style={{ margin: "16px 0 24px" }}
        items={[
          { title: "Project Info" },
          { title: "Repository" },
          { title: "Access Rights" },
        ]}
      />

      {/* ── Step 1: Project Info ── */}
      {step === 0 && (
        <Form form={form} layout="vertical" onFinish={onStep1Finish}>
          <Form.Item name="name" label="Project Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. OpsCore MVP" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={3} placeholder="What is this project about?" />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="PLANNING">
            <Select>
              <Option value="PLANNING">Planning</Option>
              <Option value="ACTIVE">Active</Option>
              <Option value="ON_HOLD">On Hold</Option>
              <Option value="COMPLETED">Completed</Option>
              <Option value="CANCELLED">Cancelled</Option>
            </Select>
          </Form.Item>
          <Form.Item name="departmentId" label="Department">
            <Select allowClear placeholder="Select department">
              {departments.map((d: any) => <Option key={d.id} value={d.id}>{d.name}</Option>)}
            </Select>
          </Form.Item>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Form.Item name="startDate" label="Start Date">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="deadline" label="Deadline">
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </div>

          {/* Pre-select members */}
          <Form.Item label={<Space><TeamOutlined />Initial Members</Space>}>
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="children"
              placeholder="Add team members (optional)"
              value={selectedMembers}
              onChange={setSelectedMembers}
              style={{ width: "100%" }}
            >
              {allEmployees.map((e: any) => (
                <Option key={e.id} value={e.id}>{e.name} — {e.role}</Option>
              ))}
            </Select>
          </Form.Item>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="primary" htmlType="submit">Next: Repository</Button>
          </div>
        </Form>
      )}

      {/* ── Step 2: Repository Setup ── */}
      {step === 1 && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Link a repository?</div>
            <Radio.Group value={repoChoice} onChange={(e) => { setRepoChoice(e.target.value); setSelectedConn(""); setSelectedRepo(""); }}>
              <Space direction="vertical">
                <Radio value="skip">Skip — set up later</Radio>
                <Radio value="github"><GithubOutlined /> GitHub</Radio>
                <Radio value="gitlab"><LinkOutlined /> GitLab</Radio>
              </Space>
            </Radio.Group>
          </div>

          {repoChoice !== "skip" && (
            <>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 500, marginBottom: 8 }}>Connection</div>
                <Select
                  style={{ width: "100%" }}
                  placeholder="Select account"
                  value={selectedConn || undefined}
                  onChange={(v) => { setSelectedConn(v); setSelectedRepo(""); }}
                >
                  {filteredConns.map((c) => <Option key={c.id} value={c.id}>{c.accountName}</Option>)}
                </Select>
                {filteredConns.length === 0 && (
                  <div style={{ fontSize: 12, color: "#ff4d4f", marginTop: 4 }}>
                    No active {repoChoice} connection. Connect one in Settings → Integrations first.
                  </div>
                )}
              </div>

              {selectedConn && (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Radio.Group value={setupMode} onChange={(e) => { setSetupMode(e.target.value); setSelectedRepo(""); setNewRepoName(""); }}>
                      <Radio.Button value="map">Map Existing Repo</Radio.Button>
                      <Radio.Button value="create">Create New Repo</Radio.Button>
                    </Radio.Group>
                  </div>

                  {setupMode === "map" && (
                    <div style={{ marginBottom: 16 }}>
                      {reposFetching ? <Spin size="small" /> : (
                        <Select
                          showSearch
                          style={{ width: "100%" }}
                          placeholder="Search repositories…"
                          value={selectedRepo || undefined}
                          onChange={(v) => setSelectedRepo(v)}
                          filterOption={(input, option) => (option?.label ?? "").toString().toLowerCase().includes(input.toLowerCase())}
                          options={repos.map((r) => ({ value: r.id, label: r.fullName }))}
                        />
                      )}
                    </div>
                  )}

                  {setupMode === "create" && (
                    <div style={{ marginBottom: 16 }}>
                      <Input placeholder="Repository name (e.g. my-project)" value={newRepoName} onChange={(e) => setNewRepoName(e.target.value)} />
                    </div>
                  )}

                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 500, marginBottom: 8 }}>Default member permission</div>
                    <Select value={defaultPerm} onChange={setDefaultPerm} style={{ width: 220 }}>
                      {PERM_OPTIONS.map((p) => <Option key={p.value} value={p.value}>{p.label}</Option>)}
                    </Select>
                  </div>
                </>
              )}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
            <Button onClick={() => setStep(0)}>Back</Button>
            <Space>
              <Button onClick={handleClose}>Cancel</Button>
              <Button type="primary" onClick={onStep2Next}>Next: Access Rights</Button>
            </Space>
          </div>
        </div>
      )}

      {/* ── Step 3: Per-member Access Rights ── */}
      {step === 2 && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Repository Access Permissions</div>
            <div style={{ fontSize: 12, color: "#888" }}>
              Set repo access rights for each member. These will be applied immediately when the repo is linked.
              {repoChoice === "skip" && <Tag color="default" style={{ marginLeft: 8 }}>No repo linked — permissions saved for when repo is added later</Tag>}
              {repoChoice !== "skip" && <Tag color="blue" style={{ marginLeft: 8 }}>{repoSummary}</Tag>}
            </div>
          </div>

          {memberPerms.length === 0 && selectedMembers.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "#888", fontSize: 13 }}>
              No members selected in Step 1. You can add members and set permissions after project creation.
            </div>
          ) : memberPerms.length === 0 ? (
            <div style={{ padding: "20px 0", textAlign: "center", color: "#888", fontSize: 13 }}>
              Loading member list…
            </div>
          ) : (
            <Table
              size="small"
              dataSource={memberPerms}
              rowKey="userId"
              pagination={false}
              columns={[
                {
                  title: "Member",
                  key: "member",
                  render: (_: any, mp: MemberPerm) => (
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{mp.name}</div>
                      <Tag style={{ fontSize: 10 }}>{mp.role}</Tag>
                    </div>
                  ),
                },
                {
                  title: "Repo Access",
                  key: "permission",
                  width: 220,
                  render: (_: any, mp: MemberPerm) => (
                    <Select value={mp.permission} onChange={(v) => updateMemberPerm(mp.userId, v)} style={{ width: 200 }}>
                      {PERM_OPTIONS.map((p) => <Option key={p.value} value={p.value}>{p.label}</Option>)}
                    </Select>
                  ),
                },
              ]}
            />
          )}

          {memberPerms.length > 0 && (
            <div style={{ marginTop: 12, padding: "8px 12px", background: "color-mix(in srgb, #52c41a 10%, var(--app-surface))", borderRadius: 6, fontSize: 12, color: "#52c41a" }}>
              All members set. Access grants will be queued and applied in the background after project creation.
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <Button onClick={() => setStep(1)}>Back</Button>
            <Space>
              <Button onClick={handleClose}>Cancel</Button>
              <Button type="primary" loading={isPending} onClick={onFinish}>
                Create Project
              </Button>
            </Space>
          </div>
        </div>
      )}
    </Modal>
  );
}
