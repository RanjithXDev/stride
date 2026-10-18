import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (typeof document !== "undefined" && !["get", "head", "options"].includes(String(config.method).toLowerCase())) {
    const csrf = document.cookie.split("; ").find((part) => part.startsWith("stride_csrf="))?.split("=")[1];
    if (csrf) config.headers["X-CSRF-Token"] = decodeURIComponent(csrf);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login?reason=session_expired";
    }
    return Promise.reject(err);
  }
);

export default api;
