import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import authRoutes       from "./routes/auth.routes";
import ticketRoutes     from "./routes/ticket.routes";
import employeeRoutes   from "./routes/employee.routes";
import projectRoutes    from "./routes/project.routes";
import expenseRoutes    from "./routes/expense.routes";
import incomeRoutes     from "./routes/income.routes";
import scmRoutes        from "./routes/scm.routes";
import pmRoutes         from "./routes/pm.routes";
import dashboardRoutes    from "./routes/dashboard.routes";
import timesheetRoutes   from "./routes/timesheet.routes";
import attendanceRoutes    from "./routes/attendance.routes";
import organizationRoutes      from "./routes/organization.routes";
import integrationRoutes       from "./routes/integration.routes";
import projectRepositoryRoutes from "./routes/project-repository.routes";
import searchRoutes            from "./routes/search.routes";
import auditRoutes             from "./routes/audit.routes";
import fileRoutes              from "./routes/file.routes";
import { startIntegrationWorker } from "./workers/integration.worker";
import { startAttendanceWorker }  from "./workers/attendance.worker";
import { apiErrorHandler } from "./lib/api-error";
import { apiRateLimit } from "./middleware/rate-limit";
import { csrfProtection } from "./middleware/csrf";
import { validateSecurityConfig } from "./lib/security-config";

validateSecurityConfig();
const app = express();

app.disable("x-powered-by");
if (process.env.TRUST_PROXY_HOPS) app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(morgan("dev"));

// Capture raw body for webhook HMAC verification before JSON parsing
app.use((req, _res, next) => {
  if (req.path.startsWith("/api/v1/scm/webhooks/")) {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      (req as any).rawBody = Buffer.concat(chunks);
      try { (req as any).body = JSON.parse((req as any).rawBody.toString("utf8")); } catch {}
      next();
    });
  } else {
    next();
  }
});

app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use(csrfProtection);
app.use("/api", apiRateLimit);

app.use("/api/v1/auth",       authRoutes);
app.use("/api/v1/tickets",    ticketRoutes);
app.use("/api/v1/employees",  employeeRoutes);
app.use("/api/v1/projects",   projectRoutes);
app.use("/api/v1/expenses",   expenseRoutes);
app.use("/api/v1/incomes",    incomeRoutes);
app.use("/api/v1/scm",        scmRoutes);
app.use("/api/v1/pm",         pmRoutes);
app.use("/api/v1/dashboard",   dashboardRoutes);
app.use("/api/v1/timesheets",  timesheetRoutes);
app.use("/api/v1/attendance",    attendanceRoutes);
app.use("/api/v1/org",          organizationRoutes);
app.use("/api/v1/integrations", integrationRoutes);
app.use("/api/v1/search",       searchRoutes);
app.use("/api/v1/audit-events", auditRoutes);
app.use("/api/v1/files",        fileRoutes);
app.use("/api/v1",              projectRepositoryRoutes);
app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

// Global error handler — must be last middleware
app.use(apiErrorHandler);

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
  startIntegrationWorker();
  startAttendanceWorker();
});
