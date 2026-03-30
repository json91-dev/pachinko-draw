'use client';

import { useEffect, useRef } from 'react';
import { PLAYER_COLORS } from '@/lib/ballTint';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
}

export default function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d')!;

    const particles: Particle[] = [];
    for (let i = 0; i < 66; i++) {
      const speed = (800 + Math.random() * 600);  // px/s
      const angle = Math.PI * (0.55 + Math.random() * 0.35);
      particles.push({
        x: window.innerWidth - 10 + Math.random() * 20,
        y: window.innerHeight - 10 + Math.random() * 20,
        vx: Math.cos(angle) * speed * 1.1,
        vy: Math.sin(angle) * speed * -1 * 1.3,
        size: 10.4 + Math.random() * 10.4,
        color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 12,  // rad/s
      });
    }

    let rafId: number;
    let lastTime: number | null = null;

    const GRAVITY = 1800;  // px/s²

    function draw(now: number) {
      const dt = lastTime === null ? 0 : Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      let alive = false;
      for (const p of particles) {
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotSpeed * dt;
        if (p.y < canvas!.height + 60) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
        }
      }
      if (alive) rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    />
  );
}
