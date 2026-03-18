'use client';

import { useEffect, useRef } from 'react';

const W = 1080;
const H = 1920;

const HOLE_X = 540;
const HOLE_Y = 1750;
const HOLE_R = 40;
const PIN_R = 10;
const PIN_VISUAL_R = 13;

interface PinDef {
  x: number;
  y: number;
}

function buildPins(map: string): PinDef[] {
  const pins: PinDef[] = [];
  const yStart = 150;
  const yEnd = 1600;
  const rowCount = 20;
  const rowSpacing = (yEnd - yStart) / (rowCount - 1);
  const wmCenters =
    map === 'windmill'
      ? [
          { x: 270, y: 960 },
          { x: 810, y: 960 },
        ]
      : [];

  for (let r = 0; r < rowCount; r++) {
    const y = yStart + r * rowSpacing;
    const isShortRow = r % 2 === 0;
    const count = isShortRow ? 4 : 5;
    const spacing = isShortRow ? W / 5 : W / 6;
    for (let c = 0; c < count; c++) {
      const x = spacing * (c + 1);
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
      const WALL_W = 6;
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#22FFFF';
      ctx.fillStyle = '#22FFFF';
      ctx.fillRect(0, 0, WALL_W, H);
      ctx.fillRect(W - WALL_W, 0, WALL_W, H);
      ctx.restore();

      // Hole — concentric rings + dark vortex
      ctx.save();
      // Outer glow ring
      ctx.shadowBlur = 40;
      ctx.shadowColor = '#6600cc';
      ctx.strokeStyle = '#4400aa';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(HOLE_X, HOLE_Y, HOLE_R + 12, 0, Math.PI * 2);
      ctx.stroke();
      // Middle ring
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#8800ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(HOLE_X, HOLE_Y, HOLE_R, 0, Math.PI * 2);
      ctx.stroke();
      // Dark center
      const holeGrad = ctx.createRadialGradient(HOLE_X, HOLE_Y, 0, HOLE_X, HOLE_Y, HOLE_R - 6);
      holeGrad.addColorStop(0, '#1a0018');
      holeGrad.addColorStop(1, '#000000');
      ctx.fillStyle = holeGrad;
      ctx.beginPath();
      ctx.arc(HOLE_X, HOLE_Y, HOLE_R - 6, 0, Math.PI * 2);
      ctx.fill();
      // Rotating spiral lines
      const spiralTime = now / 1000;
      ctx.strokeStyle = 'rgba(150,0,255,0.4)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = spiralTime + i * (2 * Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(HOLE_X, HOLE_Y);
        ctx.lineTo(
          HOLE_X + Math.cos(a) * (HOLE_R - 8),
          HOLE_Y + Math.sin(a) * (HOLE_R - 8)
        );
        ctx.stroke();
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

      // Cannon — 3 barrels + hub (swinging)
      const cannonAngle =
        Math.sin(((now - startTime) / CANNON_PERIOD) * Math.PI * 2) * CANNON_SWING;
      ctx.save();
      ctx.translate(CANNON_X, CANNON_Y);
      ctx.rotate(cannonAngle);
      // Draw 3 barrels
      const barrelAngles = [-15 * Math.PI / 180, 0, 15 * Math.PI / 180];
      const barrelLateral = [-18, 0, 18];
      ctx.fillStyle = '#22FFFF';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#22FFFF';
      for (let bi = 0; bi < 3; bi++) {
        ctx.save();
        ctx.rotate(barrelAngles[bi]);
        ctx.translate(barrelLateral[bi], 0);
        ctx.beginPath();
        ctx.roundRect(-6, -5, 12, 45, 4);
        ctx.fill();
        ctx.restore();
      }
      // Center hub
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#22FFFF';
      ctx.fillStyle = '#0AEEEE';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
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
