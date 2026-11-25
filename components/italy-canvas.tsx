"use client";

import { useEffect, useRef } from "react";
import { ITALY_ASPECT, ITALY_POINTS, ITALY_REGIONS } from "@/lib/italy-points";

type Particle = {
  x: number; y: number;   // posizione attuale
  hx: number; hy: number; // posto nella mappa
  a: number; ta: number;  // opacità attuale e di destinazione
  coast: boolean;
  delay: number;
  phase: number;
};

// Sul fondo --ink: punti nell'accento, regioni con bandi in bianco.
const DOT = "126, 162, 255"; // --ink-accent
const HOT = "255, 255, 255";

function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/**
 * Puntini che si raccolgono nella sagoma dell'Italia; le regioni con bandi pulsano
 * e a turno mostrano il conteggio. `counts` usa i nomi di ITALY_REGIONS.
 */
export function ItalyCanvas({ counts }: { counts: Record<string, number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // La dashboard si ri-renderizza a ogni clic su un bando: l'animazione riparte solo se i numeri cambiano.
  const signature = JSON.stringify(counts);

  useEffect(() => {
    const counts: Record<string, number> = JSON.parse(signature);
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fontFamily = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
    const rnd = seeded(20261117);

    let w = 0, h = 0, mapLeft = 0, mapTop = 0, mapH = 0;
    let frame = 0;
    let start = 0;
    let visible = false;

    const particles: Particle[] = [];
    for (let i = 0; i < ITALY_POINTS.length; i += 3) {
      const coast = ITALY_POINTS[i + 2] === 1;
      particles.push({
        x: 0, y: 0, hx: 0, hy: 0, a: 0, ta: coast ? 0.85 : 0.4, coast,
        delay: reduce ? 0 : rnd() * 1100,
        phase: rnd() * Math.PI * 2,
      });
    }
    const hotspots = ITALY_REGIONS
      .map((r) => ({ ...r, n: counts[r.name] ?? 0 }))
      .filter((r) => r.n > 0)
      .sort((a, b) => b.n - a.n);

    function layout() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas!.clientWidth;
      h = canvas!.clientHeight;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      mapH = Math.min(h * 0.94, (w * 0.94) / ITALY_ASPECT);
      mapLeft = (w - mapH * ITALY_ASPECT) / 2;
      mapTop = (h - mapH) / 2;
      particles.forEach((p, i) => {
        p.hx = mapLeft + ITALY_POINTS[i * 3] * mapH;
        p.hy = mapTop + ITALY_POINTS[i * 3 + 1] * mapH;
      });
    }

    function drawHotspots(t: number, alpha: number) {
      if (!hotspots.length) return;
      const focus = Math.floor(t / 2600) % Math.min(6, hotspots.length);
      const cycle = (t % 2600) / 2600;
      const mapMidX = mapLeft + (mapH * ITALY_ASPECT) / 2;

      hotspots.forEach((r, i) => {
        const x = mapLeft + r.x * mapH;
        const y = mapTop + r.y * mapH;
        const pulse = reduce ? 0.5 : (t / 1900 + i * 0.137) % 1;
        ctx!.strokeStyle = `rgba(${DOT}, ${alpha * (1 - pulse) * 0.55})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(x, y, 3 + pulse * (i === focus ? 20 : 12), 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.fillStyle = `rgba(${HOT}, ${alpha})`;
        ctx!.beginPath();
        ctx!.arc(x, y, i === focus ? 3.2 : 2.2, 0, Math.PI * 2);
        ctx!.fill();
      });

      const r = hotspots[focus];
      const x = mapLeft + r.x * mapH;
      const y = mapTop + r.y * mapH;
      const fade = alpha * (reduce ? 1 : Math.sin(Math.PI * Math.min(1, cycle * 1.15)));
      const right = x < mapMidX;
      const lx = x + (right ? 14 : -14);
      ctx!.textAlign = right ? "left" : "right";
      ctx!.textBaseline = "middle";
      // Alone scuro: le etichette cadono anche sui puntini.
      ctx!.strokeStyle = `rgba(10, 15, 26, ${fade})`; // --ink
      ctx!.lineWidth = 6;
      ctx!.lineJoin = "round";
      ctx!.font = `600 13px ${fontFamily}`;
      ctx!.strokeText(r.name, lx, y - 10);
      ctx!.fillStyle = `rgba(${HOT}, ${fade})`;
      ctx!.fillText(r.name, lx, y - 10);
      ctx!.font = `600 12px ${fontFamily}`;
      ctx!.fillStyle = `rgba(${DOT}, ${fade})`;
      ctx!.strokeText(`${r.n.toLocaleString("it-IT")} bandi`, lx, y + 10);
      ctx!.fillText(`${r.n.toLocaleString("it-IT")} bandi`, lx, y + 10);
    }

    function tick(now: number) {
      if (!start) start = now;
      const t = now - start;
      const k = reduce ? 1 : 0.075;
      ctx!.clearRect(0, 0, w, h);
      for (const p of particles) {
        if (t < p.delay) continue;
        p.x += (p.hx - p.x) * k;
        p.y += (p.hy - p.y) * k;
        p.a += (p.ta - p.a) * (reduce ? 1 : 0.05);
        const drift = reduce ? 0 : Math.sin(t * 0.0012 + p.phase) * 0.5;
        const s = p.coast ? 1.6 : 1.3;
        ctx!.fillStyle = `rgba(${DOT}, ${p.a})`;
        ctx!.fillRect(p.x + drift, p.y - drift * 0.5, s, s);
      }
      // Le regioni compaiono quando la sagoma è quasi formata.
      drawHotspots(t, reduce ? 1 : Math.min(1, Math.max(0, (t - 1200) / 800)));
      frame = visible && !reduce ? requestAnimationFrame(tick) : 0;
    }

    layout();
    for (const p of particles) {
      // Partenza sparsa nel riquadro, poi i puntini volano al loro posto.
      p.x = reduce ? p.hx : rnd() * w;
      p.y = reduce ? p.hy : rnd() * h;
    }

    // Disegna solo quando la card è sullo schermo: in dashboard non serve consumare CPU fuori vista.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(tick);
    });
    io.observe(canvas);
    const ro = new ResizeObserver(() => {
      layout();
      if (reduce) requestAnimationFrame(tick);
    });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      io.disconnect();
      ro.disconnect();
    };
  }, [signature]);

  return <canvas ref={ref} className="italy-canvas" aria-hidden="true" />;
}
