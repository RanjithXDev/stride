-- Add CPO (Chief People Officer) and HR roles to the Role enum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CPO';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HR';

-- Update org settings defaults to include new roles in enabledRoles
UPDATE "Organization"
SET settings = settings || '{"enabledRoles": ["FOUNDER","CPO","CFO","HR","MANAGER","TEAM_LEAD","EMPLOYEE"], "roleLabels": {"FOUNDER":"Founder","CPO":"CPO","CFO":"CFO","HR":"HR Manager","MANAGER":"Manager","TEAM_LEAD":"Team Lead","EMPLOYEE":"Employee"}}'::jsonb
WHERE settings->>'enabledRoles' IS NOT NULL;
