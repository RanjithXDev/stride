"use client";
import { useState, Suspense } from "react";
import { Form, Input, Button, Card, Typography, Alert, Space } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";

const { Title, Text } = Typography;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!token) {
    return (
      <Alert
        type="error"
        message="Invalid reset link"
        description="This password reset link is missing a token. Please request a new one."
        showIcon
      />
    );
  }

  async function onFinish({ password }: { password: string }) {
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form layout="vertical" onFinish={onFinish}>
      {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} />}
      {done && <Alert type="success" message="Password updated! Redirecting to login..." style={{ marginBottom: 12 }} />}
      <Form.Item
        label="New password"
        name="password"
        rules={[{ required: true, min: 8, message: "Minimum 8 characters" }]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="New password" size="large" />
      </Form.Item>
      <Form.Item
        label="Confirm password"
        name="confirm"
        dependencies={["password"]}
        rules={[
          { required: true },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue("password") === value) return Promise.resolve();
              return Promise.reject(new Error("Passwords do not match"));
            },
          }),
        ]}
      >
        <Input.Password prefix={<LockOutlined />} placeholder="Confirm password" size="large" />
      </Form.Item>
      <Form.Item style={{ marginBottom: 0 }}>
        <Button type="primary" htmlType="submit" loading={loading} block size="large" disabled={done}>
          Set new password
        </Button>
      </Form.Item>
    </Form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
      <Card style={{ width: 420, borderRadius: 12 }}>
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <div>
            <Title level={4} style={{ marginBottom: 4 }}>Set a new password</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>Choose a strong password for your account.</Text>
          </div>
          <Suspense fallback={null}>
            <ResetPasswordForm />
          </Suspense>
        </Space>
      </Card>
    </div>
  );
}
