"use client";

import { useEffect, useRef, useState } from "react";
import { Chat } from "@/components/chat";

// Chat sempre montata (solo nascosta): la conversazione resta chiudendo il pannello o cambiando pagina.
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    document.getElementById("chat-input")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div id="chat-panel" className="chat-panel" role="dialog" aria-labelledby="chat-panel-title" hidden={!open}>
        <div className="chat-panel-head">
          <div>
            <strong id="chat-panel-title">Assistente</strong>
            <p className="muted small">Risposte generate da AI: verifica sempre sul bando originale.</p>
          </div>
          <button type="button" className="btn ghost" onClick={() => setOpen(false)} aria-label="Chiudi assistente">✕</button>
        </div>
        <Chat />
      </div>
      <button
        ref={toggle}
        type="button"
        className="chat-fab"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="chat-panel"
        aria-label={open ? "Chiudi assistente" : "Apri assistente"}
      >
        {open ? "✕" : "💬"}
      </button>
    </>
  );
}
