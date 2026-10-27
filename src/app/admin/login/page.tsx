"use client";

import { useActionState } from "react";
import { Logo } from "@/components/Logo";
import { signIn, type LoginState } from "../actions";

const inputCls =
  "w-full border-b border-line bg-transparent py-3 outline-none transition-colors placeholder:text-muted focus:border-ink";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <form action={action} className="w-full max-w-sm border border-line bg-surface p-8 sm:p-10">
        <Logo className="h-12 w-12 text-ink" strokeWidth={7} />
        <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-muted">ARCHED design</p>
        <h1 className="mt-2 font-display text-3xl uppercase">Administrare</h1>

        <label className="mt-8 block">
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">Email</span>
          <input name="email" type="email" autoComplete="username" required defaultValue={state.email} key={state.email} className={inputCls} />
        </label>
        <label className="mt-6 block">
          <span className="font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">Parolă</span>
          <input name="password" type="password" autoComplete="current-password" required className={inputCls} />
        </label>

        {state.error && (
          <p role="alert" className="mt-5 text-sm text-[#b4533f]">
            {state.error}
          </p>
        )}

        <button
          disabled={pending}
          className="mt-8 w-full bg-ink py-3.5 font-mono text-xs uppercase tracking-[0.2em] text-surface transition-opacity disabled:opacity-60"
        >
          {pending ? "Se verifică…" : "Intră"}
        </button>
      </form>
    </main>
  );
}
