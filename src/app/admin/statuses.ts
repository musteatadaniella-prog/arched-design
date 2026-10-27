export const STATUSES = ["new", "in_progress", "closed"] as const;
export type LeadStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Nouă",
  in_progress: "În lucru",
  closed: "Închisă",
};

export function isStatus(v: unknown): v is LeadStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}
