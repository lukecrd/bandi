"use client";

import { useEffect, useRef } from "react";
import { ITALY_ASPECT, ITALY_POINTS, ITALY_REGIONS } from "@/lib/italy-points";

type Particle = {
  x: number; y: number;     // posizione attuale
  hx: number; hy: number;   // posto nella mappa
  tx: number; ty: number;   // destinazione della scena corrente
  a: number; ta: number;    // opacità attuale e di destinazione
  coast: boolean;
  delay: number;
  phase: number;
};

const INK = "74, 58, 156";   // --brand
const STAMP = "192, 57, 43"; // --margin
const NAV_GUTTER = 150;      // spazio per l'indice delle scene a destra

function seeded(seed: number) {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

/**
 * Puntini che si raccolgono nella sagoma dell'Italia; con `heading` si ricompongono nel testo.
 * `counts` sono i bandi aperti per regione (nomi come in ITALY_REGIONS).
 */
export function ItalyCanvas({
  heading,
  counts,
  compact,
}: {
  heading: string | null;
  counts: Record<string, number>;
  compact: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const showHeading = useRef<(h: string | null) => void>(null);

  useEffect(() => {
    showHeading.current?.(heading);
  }, [heading]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fontFamily = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
    const rnd = seeded(20261117);
    const scratch = document.createElement("canvas");

    let w = 0, h = 0, mapLeft = 0, mapTop = 0, mapH = 0;
    let current: string | null = null;
    let hotAlpha = 0;
    let frame = 0;
    let start = 0;

    const particles: Particle[] = [];
    for (let i = 0; i < ITALY_POINTS.length; i += 3) {
      particles.push({
        x: 0, y: 0, hx: 0, hy: 0, tx: 0, ty: 0, a: 0, ta: 0,
        coast: ITALY_POINTS[i + 2] === 1,
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

      if (compact) {
        mapH = Math.min(h * 0.72, (w * 0.92) / ITALY_ASPECT);
        mapLeft = (w - mapH * ITALY_ASPECT) / 2;
      } else {
        mapH = Math.min(h * 0.84, ((w - 480 - NAV_GUTTER) * 0.95) / ITALY_ASPECT);
        const mapW = mapH * ITALY_ASPECT;
        mapLeft = Math.min(Math.max(w * 0.64 - mapW / 2, 480), w - NAV_GUTTER - mapW);
      }
      mapTop = (h - mapH) / 2;
      particles.forEach((p, i) => {
        p.hx = mapLeft + ITALY_POINTS[i * 3] * mapH;
        p.hy = mapTop + ITALY_POINTS[i * 3 + 1] * mapH;
      });
    }

    function textTargets(text: string) {
      const sctx = scratch.getContext("2d", { willReadFrequently: true });
      if (!sctx) return [];
      const left = compact ? w * 0.06 : 500;
      const maxW = (compact ? w * 0.88 : w - left - NAV_GUTTER) * 0.95;
      const size = Math.round(Math.max(30, Math.min(64, w * 0.042)));
      const font = `700 ${size}px ${fontFamily}`;
      sctx.font = font;
      const lines: string[] = [];
      let line = "";
      for (const word of text.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (line && sctx.measureText(next).width > maxW) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);

      const lh = size * 1.15;
      scratch.width = Math.ceil(maxW) + 8;
      scratch.height = Math.ceil(lines.length * lh + size * 0.4);
      sctx.font = font;
      sctx.fillStyle = "#000";
      sctx.textBaseline = "top";
      lines.forEach((l, i) => sctx.fillText(l, 4, i * lh));
      const data = sctx.getImageData(0, 0, scratch.width, scratch.height).data;
      const top = (h - scratch.height) / 2;
      const pts: [number, number][] = [];
      const step = Math.max(2, Math.round(size / 18));
      for (let y = 0; y < scratch.height; y += step)
        for (let x = 0; x < scratch.width; x += step)
          if (data[(y * scratch.width + x) * 4 + 3] > 128) pts.push([left + x, top + y]);
      return pts;
    }

    function applyScene(text: string | null) {
      current = text;
      if (!text) {
        for (const p of particles) {
          p.tx = p.hx;
          p.ty = p.hy;
          p.ta = p.coast ? 0.85 : 0.4;
        }
        return;
      }
      const pts = textTargets(text);
      // Se il testo ha più pixel che particelle, ne prendo un sottoinsieme regolare.
      const take = Math.min(pts.length, particles.length);
      const stride = pts.length / take;
      particles.forEach((p, i) => {
        if (i < take) {
          const [x, y] = pts[Math.floor(i * stride)];
          p.tx = x;
          p.ty = y;
          p.ta = 0.9;
        } else {
          p.tx = rnd() * w;
          p.ty = rnd() * h;
          p.ta = 0.12;
        }
      });
    }
    showHeading.current = (text) => {
      if (text !== current) applyScene(text);
    };

    function drawHotspots(t: number) {
      if (hotAlpha < 0.01 || !hotspots.length) return;
      const focus = hotspots.length ? Math.floor(t / 2600) % Math.min(6, hotspots.length) : -1;
      const cycle = (t % 2600) / 2600;
      const mapMidX = mapLeft + (mapH * ITALY_ASPECT) / 2;

      hotspots.forEach((r, i) => {
        const x = mapLeft + r.x * mapH;
        const y = mapTop + r.y * mapH;
        const pulse = reduce ? 0.5 : ((t / 1900 + i * 0.137) % 1);
        ctx!.strokeStyle = `rgba(${STAMP}, ${hotAlpha * (1 - pulse) * 0.55})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(x, y, 3 + pulse * (i === focus ? 22 : 13), 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.fillStyle = `rgba(${STAMP}, ${hotAlpha})`;
        ctx!.beginPath();
        ctx!.arc(x, y, i === focus ? 3.2 : 2.2, 0, Math.PI * 2);
        ctx!.fill();
      });

      if (focus < 0) return;
      const r = hotspots[focus];
      const x = mapLeft + r.x * mapH;
      const y = mapTop + r.y * mapH;
      const fade = reduce ? 1 : Math.sin(Math.PI * Math.min(1, cycle * 1.15));
      const right = x < mapMidX;
      ctx!.textAlign = right ? "left" : "right";
      ctx!.textBaseline = "middle";
      const lx = x + (right ? 16 : -16);
      ctx!.font = `700 13px ${fontFamily}`;
      ctx!.fillStyle = `rgba(28, 35, 51, ${hotAlpha * fade})`;
      ctx!.fillText(r.name.toUpperCase(), lx, y - 8);
      ctx!.font = `600 12px ${fontFamily}`;
      ctx!.fillStyle = `rgba(${STAMP}, ${hotAlpha * fade})`;
      ctx!.fillText(`${r.n.toLocaleString("it-IT")} bandi aperti`, lx, y + 9);
    }

    function tick(now: number) {
      if (!start) start = now;
      const t = now - start;
      const k = reduce ? 1 : 0.075;
      ctx!.clearRect(0, 0, w, h);
      hotAlpha += ((current ? 0 : 1) - hotAlpha) * (reduce ? 1 : 0.06);

      for (const p of particles) {
        if (t < p.delay) continue;
        p.x += (p.tx - p.x) * k;
        p.y += (p.ty - p.y) * k;
        p.a += (p.ta - p.a) * (reduce ? 1 : 0.05);
        const drift = reduce || current ? 0 : Math.sin(t * 0.0012 + p.phase) * 0.6;
        const s = p.coast ? 1.8 : 1.4;
        ctx!.fillStyle = `rgba(${INK}, ${p.a})`;
        ctx!.fillRect(p.x + drift, p.y - drift * 0.5, s, s);
      }
      drawHotspots(t);
      frame = requestAnimationFrame(tick);
    }

    layout();
    for (const p of particles) {
      // Partenza sparsa nella finestra, poi i puntini volano al loro posto.
      p.x = reduce ? p.hx : rnd() * w;
      p.y = reduce ? p.hy : rnd() * h;
    }
    applyScene(heading);
    frame = requestAnimationFrame(tick);

    const onResize = () => {
      layout();
      applyScene(current);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      showHeading.current = null;
    };
    // `heading` arriva tramite showHeading: non deve ricreare la scena.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, compact]);

  return <canvas ref={ref} className="italy-canvas" aria-hidden="true" />;
}
