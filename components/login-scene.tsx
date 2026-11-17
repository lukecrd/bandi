"use client";

import { useEffect, useRef, useState } from "react";
import { ItalyCanvas } from "@/components/italy-canvas";

const SCENES: { id: string; label: string; heading: string | null; title: string; body: string }[] = [
  {
    id: "mappa",
    label: "La mappa",
    heading: null,
    title: "Bandi aperti, regione per regione.",
    body: "Il catalogo si aggiorna ogni giorno dalle fonti ufficiali.",
  },
  {
    id: "fonti",
    label: "Fonti",
    heading: "Ogni fonte ufficiale, in un posto solo.",
    title: "Ogni fonte ufficiale, in un posto solo.",
    body: "Incentivi Italia, Camere di Commercio, Regioni e Unione europea.",
  },
  {
    id: "matching",
    label: "Matching",
    heading: "Il bando giusto al cliente giusto.",
    title: "Il bando giusto al cliente giusto.",
    body: "Regione, dimensione d'impresa, codice ATECO e obiettivi a confronto.",
  },
  {
    id: "scadenze",
    label: "Scadenze",
    heading: "Nessuna scadenza persa.",
    title: "Nessuna scadenza persa.",
    body: "Nuovi bandi e chiusure imminenti segnalati in tempo.",
  },
  {
    id: "accedi",
    label: "Accedi",
    heading: "Inizia da qui.",
    title: "Inizia da qui.",
    body: "Accedi con le credenziali dello studio.",
  },
];

export function LoginScene({
  counts,
  total,
  children,
}: {
  counts: Record<string, number>;
  total: number;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(0);
  const [compact, setCompact] = useState(false);
  const sections = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    // Stessa soglia del CSS: sotto, le scene diventano blocchi di testo normali.
    const mq = window.matchMedia("(max-width: 1023.9px), (max-height: 639.9px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) setActive(sections.current.indexOf(e.target as HTMLElement));
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );
    sections.current.forEach((s) => s && io.observe(s));
    return () => io.disconnect();
  }, []);

  function go(i: number) {
    sections.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="lp">
      <ItalyCanvas heading={compact ? null : SCENES[active].heading} counts={counts} compact={compact} />

      <div className="lp-grid">
        <div className="lp-side">
          <div className="lp-hero">
            <p className="lp-kicker">Finanza agevolata · console dello studio</p>
            <h1>BandiMatch</h1>
            {total > 0 && (
              <p className="lp-stat">
                <strong>{total.toLocaleString("it-IT")}</strong> bandi aperti o in arrivo
              </p>
            )}
            <div className="login-card" id="accesso">
              {children}
            </div>
          </div>
        </div>

        <div className="lp-scenes">
          {SCENES.map((s, i) => (
            <section
              key={s.id}
              ref={(el) => {
                sections.current[i] = el;
              }}
              className="lp-scene"
              aria-labelledby={`scena-${s.id}`}
            >
              <div className="lp-caption">
                <p className="lp-kicker">
                  {String(i + 1).padStart(2, "0")} · {s.label}
                </p>
                {/* Su desktop il titolo lo disegnano i puntini: resta per i lettori di schermo. */}
                <h2 id={`scena-${s.id}`} className={s.heading ? "lp-drawn" : undefined}>
                  {s.title}
                </h2>
                <p>{s.body}</p>
                {s.id === "accedi" && (
                  <a className="lp-cta" href="#accesso">
                    Vai all&apos;accesso ↑
                  </a>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      <nav className="lp-nav" aria-label="Scene">
        {SCENES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={i === active ? "is-active" : undefined}
            aria-current={i === active ? "true" : undefined}
            onClick={() => go(i)}
          >
            {s.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
