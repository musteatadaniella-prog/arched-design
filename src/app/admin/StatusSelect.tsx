"use client";

import { useState, useTransition } from "react";
import { updateStatus } from "./actions";
import { STATUSES, STATUS_LABEL, STATUS_TONE, type LeadStatus } from "./statuses";

export function StatusSelect({ id, status }: { id: string; status: LeadStatus }) {
  const [value, setValue] = useState(status);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Etapă"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as LeadStatus;
          const prev = value;
          setValue(next);
          setFailed(false);
          start(async () => {
            const res = await updateStatus(id, next);
            if (!res.ok) {
              setValue(prev);
              setFailed(true);
            }
          });
        }}
        className={`cursor-pointer border px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.12em] outline-none transition-colors disabled:opacity-60 ${STATUS_TONE[value]}`}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="bg-surface text-ink">
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      {failed && (
        <span role="alert" className="text-xs text-[#b4533f]">
          Eroare
        </span>
      )}
    </div>
  );
}
