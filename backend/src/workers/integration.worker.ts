import { prisma } from "../lib/prisma";
import { processJob } from "../services/scm/access.service";

export function startIntegrationWorker() {
  console.log("Integration worker started — polling every 30s");

  setInterval(async () => {
    try {
      const jobs = await prisma.integrationJob.findMany({
        where: {
          status: { in: ["PENDING", "FAILED"] },
          nextAttemptAt: { lte: new Date() },
          attemptCount: { lt: 5 },
        },
        take: 10,
        orderBy: { nextAttemptAt: "asc" },
      });

      for (const job of jobs) {
        await prisma.integrationJob.update({ where: { id: job.id }, data: { status: "RUNNING", attemptCount: { increment: 1 } } });

        try {
          await processJob(job);
          await prisma.integrationJob.update({ where: { id: job.id }, data: { status: "DONE" } });
        } catch (err: any) {
          const attempt = job.attemptCount + 1;
          const isDead = attempt >= 5;
          const nextDelay = Math.pow(2, attempt) * 60_000;
          await prisma.integrationJob.update({
            where: { id: job.id },
            data: {
              status: isDead ? "DEAD" : "FAILED",
              nextAttemptAt: new Date(Date.now() + nextDelay),
              lastError: String(err?.message ?? err),
            },
          });
        }
      }
    } catch (err) {
      console.error("Integration worker error:", err);
    }
  }, 30_000);
}
