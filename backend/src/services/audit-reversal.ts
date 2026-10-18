export const REVERSIBLE_TICKET_FIELDS = [
  "title", "description", "status", "priority", "type", "assigneeId",
  "dueDate", "estimation", "parentId", "closedAt", "deletedAt",
] as const;

export type TicketReversalState = Record<string, unknown>;

export type ReversalCandidate = {
  reversible: boolean;
  reversibleUntil: Date | null;
  resourceVersion: number | null;
  beforeState: TicketReversalState | null;
  afterState: TicketReversalState | null;
  alreadyReversed: boolean;
};

export type ReversalPreview = {
  allowed: boolean;
  code?: "NOT_REVERSIBLE" | "ALREADY_REVERSED" | "EXPIRED" | "VERSION_CONFLICT" | "INVALID_EVENT";
  message?: string;
  changes: Array<{ field: string; current: unknown; restored: unknown }>;
};

export function planTicketReversal(candidate: ReversalCandidate, current: TicketReversalState, now = new Date()): ReversalPreview {
  if (!candidate.reversible) return denied("NOT_REVERSIBLE", "This activity cannot be reversed");
  if (candidate.alreadyReversed) return denied("ALREADY_REVERSED", "This activity has already been reversed");
  if (candidate.reversibleUntil && candidate.reversibleUntil.getTime() < now.getTime()) return denied("EXPIRED", "The reversal window has expired");
  if (!candidate.beforeState || !candidate.afterState || candidate.resourceVersion === null) return denied("INVALID_EVENT", "The activity does not contain a complete reversal snapshot");
  if (current.version !== candidate.resourceVersion) return denied("VERSION_CONFLICT", "The ticket has changed since this activity. Reverse the newer changes first");

  const changes = REVERSIBLE_TICKET_FIELDS
    .filter((field) => !sameValue(candidate.beforeState?.[field], candidate.afterState?.[field]))
    .map((field) => ({ field, current: current[field], restored: candidate.beforeState?.[field] }));
  if (!changes.length) return denied("INVALID_EVENT", "This activity has no reversible ticket changes");
  return { allowed: true, changes };
}

function denied(code: NonNullable<ReversalPreview["code"]>, message: string): ReversalPreview {
  return { allowed: false, code, message, changes: [] };
}

function sameValue(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}
