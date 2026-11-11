import React, { useEffect, useRef } from 'react';
import { AnimationIntensity } from '../types';

interface LivingBackgroundProps {
  intensity: AnimationIntensity;
  theme: 'dark' | 'light';
}

export const LivingBackground: React.FC<LivingBackgroundProps> = ({ intensity, theme }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || intensity === 'low') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / Math.max(1, width),
        y: e.clientY / Math.max(1, height),
      };
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    const count = intensity === 'high' ? 32 : 16;
    const particles = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: 1.5 + (i % 3) * 1.1,
      hue: [265, 195, 160, 42, 340][i % 5],
      alpha: 0.15 + Math.random() * 0.25,
    }));

    const render = () => {
      if (document.hidden) {
        animId = requestAnimationFrame(render);
        return;
      }
      ctx.clearRect(0, 0, width, height);
      const mx = mouseRef.current.x * width;
      const my = mouseRef.current.y * height;

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;

        // Gentle mouse repulsion/attraction
        const dx = mx - p.x;
        const dy = my - p.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 32000 && distSq > 10) {
          const dist = Math.sqrt(distSq);
          p.x -= (dx / dist) * 0.45;
          p.y -= (dy / dist) * 0.45;
        }

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 85%, ${theme === 'dark' ? '68%' : '48%'}, ${p.alpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [intensity, theme]);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Rich Jewel Gradient Mesh */}
      <div
        className={`absolute inset-0 transition-colors duration-700 ${
          theme === 'dark'
            ? 'bg-gradient-to-br from-[#080B14] via-[#0F1226] to-[#081621]'
            : 'bg-gradient-to-br from-[#F8FAFC] via-[#F3F0FF] to-[#ECFEFF]'
        }`}
      />

      {/* Ambient Floating Geometric & Organic Orbs */}
      <div
        className={`absolute -top-32 -right-32 w-[34rem] h-[34rem] rounded-full blur-3xl transition-opacity duration-700 ${
          theme === 'dark' ? 'bg-violet-600/12' : 'bg-violet-400/15'
        }`}
      />
      <div
        className={`absolute top-1/3 -left-36 w-[30rem] h-[30rem] rounded-full blur-3xl transition-opacity duration-700 ${
          theme === 'dark' ? 'bg-sky-500/10' : 'bg-sky-400/15'
        }`}
      />
      <div
        className={`absolute -bottom-40 right-1/4 w-[28rem] h-[28rem] rounded-full blur-3xl transition-opacity duration-700 ${
          theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-400/12'
        }`}
      />

      {/* Subtle SVG Geometric Waves & Polygons */}
      <svg
        className={`absolute inset-0 w-full h-full ${
          theme === 'dark' ? 'opacity-[0.04]' : 'opacity-[0.05]'
        }`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="garden-grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path
              d="M 64 0 L 0 0 0 64"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.75"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#garden-grid)" />
      </svg>

      {/* Interactive Particle Layer */}
      {intensity !== 'low' && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />}

      {/* Subtle Film Grain */}
      <div className="absolute inset-0 bg-film-grain opacity-30" />
    </div>
  );
};
