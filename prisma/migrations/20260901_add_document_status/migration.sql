-- Add document approval and audit status columns
ALTER TABLE "Document" ADD COLUMN "userApprovalStatus" TEXT DEFAULT "Pendente"; -- "Pendente", "Aprovado", "Desaprovado"
ALTER TABLE "Document" ADD COLUMN "auditorViewedAt" TEXT;
ALTER TABLE "Document" ADD COLUMN "auditViewedBy" TEXT;
ALTER TABLE "Document" ADD COLUMN "hasNonConformity" BOOLEAN DEFAULT FALSE;
ALTER TABLE "Document" ADD COLUMN "nonConformityResolvedAt" TEXT;
