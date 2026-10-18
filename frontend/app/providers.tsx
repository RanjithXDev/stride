"use client";
import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { message } from "antd";
import { useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    queryCache: new QueryCache({
      onError: (err: any) => {
        if (err?.response?.status !== 401) {
          message.error(err?.response?.data?.message ?? "Something went wrong");
        }
      },
    }),
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  }));

  return (
    <AntdRegistry>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </AntdRegistry>
  );
}
