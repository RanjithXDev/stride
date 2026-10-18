"use client";

import { Suspense, useState } from "react";
import {
  ArrowRightOutlined,
  CheckCircleFilled,
  LockOutlined,
  MailOutlined,
  SafetyCertificateFilled,
} from "@ant-design/icons";
import { Alert, Button, Form, Input, Typography, message } from "antd";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import styles from "./login.module.css";

const { Text } = Typography;

type LoginValues = {
  email: string;
  password: string;
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const { setAuth } = useAuthStore();
  const [form] = Form.useForm<LoginValues>();
  const [messageApi, messageContext] = message.useMessage();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(values: LoginValues) {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", values);
      setAuth(data.user);
      router.push("/dashboard");
    } catch (error: unknown) {
      const fallback = "We couldn't sign you in. Check your details and try again.";
      messageApi.error(
        axios.isAxiosError(error) && typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : fallback,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      {messageContext}
      <section className={styles.storyPanel} aria-label="Stride overview">
        <div className={styles.glowOne} />
        <div className={styles.glowTwo} />

        <div className={styles.brand}>
          <span className={styles.brandMark}>S</span>
          <span>Stride</span>
        </div>

        <div className={styles.storyContent}>
          <span className={styles.eyebrow}>One workspace. Complete clarity.</span>
          <h1>Keep your people,<br />projects, and progress<br />moving together.</h1>
          <p>
            Run day-to-day operations from one calm, connected workspace built
            for growing teams.
          </p>

          <div className={styles.featureList}>
            <div><CheckCircleFilled /> Plan work and track delivery</div>
            <div><CheckCircleFilled /> Manage teams and attendance</div>
            <div><CheckCircleFilled /> Review time and expenses</div>
          </div>
        </div>

        <div className={styles.securityNote}>
          <SafetyCertificateFilled />
          <span>Your workspace data is protected and private.</span>
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.mobileBrand}>
          <span className={styles.brandMark}>S</span>
          <span>Stride</span>
        </div>

        <div className={styles.formCard}>
          <div className={styles.heading}>
            <span className={styles.welcomeBadge}>Welcome back</span>
            <h2>Sign in to your workspace</h2>
            <p>Enter your work email and password to continue.</p>
          </div>

          {reason === "session_expired" && (
            <Alert
              type="warning"
              message="Your session has expired. Please log in again."
              style={{ marginBottom: 16 }}
              showIcon
            />
          )}

          <Form<LoginValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            onFinish={handleSubmit}
            className={styles.form}
          >
            <Form.Item
              name="email"
              label="Work email"
              rules={[
                { required: true, message: "Enter your work email" },
                { type: "email", message: "Enter a valid email address" },
              ]}
            >
              <Input
                prefix={<MailOutlined aria-hidden="true" />}
                placeholder="you@company.com"
                size="large"
                autoComplete="email"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: "Enter your password" }]}
            >
              <Input.Password
                prefix={<LockOutlined aria-hidden="true" />}
                placeholder="Enter your password"
                size="large"
                autoComplete="current-password"
              />
            </Form.Item>

            <div style={{ textAlign: "right", marginTop: -8, marginBottom: 12 }}>
              <Button type="link" size="small" style={{ padding: 0 }} onClick={() => router.push("/forgot-password")}>
                Forgot password?
              </Button>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              className={styles.submitButton}
            >
              {!loading && <><span>Sign in</span><ArrowRightOutlined /></>}
            </Button>
          </Form>

          <Text className={styles.supportText}>
            Having trouble signing in? Contact your workspace administrator.
          </Text>
        </div>

        <footer>© {new Date().getFullYear()} Stride · Built for modern teams</footer>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
