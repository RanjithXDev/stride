import { ApiError } from "./api-error";

export function normalizeAllowedScmHost(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new ApiError(400, "Invalid GitLab host", "INVALID_SCM_HOST"); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || url.pathname !== "/" || url.search || url.hash) {
    throw new ApiError(400, "GitLab host must be an HTTPS origin without credentials, path, query, or custom port", "INVALID_SCM_HOST");
  }
  const allowed = new Set(["gitlab.com", ...(process.env.SCM_ALLOWED_HOSTS ?? "").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean)]);
  if (!allowed.has(url.hostname.toLowerCase())) throw new ApiError(400, "GitLab host is not allowlisted", "INVALID_SCM_HOST");
  return url.origin;
}
