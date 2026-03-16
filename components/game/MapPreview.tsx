'use client';

import { useEffect, useRef } from 'react';

const W = 1600;
const H = 900;

const HOLE_X = 800;
const HOLE_Y = 720;
const HOLE_R = 40;
const PIN_R = 10;
const PIN_VISUAL_R = 13;

interface PinDef {
  x: number;
  y: number;
}

function buildPins(map: string): PinDef[] {
  const pins: PinDef[] = [];
  const yStart = 120;
  const yEnd = 680;
  const rowCount = 10;
  const rowSpacing = (yEnd - yStart) / (rowCount - 1);
  const wmCenters =
    map === 'windmill'
      ? [
          { x: 480, y: 450 },
          { x: 1120, y: 450 },
        ]
      : [];

  for (let r = 0; r < rowCount; r++) {
    const y = yStart + r * rowSpacing;
    const isShortRow = r % 2 === 0;
    const count = isShortRow ? 6 : 7;
    const spacing = isShortRow ? W / 7 : W / 8;
    for (let c = 0; c < count; c++) {
      const x = spacing * (c + 0.5);
      const skip = wmCenters.some((wm) => Math.hypot(x - wm.x, y - wm.y) < 150);
      if (!skip) pins.push({ x, y });
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
            { x: 480, y: 450 },
            { x: 1120, y: 450 },
          ]
        : [];

    let wmAngle = 0;
    const startTime = performance.now();
    const CANNON_X = 800, CANNON_Y = 60;
    const CANNON_SWING = (40 * Math.PI) / 180;
    const CANNON_PERIOD = 4000;

    // Load images
    let holeImg: HTMLImageElement | null = null;
    let pinImg: HTMLImageElement | null = null;
    let cannonImg: HTMLImageElement | null = null;

    const hi = new Image();
    hi.onload = () => { holeImg = hi; };
    hi.src = '/images/hole.png';

    const pi = new Image();
    pi.onload = () => { pinImg = pi; };
    pi.src = '/images/pin_128.png';

    const ci = new Image();
    ci.onload = () => { cannonImg = ci; };
    ci.src = '/images/cannon.png';

    function draw(now: number) {
      rafRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      // Hole
      ctx.save();
      if (holeImg && holeImg.naturalWidth > 0) {
        ctx.drawImage(holeImg, HOLE_X - HOLE_R, HOLE_Y - HOLE_R, HOLE_R * 2, HOLE_R * 2);
      } else {
        ctx.fillStyle = '#1a0a2e';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#6600cc';
        ctx.beginPath();
        ctx.arc(HOLE_X, HOLE_Y, HOLE_R, 0, Math.PI * 2);
        ctx.fill();
      }
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

      // Cannon (swinging, same as PachinkoBoard)
      const cannonAngle =
        Math.sin(((now - startTime) / CANNON_PERIOD) * Math.PI * 2) * CANNON_SWING;
      ctx.save();
      ctx.translate(CANNON_X, CANNON_Y);
      ctx.rotate(cannonAngle);
      if (cannonImg && cannonImg.naturalWidth > 0) {
        ctx.drawImage(cannonImg, -40, -40, 80, 80);
      } else {
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.roundRect(-14, -14, 28, 60, 4);
        ctx.fill();
        ctx.fillStyle = '#aaa';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
      }
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
