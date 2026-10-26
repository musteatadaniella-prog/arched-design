// Shape and validation of a contact-form request. Shared by the form (instant
// feedback) and the API route (the server never trusts the browser).

export type LeadKind = "quote" | "meeting";

export type LeadInput = {
  kind: LeadKind;
  name: string;
  phone: string;
  comment?: string;
  email?: string;
  projectType?: string;
  area?: string;
  meetingDate?: string; // YYYY-MM-DD
  meetingTime?: string; // HH:MM
  website?: string; // honeypot: real visitors never see or fill it
};

export type LeadErrorKey = "required" | "name" | "phone" | "email" | "slot" | "tooLong";
export type LeadErrors = Partial<Record<"name" | "phone" | "email" | "comment" | "slot", LeadErrorKey>>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function validateLead(raw: unknown): { lead: LeadInput; errors: LeadErrors } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const lead: LeadInput = {
    kind: r.kind === "meeting" ? "meeting" : "quote",
    name: str(r.name),
    phone: str(r.phone),
    comment: str(r.comment),
    email: str(r.email),
    projectType: str(r.projectType),
    area: str(r.area),
    meetingDate: str(r.meetingDate),
    meetingTime: str(r.meetingTime),
    website: str(r.website),
  };

  const errors: LeadErrors = {};

  if (!lead.name) errors.name = "required";
  else if (lead.name.length < 2 || lead.name.length > 100) errors.name = "name";

  const digits = lead.phone.replace(/\D/g, "");
  if (!lead.phone) errors.phone = "required";
  else if (!/^[+\d\s()-]+$/.test(lead.phone) || digits.length < 7 || digits.length > 15) errors.phone = "phone";

  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) errors.email = "email";
  if ((lead.comment ?? "").length > 2000) errors.comment = "tooLong";

  if (lead.kind === "meeting") {
    const okDate = /^\d{4}-\d{2}-\d{2}$/.test(lead.meetingDate ?? "");
    const okTime = /^\d{2}:\d{2}$/.test(lead.meetingTime ?? "");
    if (!okDate || !okTime) errors.slot = "slot";
  }

  return { lead, errors };
}
