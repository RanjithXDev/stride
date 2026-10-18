"use client";
import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Typography, Button, Input, Select, Tag, theme,
} from "antd";
import {
  PlusOutlined, SearchOutlined, TeamOutlined,
  TagsOutlined, ArrowRightOutlined, CalendarOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";
import { projectsApi, ProjectFilters, Project } from "@/lib/projects";
import { employeesApi } from "@/lib/employees";
import { useAuthStore } from "@/store/auth";
import CreateProjectModal from "@/components/projects/CreateProjectModal";
import {
  FilterBar, MetricGrid, MetricTile, PageEmpty,
  PageError, PageHeader, PageLoading,
} from "@/components/ui/AppPage";
import styles from "./projects.module.css";

const { Text } = Typography;
const { Option } = Select;

const statusConfig: Record<string, { color: string; label: string }> = {
  PLANNING:  { color: "default",    label: "Planning" },
  ACTIVE:    { color: "processing", label: "Active" },
  ON_HOLD:   { color: "warning",    label: "On Hold" },
  COMPLETED: { color: "success",    label: "Completed" },
  CANCELLED: { color: "error",      label: "Cancelled" },
};

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const { token } = theme.useToken();
  const cfg = statusConfig[project.status];
  const isOverdue = Boolean(project.deadline && dayjs(project.deadline).isBefore(dayjs(), "day") && project.status === "ACTIVE");

  return (
    <button
      className={styles.projectCard}
      onClick={onClick}
      style={{ background: token.colorBgContainer, borderColor: token.colorBorderSecondary }}
      aria-label={`Open ${project.name} project`}
    >
      <div className={styles.cardTopline}>
        <Tag color={cfg.color} style={{ fontWeight: 600, margin: 0 }}>{cfg.label}</Tag>
        {isOverdue && <Tag color="red">Overdue</Tag>}
      </div>

      <div className={styles.projectTitle} style={{ color: token.colorText }}>{project.name}</div>

      <Text type="secondary" className={styles.projectDescription}>
        {project.description || "No project description has been added yet."}
      </Text>

      {project.department && (
        <Tag className={styles.departmentTag}>{project.department.name}</Tag>
      )}

      <div className={styles.cardFooter} style={{ borderColor: token.colorBorderSecondary }}>
        <div className={styles.projectMeta} style={{ color: token.colorTextSecondary }}>
          <span title="Members"><TeamOutlined /> {project._count.members}</span>
          <span title="Tickets"><TagsOutlined /> {project._count.tickets}</span>
        </div>
        {project.deadline && (
          <span className={isOverdue ? styles.overdueDate : styles.dueDate}>
            <CalendarOutlined /> {dayjs(project.deadline).format("D MMM YYYY")}
          </span>
        )}
        <ArrowRightOutlined className={styles.cardArrow} />
      </div>
    </button>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [filters, setFilters] = useState<ProjectFilters>({});
  const [createOpen, setCreateOpen] = useState(false);
  const deferredFilters = useDeferredValue(filters);

  const { data: projects = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["projects", deferredFilters],
    queryFn: () => projectsApi.list(deferredFilters),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => employeesApi.departments(),
  });

  const canCreate = user?.role === "FOUNDER" || user?.role === "MANAGER";

  const active    = projects.filter((p) => p.status === "ACTIVE").length;
  const planning  = projects.filter((p) => p.status === "PLANNING").length;
  const completed = projects.filter((p) => p.status === "COMPLETED").length;
  const hasFilters = Boolean(filters.search || filters.status || filters.departmentId);

  return (
    <div className={styles.projectsPage}>
      <PageHeader
        eyebrow="Delivery portfolio"
        title="Projects"
        description="Track progress, ownership, deadlines, and delivery health across your workspace."
        action={canCreate ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            New Project
          </Button>
        ) : undefined}
      />

      <MetricGrid>
        {[
          { label: "Active", value: active, color: "#1677ff", hint: "Currently in delivery" },
          { label: "Planning", value: planning, color: "#8b5cf6", hint: "Preparing to start" },
          { label: "Completed", value: completed, color: "#16a34a", hint: "Successfully delivered" },
          { label: "Total", value: projects.length, color: "#0f766e", hint: hasFilters ? "Matching current filters" : "Across your access" },
        ].map(({ label, value, color, hint }) => (
          <MetricTile key={label} label={label} value={value} color={color} hint={hint} />
        ))}
      </MetricGrid>

      <FilterBar
        resultLabel={`${projects.length} project${projects.length === 1 ? "" : "s"}`}
        hasFilters={hasFilters}
        onClear={() => setFilters({})}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search projects..."
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
          style={{ width: 220 }}
          allowClear
        />
        <Select
          placeholder="Status"
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          allowClear
          style={{ width: 140 }}
        >
          {Object.entries(statusConfig).map(([k, v]) => (
            <Option key={k} value={k}>{v.label}</Option>
          ))}
        </Select>
        <Select
          placeholder="Department"
          value={filters.departmentId}
          onChange={(v) => setFilters((f) => ({ ...f, departmentId: v }))}
          allowClear
          style={{ width: 160 }}
        >
          {departments.map((d) => (
            <Option key={d.id} value={d.id}>{d.name}</Option>
          ))}
        </Select>
      </FilterBar>

      {isLoading ? (
        <PageLoading />
      ) : isError ? (
        <PageError onRetry={() => refetch()} />
      ) : projects.length === 0 ? (
        <PageEmpty
          title={hasFilters ? "No projects match these filters" : "No projects yet"}
          description={hasFilters ? "Try changing or clearing the current filters." : "Create your first project to organize tickets, people, and delivery milestones."}
          action={hasFilters
            ? <Button onClick={() => setFilters({})}>Clear filters</Button>
            : canCreate ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Create project</Button> : undefined}
        />
      ) : (
        <section className={styles.projectGrid} aria-label="Projects">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onClick={() => router.push(`/projects/${project.id}`)} />
          ))}
        </section>
      )}

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
