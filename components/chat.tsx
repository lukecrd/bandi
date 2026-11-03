"use client";

import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";

type Message = { role: "user" | "assistant"; content: string };

// Rende cliccabili gli url citati nelle risposte (titolo del bando + link).
function Linkified({ text }: { text: string }) {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, i) =>
    i % 2 ? <a key={i} href={part} target="_blank" rel="noreferrer">{part}</a> : part
  );
}

// Web Speech API: il riconoscimento non è nei tipi DOM standard (Chrome/Edge lo espongono con prefisso webkit).
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: (e: { error: string }) => void;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

// Gli url letti ad alta voce sono incomprensibili: li tolgo.
function speak(text: string, voice?: SpeechSynthesisVoice) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, "").replace(/^- /gm, ""));
  utterance.lang = "it-IT";
  utterance.voice = voice ?? null;
  synth.speak(utterance);
}

// Voci italiane, le più naturali prima: le "Natural/Online" di Edge sono neurali, "Google" di Chrome è discreta.
const naturalness = (v: SpeechSynthesisVoice) =>
  (/natural/i.test(v.name) ? 4 : 0) + (/online|neural/i.test(v.name) ? 2 : 0) + (/google/i.test(v.name) ? 1 : 0);
const NO_VOICES: SpeechSynthesisVoice[] = [];
let italianVoices = NO_VOICES;
// il browser carica le voci in modo asincrono e le annuncia con "voiceschanged"
function subscribeVoices(onChange: () => void) {
  const synth = window.speechSynthesis;
  const update = () => {
    italianVoices = synth.getVoices().filter((v) => v.lang.startsWith("it")).sort((a, b) => naturalness(b) - naturalness(a));
    onChange();
  };
  update();
  synth.addEventListener("voiceschanged", update);
  return () => synth.removeEventListener("voiceschanged", update);
}

const VOICE_KEY = "bandi-chat-voice";
function savedVoice() {
  try {
    return localStorage.getItem(VOICE_KEY) ?? "";
  } catch {
    return "";
  }
}

const noSubscribe = () => () => {};
// false sul server e in idratazione, poi il valore reale del browser
const useBrowserSupport = (check: () => boolean) => useSyncExternalStore(noSubscribe, check, () => false);

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canDictate = useBrowserSupport(() => Boolean(recognitionCtor()));
  const canSpeak = useBrowserSupport(() => "speechSynthesis" in window);
  const [listening, setListening] = useState(false);
  const [readAloud, setReadAloud] = useState(false);
  const voices = useSyncExternalStore(canSpeak ? subscribeVoices : noSubscribe, () => italianVoices, () => NO_VOICES);
  const [voiceURI, setVoiceURI] = useState(() => (typeof window === "undefined" ? "" : savedVoice()));
  const voice = voices.find((v) => v.voiceURI === voiceURI) ?? voices[0];
  const recognition = useRef<Recognition | null>(null);
  const baseInput = useRef("");
  const heardSomething = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const log = useRef<HTMLDivElement>(null);

  // nel pannello lo spazio è poco: resto sull'ultimo messaggio
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [messages, busy]);

  useEffect(() => {
    return () => {
      recognition.current?.stop();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  function toggleDictation() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    if (canSpeak) window.speechSynthesis.cancel();
    const r = new Ctor();
    r.lang = "it-IT";
    r.interimResults = true;
    baseInput.current = input.trim() ? `${input.trim()} ` : "";
    heardSomething.current = false;
    r.onresult = (e) => {
      const heard = Array.from(e.results, (res) => res[0].transcript).join("");
      heardSomething.current = Boolean(heard.trim());
      setInput(baseInput.current + heard);
    };
    r.onerror = (e) => {
      heardSomething.current = false;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Accesso al microfono negato: abilitalo nelle impostazioni del browser.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("Dettatura non riuscita. Riprova.");
      }
    };
    // la dettatura si chiude da sola alla pausa: invio subito la domanda.
    // setTimeout: requestSubmit deve usare il render con l'ultimo testo dettato
    r.onend = () => {
      setListening(false);
      if (heardSomething.current) setTimeout(() => form.current?.requestSubmit());
    };
    recognition.current = r;
    setError("");
    setListening(true);
    r.start();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    recognition.current?.stop();

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError("");
    setBusy(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Errore dell'assistente.");
        // tolgo la domanda senza risposta, così la cronologia resta alternata
        setMessages(messages);
        setInput(text);
      } else {
        setMessages([...next, { role: "assistant", content: result.answer }]);
        if (readAloud && canSpeak) speak(result.answer, voice);
      }
    } catch {
      setError("Connessione non riuscita. Riprova.");
      setMessages(messages);
      setInput(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="chat">
      <div ref={log} className="chat-log" aria-live="polite">
        {!messages.length && (
          <p className="muted">
            Esempi: &quot;Quali bandi aperti scadono questo mese per il manifatturiero in Toscana?&quot; ·
            &quot;Quali bandi vanno bene per il cliente Rossi?&quot;
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            <div className="chat-meta muted small">
              {m.role === "user" ? "Tu" : "Assistente"}
              {m.role === "assistant" && canSpeak && (
                <button type="button" className="btn ghost small" onClick={() => speak(m.content, voice)} aria-label="Leggi questa risposta ad alta voce">
                  🔊 Ascolta
                </button>
              )}
            </div>
            <div className="chat-text"><Linkified text={m.content} /></div>
          </div>
        ))}
        {busy && <p className="muted small">Sto consultando bandi e clienti…</p>}
      </div>
      {error && <div className="error">{error}</div>}
      <form ref={form} onSubmit={submit} className="chat-form">
        <div className="field grow">
          <label htmlFor="chat-input" className="sr-only">Domanda</label>
          <textarea
            id="chat-input"
            rows={2}
            value={input}
            maxLength={4000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={listening ? "Sto ascoltando…" : "Scrivi o detta una domanda su bandi o clienti…"}
          />
        </div>
        {canDictate && (
          <button
            type="button"
            className={`btn secondary${listening ? " listening" : ""}`}
            onClick={toggleDictation}
            aria-pressed={listening}
            aria-label={listening ? "Interrompi dettatura" : "Detta la domanda"}
          >
            {listening ? "⏹ Stop" : "🎤 Detta"}
          </button>
        )}
        <button className="btn" disabled={busy || !input.trim()}>Invia</button>
      </form>
      {canSpeak && (
        <label className="chat-option small muted">
          <input
            type="checkbox"
            checked={readAloud}
            onChange={(e) => {
              setReadAloud(e.target.checked);
              if (!e.target.checked) window.speechSynthesis.cancel();
            }}
          />{" "}
          Leggi le risposte ad alta voce
        </label>
      )}
      {canSpeak && voices.length > 1 && (
        <div className="chat-option small muted">
          <label htmlFor="chat-voice">Voce</label>
          <select
            id="chat-voice"
            value={voice?.voiceURI ?? ""}
            onChange={(e) => {
              setVoiceURI(e.target.value);
              try {
                localStorage.setItem(VOICE_KEY, e.target.value);
              } catch {}
              const chosen = voices.find((v) => v.voiceURI === e.target.value);
              speak("Ciao, sono la voce dell'assistente.", chosen);
            }}
          >
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name.replace(/^Microsoft /, "")}</option>
            ))}
          </select>
        </div>
      )}
    </section>
  );
}
