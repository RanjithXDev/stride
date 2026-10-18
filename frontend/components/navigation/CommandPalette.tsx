"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Input, Modal, Spin, Typography } from "antd";
import type { InputRef } from "antd";
import {
  ApartmentOutlined, DashboardOutlined, ProjectOutlined,
  SearchOutlined, TagsOutlined, TeamOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import { searchApi } from "@/lib/search";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import styles from "./CommandPalette.module.css";

const { Text } = Typography;
type PaletteItem = { key: string; title: string; subtitle: string; href: string; icon: React.ReactNode; section: string };

const navigation: PaletteItem[] = [
  { key: "nav-dashboard", title: "Dashboard", subtitle: "Workspace overview", href: "/dashboard", icon: <DashboardOutlined />, section: "Navigate" },
  { key: "nav-tickets", title: "Tickets", subtitle: "Plan and deliver work", href: "/tickets", icon: <TagsOutlined />, section: "Navigate" },
  { key: "nav-projects", title: "Projects", subtitle: "Track delivery health", href: "/projects", icon: <ProjectOutlined />, section: "Navigate" },
  { key: "nav-employees", title: "Employees", subtitle: "People and teams", href: "/employees", icon: <TeamOutlined />, section: "Navigate" },
  { key: "nav-org", title: "Org chart", subtitle: "Reporting structure", href: "/org", icon: <ApartmentOutlined />, section: "Navigate" },
];

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<InputRef>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebouncedValue(query.trim(), 220);
  const { data, isFetching, isError } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => searchApi.search(debounced),
    enabled: open && debounced.length >= 2,
  });

  const items = useMemo<PaletteItem[]>(() => {
    if (debounced.length < 2) return navigation;
    return [
      ...(data?.tickets ?? []).map((item) => ({ key: `ticket-${item.id}`, title: `${item.key} · ${item.title}`, subtitle: `${item.project?.name ?? "No project"} · ${item.status.replaceAll("_", " ")}`, href: `/tickets/${item.id}`, icon: <TagsOutlined />, section: "Tickets" })),
      ...(data?.projects ?? []).map((item) => ({ key: `project-${item.id}`, title: item.name, subtitle: `${item.key ?? "Project"} · ${item.status.replaceAll("_", " ")}`, href: `/projects/${item.id}`, icon: <ProjectOutlined />, section: "Projects" })),
      ...(data?.employees ?? []).map((item) => ({ key: `employee-${item.id}`, title: item.name, subtitle: item.jobTitle ?? item.department?.name ?? item.role.replaceAll("_", " "), href: `/employees/${item.id}`, icon: <TeamOutlined />, section: "People" })),
    ];
  }, [data, debounced]);

  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 60); }, [open]);

  function choose(item: PaletteItem) {
    onClose();
    setQuery("");
    router.push(item.href);
  }

  return (
    <Modal open={open} onCancel={onClose} footer={null} closable={false} width={620} className={styles.palette} destroyOnHidden>
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(value + 1, items.length - 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(value - 1, 0)); }
          if (event.key === "Enter" && items[active]) choose(items[active]);
        }}
        prefix={<SearchOutlined />}
        suffix={isFetching ? <Spin size="small" /> : <kbd>Esc</kbd>}
        placeholder="Search tickets, projects, people, or navigate…"
        variant="borderless"
        size="large"
        aria-label="Search workspace"
      />
      <div className={styles.results} role="listbox">
        {isError ? <div className={styles.message}>Search is temporarily unavailable. Please try again.</div>
          : items.length === 0 && !isFetching ? <div className={styles.message}>No results found for “{query}”.</div>
          : items.map((item, index) => (
            <button key={item.key} className={`${styles.result} ${index === active ? styles.active : ""}`} onMouseEnter={() => setActive(index)} onClick={() => choose(item)} role="option" aria-selected={index === active}>
              <Avatar className={styles.resultIcon} icon={item.icon} />
              <span><strong>{item.title}</strong><Text type="secondary">{item.subtitle}</Text></span>
              <small>{item.section}</small>
            </button>
          ))}
      </div>
      <div className={styles.hint}><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span></div>
    </Modal>
  );
}
