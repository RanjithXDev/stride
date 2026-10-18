"use client";

import { Button, Empty, Skeleton, Typography, theme } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import styles from "./AppPage.module.css";

const { Text, Title } = Typography;

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div className={styles.pageHeading}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <Title level={3}>{title}</Title>
        {description && <Text type="secondary">{description}</Text>}
      </div>
      {action && <div className={styles.pageActions}>{action}</div>}
    </header>
  );
}

export function MetricGrid({ children }: { children: React.ReactNode }) {
  return <section className={styles.metricGrid} aria-label="Summary">{children}</section>;
}

export function MetricTile({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  color: string;
  hint?: string;
}) {
  const { token } = theme.useToken();
  return (
    <div className={styles.metricTile} style={{ borderColor: token.colorBorderSecondary }}>
      <span className={styles.metricAccent} style={{ background: color }} />
      <Text type="secondary" className={styles.metricLabel}>{label}</Text>
      <strong style={{ color: token.colorText }}>{value}</strong>
      {hint && <small style={{ color: token.colorTextSecondary }}>{hint}</small>}
    </div>
  );
}

export function FilterBar({
  children,
  resultLabel,
  onClear,
  hasFilters = false,
}: {
  children: React.ReactNode;
  resultLabel?: string;
  onClear?: () => void;
  hasFilters?: boolean;
}) {
  const { token } = theme.useToken();
  return (
    <section className={styles.filterBar} style={{ borderColor: token.colorBorderSecondary }} aria-label="Filters">
      <div className={styles.filterControls}>{children}</div>
      <div className={styles.filterMeta}>
        {resultLabel && <Text type="secondary">{resultLabel}</Text>}
        {hasFilters && onClear && <Button type="link" size="small" onClick={onClear}>Clear filters</Button>}
      </div>
    </section>
  );
}

export function PageLoading({ cards = 8 }: { cards?: number }) {
  return (
    <div className={styles.skeletonGrid} aria-label="Loading content" aria-busy="true">
      {Array.from({ length: cards }, (_, index) => (
        <div className={styles.skeletonCard} key={index}>
          <Skeleton active title={{ width: "55%" }} paragraph={{ rows: 3 }} />
        </div>
      ))}
    </div>
  );
}

export function PageEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={styles.statePanel}>
      <Empty description={null} />
      <Title level={5}>{title}</Title>
      <Text type="secondary">{description}</Text>
      {action && <div className={styles.stateAction}>{action}</div>}
    </div>
  );
}

export function PageError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.statePanel} role="alert">
      <span className={styles.errorMark}>!</span>
      <Title level={5}>We couldn&apos;t load this page</Title>
      <Text type="secondary">Check your connection and try again. Your existing data is safe.</Text>
      <div className={styles.stateAction}>
        <Button icon={<ReloadOutlined />} onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}
