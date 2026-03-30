'use client';

import { useEffect, useRef } from 'react';

const W = 1080;
const H = 1920;

const HOLE_X = 540;
const HOLE_Y = 1558; // moved up ~10% from 1750
const HOLE_R = 40;
const PIN_R = 10;
const PIN_VISUAL_R = 13;

interface PinDef {
  x: number;
  y: number;
}

interface BumperDef {
  x: number;
  y: number;
  r: number;
}

const FUNNEL_BUMPERS: BumperDef[] = [
  { x: 540, y: 450, r: 50 },
  { x: 270, y: 700, r: 45 },
  { x: 810, y: 700, r: 45 },
];

const BUMPER_CYCLE = 4000;
const BUMPER_GLOW_DURATION = 1000;
const BUMPER_PHASE_OFFSETS = [0, 1400, 2600];

function getBumperGlowT(now: number, idx: number): number {
  const t = (now + BUMPER_PHASE_OFFSETS[idx]) % BUMPER_CYCLE;
  if (t < BUMPER_GLOW_DURATION) return t / BUMPER_GLOW_DURATION;
  return -1;
}

const FUNNEL_FLIPPERS = [
  { cx: 330, cy: 1050, width: 200, height: 16, rangeX: 140, period: 2800, phase: 0 },
  { cx: 750, cy: 1050, width: 200, height: 16, rangeX: 140, period: 2800, phase: Math.PI },
];

function buildPins(map: string): PinDef[] {
  const pins: PinDef[] = [];
  const yStart = 150;
  const yEnd = H - 120;
  const rowCount = 14;
  const rowSpacing = (yEnd - yStart) / (rowCount - 1);
  const wmCenters =
    map === 'windmill'
      ? [
          { x: 270, y: 960 },
          { x: 810, y: 960 },
        ]
      : [];

  const HOLE_EXCLUDE = 145;
  const WALL_PIN_MARGIN = 50;

  function addPin(x: number, y: number) {
    const skipWm = wmCenters.some((wm) => Math.hypot(x - wm.x, y - wm.y) < 150);
    const skipHole = Math.hypot(x - HOLE_X, y - HOLE_Y) < HOLE_EXCLUDE;
    const skipBumper = map === 'funnel' && FUNNEL_BUMPERS.some((b) => Math.hypot(x - b.x, y - b.y) < b.r + 60);
    const skipFlipper = map === 'funnel' && FUNNEL_FLIPPERS.some((f) =>
      Math.abs(y - f.cy) < 40 && Math.abs(x - f.cx) < f.width / 2 + f.rangeX + 30
    );
    if (!skipWm && !skipHole && !skipBumper && !skipFlipper) pins.push({ x, y });
  }

  for (let r = 0; r < rowCount; r++) {
    const y = yStart + r * rowSpacing;
    const isShortRow = r % 2 === 0;
    const count = isShortRow ? 4 : 5;
    const spacing = isShortRow ? W / 5 : W / 6;
    for (let c = 0; c < count; c++) {
      addPin(spacing * (c + 1), y);
    }
    if (isShortRow) {
      addPin(WALL_PIN_MARGIN, y);
      addPin(W - WALL_PIN_MARGIN, y);
    }
  }

  return pins;
}

interface Props {
  map: string;
}

export default function MapPreview({ map }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // Uniform scale
    function applyScale() {
      const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
      const ox = (window.innerWidth - W * scale) / 2;
      const oy = (window.innerHeight - H * scale) / 2;
      canvas!.style.transform = `translate(${ox}px, ${oy}px) scale(${scale})`;
      canvas!.style.transformOrigin = 'top left';
    }
    applyScale();

    const pinDefs = buildPins(map);
    const wmCenters =
      map === 'windmill'
        ? [
            { x: 270, y: 960 },
            { x: 810, y: 960 },
          ]
        : [];

    let wmAngle = 0;
    const startTime = performance.now();
    const CANNON_X = 540, CANNON_Y = 80;
    const CANNON_SWING = (40 * Math.PI) / 180;
    const CANNON_PERIOD = 4000;

    // Load images
    let pinImg: HTMLImageElement | null = null;

    const pi = new Image();
    pi.onload = () => { pinImg = pi; };
    pi.src = '/images/pin_128.png';

    function draw(now: number) {
      rafRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      // Walls (left & right)
      ctx.save();
      const WALL_W = 4;
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#083E3D';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, WALL_W, H);
      ctx.fillRect(W - WALL_W, 0, WALL_W, H);
      ctx.restore();

      // ── Blackhole ──────────────────────────────────────────────────────────
      ctx.save();
      const spiralTime = now / 900;

      // Accretion disk
      const accGrad = ctx.createRadialGradient(HOLE_X, HOLE_Y, HOLE_R, HOLE_X, HOLE_Y, HOLE_R + 36);
      accGrad.addColorStop(0, 'rgba(255, 120, 0, 0.6)');
      accGrad.addColorStop(0.4, 'rgba(180, 0, 120, 0.3)');
      accGrad.addColorStop(1, 'rgba(80, 0, 200, 0)');
      ctx.fillStyle = accGrad;
      ctx.beginPath();
      ctx.arc(HOLE_X, HOLE_Y, HOLE_R + 36, 0, Math.PI * 2);
      ctx.fill();

      // Bright event horizon ring
      ctx.shadowBlur = 50;
      ctx.shadowColor = '#ff6600';
      ctx.strokeStyle = 'rgba(255, 120, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(HOLE_X, HOLE_Y, HOLE_R + 2, 0, Math.PI * 2);
      ctx.stroke();

      // Outer purple ring
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#8800ff';
      ctx.strokeStyle = '#6600cc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(HOLE_X, HOLE_Y, HOLE_R + 14, 0, Math.PI * 2);
      ctx.stroke();

      // Dark center
      const lensGrad = ctx.createRadialGradient(
        HOLE_X - HOLE_R * 0.25, HOLE_Y - HOLE_R * 0.25, 0,
        HOLE_X, HOLE_Y, HOLE_R
      );
      lensGrad.addColorStop(0, '#0d0020');
      lensGrad.addColorStop(0.6, '#000000');
      lensGrad.addColorStop(1, '#000008');
      ctx.shadowBlur = 0;
      ctx.fillStyle = lensGrad;
      ctx.beginPath();
      ctx.arc(HOLE_X, HOLE_Y, HOLE_R, 0, Math.PI * 2);
      ctx.fill();

      // Spiral arms (6 arms)
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = spiralTime * 2 + i * (Math.PI * 2 / 6);
        const opacity = 0.25 + 0.2 * Math.sin(spiralTime * 3 + i);
        ctx.strokeStyle = `rgba(200, 60, 255, ${opacity})`;
        ctx.beginPath();
        ctx.moveTo(HOLE_X, HOLE_Y);
        ctx.lineTo(
          HOLE_X + Math.cos(a) * (HOLE_R - 4),
          HOLE_Y + Math.sin(a) * (HOLE_R - 4)
        );
        ctx.stroke();
      }

      // Lens flare
      ctx.fillStyle = 'rgba(255, 200, 255, 0.12)';
      ctx.beginPath();
      ctx.arc(HOLE_X - HOLE_R * 0.3, HOLE_Y - HOLE_R * 0.3, HOLE_R * 0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Pins
      for (const pin of pinDefs) {
        ctx.save();
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#22FFFF';
        if (pinImg && pinImg.naturalWidth > 0) {
          ctx.drawImage(
            pinImg,
            pin.x - PIN_VISUAL_R,
            pin.y - PIN_VISUAL_R,
            PIN_VISUAL_R * 2,
            PIN_VISUAL_R * 2
          );
        } else {
          ctx.fillStyle = '#22FFFF';
          ctx.beginPath();
          ctx.arc(pin.x, pin.y, PIN_R, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Windmill blades
      if (wmCenters.length > 0) {
        wmAngle += 0.015;
        ctx.save();
        ctx.fillStyle = '#39FF14';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#39FF14';
        for (const wm of wmCenters) {
          for (let i = 0; i < 4; i++) {
            const a = wmAngle + (i * Math.PI) / 2;
            const bx = wm.x + Math.cos(a) * 70;
            const by = wm.y + Math.sin(a) * 70;
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(a);
            ctx.fillRect(-70, -8, 140, 16);
            ctx.restore();
          }
        }
        ctx.restore();
      }

      // Bumpers (funnel map)
      if (map === 'funnel') {
        ctx.save();
        for (let i = 0; i < FUNNEL_BUMPERS.length; i++) {
          const b = FUNNEL_BUMPERS[i];
          const glowT = getBumperGlowT(now, i);
          const isGlowing = glowT >= 0;
          const pulse = isGlowing ? Math.sin(glowT * Math.PI) : 0;

          // Expanding rings during glow
          if (isGlowing) {
            for (let ri = 0; ri < 3; ri++) {
              const ringPhase = (glowT + ri / 3) % 1;
              const ringR = b.r + ringPhase * b.r * 2.2;
              ctx.globalAlpha = (1 - ringPhase) * 0.7 * pulse;
              ctx.strokeStyle = `hsl(${50 + ri * 20},100%,75%)`;
              ctx.lineWidth = 3 - ri * 0.7;
              ctx.shadowBlur = 20;
              ctx.shadowColor = '#FFE000';
              ctx.beginPath();
              ctx.arc(b.x, b.y, ringR, 0, Math.PI * 2);
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
          }

          ctx.shadowBlur = isGlowing ? 60 + pulse * 40 : 30;
          ctx.shadowColor = isGlowing ? '#FFE000' : '#FF1493';
          ctx.strokeStyle = isGlowing ? `hsl(${45 + pulse * 20},100%,${65 + pulse * 30}%)` : '#FF1493';
          ctx.lineWidth = isGlowing ? 4 + pulse * 3 : 3;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r + 4 + pulse * 6, 0, Math.PI * 2);
          ctx.stroke();

          const innerR = b.r + pulse * 5;
          const bGrad = ctx.createRadialGradient(b.x - innerR * 0.2, b.y - innerR * 0.2, 0, b.x, b.y, innerR);
          if (isGlowing) {
            bGrad.addColorStop(0, `rgba(255,255,${Math.floor(100 + pulse * 155)},1)`);
            bGrad.addColorStop(0.4, `rgba(255,${Math.floor(180 + pulse * 75)},0,1)`);
            bGrad.addColorStop(1, '#C71585');
          } else {
            bGrad.addColorStop(0, '#FF69B4');
            bGrad.addColorStop(0.6, '#FF1493');
            bGrad.addColorStop(1, '#C71585');
          }
          ctx.shadowBlur = isGlowing ? 40 + pulse * 30 : 20;
          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.arc(b.x, b.y, innerR, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(255,255,255,${isGlowing ? 0.55 + pulse * 0.3 : 0.25})`;
          ctx.shadowBlur = 0;
          ctx.beginPath();
          ctx.arc(b.x - innerR * 0.25, b.y - innerR * 0.25, innerR * 0.35, 0, Math.PI * 2);
          ctx.fill();

          // Spark lines
          if (isGlowing && pulse > 0.2) {
            ctx.save();
            for (let si = 0; si < 6; si++) {
              const sparkAngle = (si / 6) * Math.PI * 2 + glowT * Math.PI * 4;
              const sparkLen = (8 + Math.sin(glowT * 20 + si * 1.7) * 6) * pulse;
              const sx1 = b.x + Math.cos(sparkAngle) * (b.r + 4);
              const sy1 = b.y + Math.sin(sparkAngle) * (b.r + 4);
              const sx2 = b.x + Math.cos(sparkAngle) * (b.r + 4 + sparkLen);
              const sy2 = b.y + Math.sin(sparkAngle) * (b.r + 4 + sparkLen);
              ctx.globalAlpha = pulse * 0.9;
              ctx.strokeStyle = '#FFFFFF';
              ctx.lineWidth = 2;
              ctx.shadowBlur = 15;
              ctx.shadowColor = '#FFE000';
              ctx.beginPath();
              ctx.moveTo(sx1, sy1);
              ctx.lineTo(sx2, sy2);
              ctx.stroke();
            }
            ctx.restore();
          }
        }
        ctx.restore();

        // Animated flippers
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#FF8C00';
        for (const f of FUNNEL_FLIPPERS) {
          const t = (now / f.period) * Math.PI * 2 + f.phase;
          const fx = f.cx + Math.sin(t) * f.rangeX;
          ctx.fillStyle = '#FFA500';
          ctx.beginPath();
          ctx.roundRect(fx - f.width / 2, f.cy - f.height / 2, f.width, f.height, 8);
          ctx.fill();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.beginPath();
          ctx.roundRect(fx - f.width / 2 + 4, f.cy - f.height / 2 + 2, f.width - 8, f.height / 3, 4);
          ctx.fill();
        }
        ctx.restore();
      }

      // ── Cannon ────────────────────────────────────────────────────────────
      const BARREL_SPREAD_P = 14 * Math.PI / 180;
      const cannonAngle =
        Math.sin(((now - startTime) / CANNON_PERIOD) * Math.PI * 2) * CANNON_SWING;
      ctx.save();
      ctx.translate(CANNON_X, CANNON_Y);
      ctx.rotate(cannonAngle);

      // Carriage base
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#0099bb';
      ctx.fillStyle = '#0d4460';
      ctx.beginPath();
      ctx.roundRect(-38, 6, 76, 22, 5);
      ctx.fill();
      ctx.fillStyle = '#0a3348';
      ctx.beginPath();
      ctx.roundRect(-36, 8, 72, 18, 4);
      ctx.fill();

      // Wheels
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#22FFFF';
      for (const wx of [-24, 24]) {
        ctx.fillStyle = '#0d4460';
        ctx.beginPath();
        ctx.arc(wx, 24, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#22FFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx, 24, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1.5;
        for (let s = 0; s < 6; s++) {
          const sa = s * Math.PI / 3;
          ctx.beginPath();
          ctx.moveTo(wx, 24);
          ctx.lineTo(wx + Math.cos(sa) * 9, 24 + Math.sin(sa) * 9);
          ctx.stroke();
        }
        ctx.fillStyle = '#22FFFF';
        ctx.beginPath();
        ctx.arc(wx, 24, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3 Barrels
      const pvBarrelAngles = [-BARREL_SPREAD_P, 0, BARREL_SPREAD_P];
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(pvBarrelAngles[i]);
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#22FFFF';
        ctx.fillStyle = '#1a7a9a';
        ctx.beginPath();
        ctx.roundRect(-5, 2, 10, 52, [2, 2, 5, 5]);
        ctx.fill();
        ctx.fillStyle = '#22FFFF';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.roundRect(-4, 3, 4, 50, [2, 2, 3, 3]);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#22FFFF';
        ctx.fillStyle = '#22FFFF';
        ctx.beginPath();
        ctx.roundRect(-6, 46, 12, 8, 3);
        ctx.fill();
        ctx.fillStyle = '#0AEEEE';
        ctx.beginPath();
        ctx.roundRect(-6, 2, 12, 7, 2);
        ctx.fill();
        ctx.restore();
      }

      // Hub
      ctx.shadowBlur = 18;
      ctx.shadowColor = '#22FFFF';
      ctx.fillStyle = '#0d4460';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0AEEEE';
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#22FFFF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(draw);

    const onResize = () => applyScale();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [map]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        display: 'block',
      }}
    />
  );
}
