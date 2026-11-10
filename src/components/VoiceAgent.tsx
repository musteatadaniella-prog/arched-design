"use client";

import Script from "next/script";
import { createElement, useEffect, useRef } from "react";

// "Vorbește cu noi" button: the ElevenLabs voice agent widget. The agent's
// show_section client tool scrolls this page to an anchor without reloading,
// so the conversation keeps going. Unknown sections are refused, and the agent
// tells the visitor there is no such section. Leads go through the agent's
// create_lead webhook tool to /api/voice/lead (secret header, set in ElevenLabs).

const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

// Must match the section ids on the home page and the list in the agent's prompt.
const SECTIONS = ["services", "projects", "process", "team", "faq", "contact"] as const;

function showSection(params: { section?: unknown }): string {
  const id = String(params?.section ?? "").toLowerCase().trim();
  const el = (SECTIONS as readonly string[]).includes(id) ? document.getElementById(id) : null;
  if (!el) {
    return `not_found: there is no "${id}" section on the site. Tell the visitor it does not exist. Available: ${SECTIONS.join(", ")}.`;
  }
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  // Update the address bar without a navigation, so nothing reloads.
  history.replaceState(null, "", `#${id}`);
  return `shown: the page is now scrolled to the "${id}" section. Briefly tell the visitor what they see and continue the conversation.`;
}

type CallEvent = Event & { detail: { config: { clientTools?: Record<string, unknown> } } };

export function VoiceAgent() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const widget = ref.current;
    if (!widget) return;
    const onCall = (e: Event) => {
      const { config } = (e as CallEvent).detail;
      config.clientTools = { ...config.clientTools, show_section: showSection };
    };
    widget.addEventListener("elevenlabs-convai:call", onCall);
    return () => widget.removeEventListener("elevenlabs-convai:call", onCall);
  }, []);

  if (!AGENT_ID) return null;

  return (
    <>
      {createElement("elevenlabs-convai", {
        ref,
        "agent-id": AGENT_ID,
        "action-text": "Vorbește cu noi",
        "start-call-text": "Începe discuția",
        "end-call-text": "Încheie",
        "listening-text": "Vă ascult…",
        "speaking-text": "Vorbește asistentul",
      })}
      <Script src="https://unpkg.com/@elevenlabs/convai-widget-embed" strategy="afterInteractive" />
    </>
  );
}
