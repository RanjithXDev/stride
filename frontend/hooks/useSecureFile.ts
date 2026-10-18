"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";

function fileEndpoint(proofUrl: string) {
  const filename = proofUrl.split("/").pop();
  if (!filename) throw new Error("Invalid proof URL");
  return `/files/${encodeURIComponent(filename)}`;
}

export function useSecureFile(proofUrl?: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!proofUrl) { setUrl(null); return; }
    let active = true;
    let objectUrl: string | null = null;
    api.get<Blob>(fileEndpoint(proofUrl), { responseType: "blob" }).then((response) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(response.data);
      setUrl(objectUrl);
    }).catch(() => { if (active) setUrl(null); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [proofUrl]);
  return url;
}

export async function openSecureFile(proofUrl: string) {
  const response = await api.get<Blob>(fileEndpoint(proofUrl), { responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
