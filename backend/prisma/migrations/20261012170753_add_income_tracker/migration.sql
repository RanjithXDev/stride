-- CreateEnum
CREATE TYPE "IncomeCategory" AS ENUM ('CLIENT_PAYMENT', 'PROJECT_REVENUE', 'INVESTMENT', 'GRANT', 'SERVICE', 'PRODUCT_SALE', 'REFUND', 'OTHER');

-- CreateEnum
CREATE TYPE "IncomeStatus" AS ENUM ('PENDING', 'RECEIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Income" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" "IncomeCategory" NOT NULL DEFAULT 'OTHER',
    "description" TEXT,
    "status" "IncomeStatus" NOT NULL DEFAULT 'PENDING',
    "proofUrl" TEXT,
    "proofName" TEXT,
    "proofType" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Income_organizationId_status_idx" ON "Income"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Income_organizationId_date_idx" ON "Income"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
