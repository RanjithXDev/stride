import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DEFAULT_ORG_ID = "org_default";

async function main() {
  if (process.env.NODE_ENV === "production" || process.env.ALLOW_INSECURE_DEMO_SEED !== "true") {
    throw new Error("Demo seeding is disabled. Use a disposable database and set ALLOW_INSECURE_DEMO_SEED=true explicitly.");
  }
  const hash = (p: string) => bcrypt.hash(p, 10);

  // Ensure the default org exists
  await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: {
      id: DEFAULT_ORG_ID,
      name: "Stride Demo Company",
      slug: "stride-demo",
      plan: "ENTERPRISE",
      settings: {
        halfDayMinutes: 240, fullDayMinutes: 480,
        workdayStart: "09:00", workdayEnd: "18:00",
        timezone: "Asia/Kolkata", allowWFH: true, requireLocation: false,
        enabledRoles: ["FOUNDER","CPO","CFO","HR","MANAGER","TEAM_LEAD","EMPLOYEE"],
        roleLabels: { FOUNDER:"Founder", CPO:"CPO", CFO:"CFO", HR:"HR Manager", MANAGER:"Manager", TEAM_LEAD:"Team Lead", EMPLOYEE:"Employee" },
      },
    },
  });

  const engineering = await prisma.department.upsert({
    where: { name_organizationId: { name: "Engineering", organizationId: DEFAULT_ORG_ID } },
    update: {},
    create: { name: "Engineering", organizationId: DEFAULT_ORG_ID },
  });
  const finance = await prisma.department.upsert({
    where: { name_organizationId: { name: "Finance", organizationId: DEFAULT_ORG_ID } },
    update: {},
    create: { name: "Finance", organizationId: DEFAULT_ORG_ID },
  });

  const hr = await prisma.department.upsert({
    where: { name_organizationId: { name: "Human Resources", organizationId: DEFAULT_ORG_ID } },
    update: {},
    create: { name: "Human Resources", organizationId: DEFAULT_ORG_ID },
  });

  const founder = await prisma.user.upsert({
    where: { email: "founder@opscore.dev" },
    update: { organizationId: DEFAULT_ORG_ID, isSuperAdmin: true },
    create: {
      name: "Alex Founder", email: "founder@opscore.dev",
      password: await hash("founder123"), role: Role.FOUNDER,
      organizationId: DEFAULT_ORG_ID, isSuperAdmin: true,
    },
  });

  const cfo = await prisma.user.upsert({
    where: { email: "cfo@opscore.dev" },
    update: { organizationId: DEFAULT_ORG_ID },
    create: {
      name: "Sam CFO", email: "cfo@opscore.dev",
      password: await hash("cfo123"), role: Role.CFO,
      departmentId: finance.id, organizationId: DEFAULT_ORG_ID,
    },
  });

  const hrManager = await prisma.user.upsert({
    where: { email: "hr@opscore.dev" },
    update: { organizationId: DEFAULT_ORG_ID },
    create: {
      name: "Morgan HR", email: "hr@opscore.dev",
      password: await hash("hr123"), role: Role.HR,
      departmentId: hr.id, managerId: founder.id, organizationId: DEFAULT_ORG_ID,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@opscore.dev" },
    update: { organizationId: DEFAULT_ORG_ID },
    create: {
      name: "Jordan Manager", email: "manager@opscore.dev",
      password: await hash("manager123"), role: Role.MANAGER,
      departmentId: engineering.id, managerId: founder.id, organizationId: DEFAULT_ORG_ID,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: "employee@opscore.dev" },
    update: { organizationId: DEFAULT_ORG_ID },
    create: {
      name: "Riley Employee", email: "employee@opscore.dev",
      password: await hash("employee123"), role: Role.EMPLOYEE,
      departmentId: engineering.id, managerId: manager.id, organizationId: DEFAULT_ORG_ID,
    },
  });

  const project = await prisma.project.upsert({
    where: { id: "seed-project-1" },
    update: { organizationId: DEFAULT_ORG_ID },
    create: {
      id: "seed-project-1", name: "OpsCore MVP",
      description: "Build the initial platform", status: "ACTIVE",
      departmentId: engineering.id, organizationId: DEFAULT_ORG_ID,
    },
  });

  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: manager.id } },
    update: {}, create: { projectId: project.id, userId: manager.id, role: "Lead" },
  });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: employee.id } },
    update: {}, create: { projectId: project.id, userId: employee.id, role: "Developer" },
  });

  await prisma.ticket.createMany({
    skipDuplicates: true,
    data: [
      { id: "ticket-1", title: "Set up authentication flow", status: "CLOSED",    priority: "HIGH",   type: "TASK",    projectId: project.id, reporterId: manager.id, assigneeId: employee.id },
      { id: "ticket-2", title: "Design ticket list UI",       status: "IN_PROGRESS", priority: "MEDIUM", type: "FEATURE", projectId: project.id, reporterId: manager.id, assigneeId: employee.id },
      { id: "ticket-3", title: "Fix date formatting",         status: "OPEN",     priority: "LOW",    type: "BUG",     projectId: project.id, reporterId: employee.id },
      { id: "ticket-4", title: "Add time logging to tickets", status: "OPEN",     priority: "MEDIUM", type: "FEATURE", projectId: project.id, reporterId: manager.id,  assigneeId: manager.id },
    ],
  });

  console.log("✓ Disposable demo seed complete. Rotate all demo credentials before sharing the environment.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
