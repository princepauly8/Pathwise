import React, { useEffect, useRef } from 'react';
import { Award, Flame, Trophy, X } from 'lucide-react';
import type { CelebrationPayload } from '../utils/achievements';

interface ConfettiCelebrationProps {
  celebration: CelebrationPayload | null;
  onDismiss: () => void;
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  tiltAngle: number;
  tiltSpeed: number;
  shape: 'ribbon' | 'rect' | 'circle';
  opacity: number;
  life: number;
  maxLife: number;
}

const CONFETTI_COLORS = [
  '#0284C7', // Azure
  '#059669', // Emerald
  '#D97706', // Amber
  '#F59E0B', // Marigold
  '#0EA5E9', // Cerulean
  '#E11D48', // Rose
  '#4F46E5', // Indigo
];

export const ConfettiCelebration: React.FC<ConfettiCelebrationProps> = ({
  celebration,
  onDismiss,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!celebration) return;

    const autoCloseTimer = window.setTimeout(() => {
      onDismiss();
    }, 6500);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      return () => window.clearTimeout(autoCloseTimer);
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return () => window.clearTimeout(autoCloseTimer);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return () => window.clearTimeout(autoCloseTimer);
    }

    let rafId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const particles: ConfettiParticle[] = [];

    const spawnBurst = (
      originX: number,
      originY: number,
      angleMin: number,
      angleMax: number,
      speedMin: number,
      speedMax: number,
      count: number
    ) => {
      const shapes: ConfettiParticle['shape'][] = ['ribbon', 'rect', 'circle'];
      for (let i = 0; i < count; i++) {
        const angle = angleMin + Math.random() * (angleMax - angleMin);
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        const size = 5 + Math.random() * 5;
        particles.push({
          x: originX + (Math.random() - 0.5) * 30,
          y: originY + (Math.random() - 0.5) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size,
          width: size * (1.2 + Math.random() * 0.8),
          height: size * (0.55 + Math.random() * 0.4),
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.24,
          tiltAngle: Math.random() * Math.PI,
          tiltSpeed: 0.08 + Math.random() * 0.12,
          shape: shapes[i % shapes.length],
          opacity: 1,
          life: 0,
          maxLife: 130 + Math.floor(Math.random() * 65),
        });
      }
    };

    // Left angled cannon, right angled cannon, and gentle top-center shower
    spawnBurst(w * 0.14, h * 0.68, -Math.PI * 0.44, -Math.PI * 0.2, 10, 17, 46);
    spawnBurst(w * 0.86, h * 0.68, -Math.PI * 0.8, -Math.PI * 0.56, 10, 17, 46);
    spawnBurst(w * 0.5, h * 0.18, Math.PI * 0.15, Math.PI * 0.85, 3, 9, 34);

    const tick = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let aliveCount = 0;
      for (const p of particles) {
        p.life += 1;
        if (p.life > p.maxLife) continue;
        aliveCount += 1;

        p.vy += 0.24; // gravity
        p.vx *= 0.988; // air drag
        p.vy *= 0.992;
        p.x += p.vx + Math.sin(p.tiltAngle) * 0.65;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.tiltAngle += p.tiltSpeed;

        const fadeStart = p.maxLife * 0.72;
        p.opacity =
          p.life < fadeStart
            ? 1
            : Math.max(0, 1 - (p.life - fadeStart) / (p.maxLife - fadeStart));

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(1, Math.cos(p.tiltAngle));
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        }
        ctx.restore();
      }

      if (aliveCount > 0) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.clearTimeout(autoCloseTimer);
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
  }, [celebration, onDismiss]);

  if (!celebration) return null;

  const iconStyles =
    celebration.tier === 'gold'
      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/80'
      : celebration.tier === 'silver'
        ? 'bg-sky-100 dark:bg-sky-950/60 text-[#0284C7] dark:text-sky-400 border-sky-300 dark:border-sky-800/80'
        : 'bg-emerald-100 dark:bg-emerald-950/60 text-[#059669] dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/80';

  return (
    <>
      <canvas
        ref={canvasRef}
        data-testid="confetti-canvas"
        aria-hidden="true"
        className="fixed inset-0 z-50 pointer-events-none"
      />
      <div
        role="status"
        aria-live="polite"
        data-testid="milestone-celebration-banner"
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg px-4 py-3.5 flex items-start gap-3.5"
      >
        <div
          className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${iconStyles}`}
          aria-hidden="true"
        >
          {celebration.kind === 'streak_milestone' || celebration.kind === 'daily_goal' ? (
            <Flame className="w-5 h-5" />
          ) : celebration.tier === 'gold' ? (
            <Trophy className="w-5 h-5" />
          ) : (
            <Award className="w-5 h-5" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xs font-medium text-[#0284C7] dark:text-sky-400">
            {celebration.kind === 'streak_milestone'
              ? 'Streak Milestone Reached'
              : celebration.kind === 'badge_unlocked'
                ? 'New Achievement Badge'
                : 'Daily Study Goal Completed'}
          </p>
          <p className="text-sm font-semibold text-[#0F172A] dark:text-slate-100 leading-snug">
            {celebration.title}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {celebration.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss milestone celebration"
          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </>
  );
};
