"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#e8a317", "#f0b429", "#d99212", "#f5c84a", "#c9840f"];

export const CHEESE_PATHS = [
  "M3.02,8.48C6.47,6.38,19.26-.88,32.73,2.32c1.58.37,3.28.92,5.03,1.7",
  "M3.48,6.14C6.63,3.57,10.93.93,15.08,1.77c3.59.73,4.45,3.54,8.13,4.9,2.86,1.06,7.42,1.24,14.85-2.65",
  "M3.48,1.61c10.92,6.09,19.62,6.9,24.42,6.87,2.61-.01,8.36-.05,9.23-2.19.71-1.76-2.24-4.05-3.1-4.68",
];

type CachedPath = {
  path: Path2D;
  cx: number;
  cy: number;
  size: number;
};

function pathBounds(d: string): { cx: number; cy: number; size: number } {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "0");
  svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  svg.style.visibility = "hidden";
  const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
  el.setAttribute("d", d);
  svg.appendChild(el);
  document.body.appendChild(svg);
  const box = el.getBBox();
  svg.remove();
  return {
    cx: box.x + box.width / 2,
    cy: box.y + box.height / 2,
    size: Math.max(box.width, box.height, 1),
  };
}
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  length: number;
  width: number;
  color: string;
  path: string;
};

function hash(i: number) {
  const x = Math.sin(i * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function makeParticle(i: number, width: number, height: number, paths: string[]): Particle {
  return {
    x: hash(i) * width,
    y: hash(i + 1) * height,
    vx: (hash(i + 2) - 0.5) * 18,
    vy: 28 + hash(i + 4) * 42,
    rot: hash(i + 5) * Math.PI * 2,
    vr: (hash(i + 6) - 0.5) * 1.4,
    length: 14 + hash(i + 7) * 22,
    width: 2.2 + hash(i + 8) * 2.2,
    color: COLORS[Math.floor(hash(i + 9) * COLORS.length)]!,
    path: paths[Math.floor(hash(i + 11) * paths.length)] ?? paths[0]!,
  };
}

export function CheeseSprinkleBackground({
  paths = CHEESE_PATHS,
}: {
  paths?: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathsKey = JSON.stringify(paths);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parsed = JSON.parse(pathsKey) as string[];
    const activePaths = parsed.length > 0 ? parsed : CHEESE_PATHS;
    const pathCache = new Map<string, CachedPath>();
    for (const d of activePaths) {
      if (!pathCache.has(d)) {
        const bounds = pathBounds(d);
        pathCache.set(d, { path: new Path2D(d), ...bounds });
      }
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles: Particle[] = [];
    let width = 0;
    let height = 0;
    let last = performance.now();
    let frame = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.max(70, Math.round((width * height) / 18000));
      particles.length = 0;
      for (let i = 0; i < count; i++) {
        particles.push(makeParticle(i + 1, width, height, activePaths));
      }
    };

    const drawParticle = (s: Particle) => {
      const cached = pathCache.get(s.path);
      if (!cached) return;
      const scale = s.length / cached.size;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.scale(scale, scale);
      ctx.translate(-cached.cx, -cached.cy);
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = 0.82;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = s.width / Math.max(scale, 0.001);
      ctx.stroke(cached.path);
      ctx.restore();
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, width, height);

      for (const s of particles) {
        if (!reduceMotion) {
          s.y += s.vy * dt;
          s.x += s.vx * dt + Math.sin(s.y * 0.02 + s.rot) * 8 * dt;
          s.rot += s.vr * dt;
          if (s.y - s.length > height) {
            s.y = -s.length;
            s.x = hash(s.y + s.x + 1) * width;
          }
        }
        drawParticle(s);
      }

      if (!reduceMotion) {
        frame = requestAnimationFrame(tick);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [pathsKey]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0"
    />
  );
}
