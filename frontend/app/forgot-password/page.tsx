"use client";
import { useState } from "react";
import { Form, Input, Button, Card, Typography, Alert, Space } from "antd";
import { MailOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

const { Title, Text } = Typography;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function onFinish({ email }: { email: string }) {
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
      <Card style={{ width: 400, borderRadius: 12 }}>
        <Space direction="vertical" size={20} style={{ width: "100%" }}>
          <div>
            <Title level={4} style={{ marginBottom: 4 }}>Reset your password</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Enter your email and we'll send you a reset link.
            </Text>
          </div>

          {sent ? (
            <Alert
              type="success"
              message="Check your email"
              description="If an account exists for that email, you'll receive a password reset link shortly."
              showIcon
            />
          ) : (
            <Form layout="vertical" onFinish={onFinish}>
              {error && <Alert type="error" message={error} style={{ marginBottom: 12 }} />}
              <Form.Item
                label="Email"
                name="email"
                rules={[{ required: true, type: "email", message: "Please enter a valid email" }]}
              >
                <Input prefix={<MailOutlined />} placeholder="you@company.com" size="large" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={loading} block size="large">
                  Send reset link
                </Button>
              </Form.Item>
            </Form>
          )}

          <Button type="link" icon={<ArrowLeftOutlined />} style={{ padding: 0 }} onClick={() => router.push("/login")}>
            Back to login
          </Button>
        </Space>
      </Card>
    </div>
  );
}
