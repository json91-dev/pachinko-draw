'use client';

import { useEffect, useRef } from 'react';
import Matter from 'matter-js';
import {
  distributeBalls,
  createBallQueue,
  preloadTintedBalls,
  clearTintCache,
} from '@/lib/ballTint';
import { checkWinner } from '@/lib/winnerCheck';
import { BlackholeShader } from '@/lib/blackholeShader';

// Virtual resolution (CSS-scaled to fill viewport)
const W = 1600;
const H = 900;

const BALL_R = 10;
const PIN_R = 10;
const PIN_VISUAL_R = 13;

const HOLE_X = 800;
const HOLE_Y = 720;
const HOLE_R_MIN = 40;
const HOLE_R_MAX = 80;

const CANNON_X = 800;
const CANNON_Y = 60;
const CANNON_SWING = (40 * Math.PI) / 180; // ±40°
const CANNON_PERIOD = 4000; // ms

const FIRE_MS = 40;

const BLACKHOLE_THRESHOLD = 200;
const FINALE_THRESHOLD = 10;

interface Player {
  name: string;
  color: string;
  initialBalls: number;
}

interface Props {
  players: Player[];
  map: string;
  onScore: (playerId: number) => void;
  onWinner: (playerIndex: number) => void;
}

interface PinDef {
  x: number;
  y: number;
}

interface WindmillState {
  cx: number;
  cy: number;
  angle: number;
  blades: Matter.Body[];
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
    // r=0,2,4,6,8 → 6-pin rows; r=1,3,5,7,9 → 7-pin rows
    const isShortRow = r % 2 === 0;
    const count = isShortRow ? 6 : 7;
    const spacing = isShortRow ? W / 7 : W / 8;

    for (let c = 0; c < count; c++) {
      const x = spacing * (c + 0.5);
      // Skip pins that would overlap windmill blades
      const skip = wmCenters.some((wm) => Math.hypot(x - wm.x, y - wm.y) < 150);
      if (!skip) pins.push({ x, y });
    }
  }
  return pins;
}

export default function PachinkoBoard({ players, map, onScore, onWinner }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Use refs for callbacks to avoid stale closures
  const onScoreRef = useRef(onScore);
  const onWinnerRef = useRef(onWinner);
  useEffect(() => {
    onScoreRef.current = onScore;
    onWinnerRef.current = onWinner;
  }, [onScore, onWinner]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // CSS scale to fill viewport
    function applyCanvasScale() {
      const sx = window.innerWidth / W;
      const sy = window.innerHeight / H;
      canvas!.style.transform = `scale(${sx}, ${sy})`;
      canvas!.style.transformOrigin = 'top left';
    }
    applyCanvasScale();

    // ── Matter.js setup ──────────────────────────────────────────────────────
    const engine = Matter.Engine.create({ gravity: { y: 1.5 } });
    const world = engine.world;

    // Walls
    const wallOpts = { isStatic: true, friction: 0, restitution: 0.3 };
    Matter.World.add(world, [
      Matter.Bodies.rectangle(-25, H / 2, 50, H + 200, wallOpts),
      Matter.Bodies.rectangle(W + 25, H / 2, 50, H + 200, wallOpts),
      Matter.Bodies.rectangle(W / 2, -25, W, 50, wallOpts),
    ]);

    // Pins
    const pinDefs = buildPins(map);
    const pinBodies = pinDefs.map((p) =>
      Matter.Bodies.circle(p.x, p.y, PIN_R, {
        isStatic: true,
        friction: 0,
        restitution: 0.5,
        label: 'pin',
      })
    );
    Matter.World.add(world, pinBodies);

    // Hole sensor — updated radius each frame via removal+re-add
    let holeRadius = HOLE_R_MIN;
    let holeSensor = Matter.Bodies.circle(HOLE_X, HOLE_Y, holeRadius, {
      isStatic: true,
      isSensor: true,
      label: 'hole',
    });
    Matter.World.add(world, [holeSensor]);

    // Windmill bodies
    const windmills: WindmillState[] = [];
    if (map === 'windmill') {
      for (const wm of [
        { x: 480, y: 450 },
        { x: 1120, y: 450 },
      ]) {
        const blades: Matter.Body[] = [];
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2;
          const blade = Matter.Bodies.rectangle(
            wm.x + Math.cos(a) * 70,
            wm.y + Math.sin(a) * 70,
            140,
            16,
            { isStatic: true, friction: 0, restitution: 0.4, label: 'windmill', angle: a }
          );
          blades.push(blade);
          Matter.World.add(world, blade);
        }
        windmills.push({ cx: wm.x, cy: wm.y, angle: 0, blades });
      }
    }

    // ── Ball queue ──────────────────────────────────────────────────────────
    const ballCounts = distributeBalls(players.length);
    const ballQueue = createBallQueue(ballCounts);
    let queueIdx = 0;

    // ── Game state ──────────────────────────────────────────────────────────
    const scores = Array(players.length).fill(0) as number[];
    const ballMap = new Map<number, number>(); // bodyId → playerId
    const activeBalls = new Set<Matter.Body>();

    function unfired() {
      return ballQueue.length - queueIdx;
    }
    function inFlight() {
      return activeBalls.size;
    }
    function remainingForWinner() {
      return unfired() + inFlight();
    }

    let lastFireTime = 0;
    let cannonAngle = 0;

    let blackholeModeActive = false;
    let finaleActive = false;
    let gameOver = false;
    let winnerDeclared = false;
    let pendingWinner: number | null = null;

    // Zoom state
    let zoomScale = 1.0;
    let zoomTarget = 1.0;
    let zoomingOut = false;

    // BLACK HOLE MODE blink state
    let bhBlinkPhase = 0; // counts half-cycles
    let bhBlinkTimer = 0;
    let bhTextVisible = false;
    let bhTextSolid = false;

    // ── Images ──────────────────────────────────────────────────────────────
    let cannonImg: HTMLImageElement | null = null;
    let holeImg: HTMLImageElement | null = null;
    let pinImg: HTMLImageElement | null = null;
    let tintedBalls: HTMLCanvasElement[] = [];

    const loadImg = (src: string) => {
      const img = new Image();
      img.src = src;
      return img;
    };
    const ci = loadImg('/images/cannon.png');
    ci.onload = () => { cannonImg = ci; };
    const hi = loadImg('/images/hole.png');
    hi.onload = () => { holeImg = hi; };
    const pi = loadImg('/images/pin_128.png');
    pi.onload = () => { pinImg = pi; };

    preloadTintedBalls(
      players.map((p) => p.color),
      BALL_R * 2
    ).then((imgs) => {
      tintedBalls = imgs;
    });

    // ── WebGL shader ─────────────────────────────────────────────────────────
    let shader: BlackholeShader | null = null;
    try {
      shader = new BlackholeShader();
    } catch {
      // WebGL not supported — graceful degradation
    }

    // ── Hole sensor resize helper ────────────────────────────────────────────
    function updateHoleSensor(newRadius: number) {
      if (Math.abs(newRadius - holeRadius) < 0.5) return;
      Matter.World.remove(world, holeSensor);
      holeRadius = newRadius;
      holeSensor = Matter.Bodies.circle(HOLE_X, HOLE_Y, holeRadius, {
        isStatic: true,
        isSensor: true,
        label: 'hole',
      });
      Matter.World.add(world, holeSensor);
    }

    // ── Ball firing ──────────────────────────────────────────────────────────
    function fireBall() {
      if (queueIdx >= ballQueue.length) return;
      const playerId = ballQueue[queueIdx++];

      const dx = Math.sin(cannonAngle);
      const dy = Math.cos(cannonAngle);
      const spawnX = CANNON_X + dx * 45;
      const spawnY = CANNON_Y + dy * 45 + BALL_R;
      const speed = 8;

      const ball = Matter.Bodies.circle(spawnX, spawnY, BALL_R, {
        restitution: 0.5,
        friction: 0.05,
        frictionAir: 0.005,
        density: 0.002,
        label: `ball`,
      });
      Matter.Body.setVelocity(ball, { x: dx * speed, y: dy * speed });
      Matter.World.add(world, ball);
      ballMap.set(ball.id, playerId);
      activeBalls.add(ball);
    }

    // ── Winner trigger ───────────────────────────────────────────────────────
    function triggerWinner(idx: number) {
      if (winnerDeclared) return;
      winnerDeclared = true;
      pendingWinner = idx;
      gameOver = true;

      if (finaleActive && Math.abs(zoomScale - 1.0) > 0.05) {
        // Zoom out first, then call onWinner
        zoomingOut = true;
        zoomTarget = 1.0;
      } else {
        zoomScale = 1.0;
        onWinnerRef.current(idx);
      }
    }

    // ── Game loop ─────────────────────────────────────────────────────────────
    let rafId: number;
    let startTime: number | null = null;
    let lastTime: number | null = null;

    function loop(now: number) {
      rafId = requestAnimationFrame(loop);
      if (startTime === null) startTime = now;
      if (lastTime === null) lastTime = now;
      const delta = Math.min(now - lastTime, 50);
      lastTime = now;

      // Update physics
      Matter.Engine.update(engine, delta);

      // Cannon swing
      cannonAngle =
        Math.sin(((now - startTime) / CANNON_PERIOD) * Math.PI * 2) * CANNON_SWING;

      // Fire ball
      if (!gameOver && queueIdx < ballQueue.length) {
        if (now - lastFireTime >= FIRE_MS) {
          fireBall();
          lastFireTime = now;
        }
      }

      // Rotate windmills
      for (const wm of windmills) {
        wm.angle += 0.015;
        for (let i = 0; i < 4; i++) {
          const a = wm.angle + (i * Math.PI) / 2;
          Matter.Body.setPosition(wm.blades[i], {
            x: wm.cx + Math.cos(a) * 70,
            y: wm.cy + Math.sin(a) * 70,
          });
          Matter.Body.setAngle(wm.blades[i], a);
        }
      }

      // Process active balls
      const toRemove: Matter.Body[] = [];
      for (const ball of activeBalls) {
        const pos = ball.position;

        // Fell off screen
        if (pos.y > H + 60) {
          toRemove.push(ball);
          continue;
        }

        // Entered hole
        const dist = Math.hypot(pos.x - HOLE_X, pos.y - HOLE_Y);
        if (dist < holeRadius + BALL_R * 0.6) {
          const playerId = ballMap.get(ball.id) ?? 0;
          scores[playerId]++;
          onScoreRef.current(playerId);
          toRemove.push(ball);
          continue;
        }

        // Blackhole attraction
        if (blackholeModeActive) {
          const dx = HOLE_X - pos.x;
          const dy = HOLE_Y - pos.y;
          const d = Math.max(dist, 20);
          const intensityT = Math.min(1, (BLACKHOLE_THRESHOLD - unfired()) / BLACKHOLE_THRESHOLD);
          const forceMag = 0.000015 * intensityT * (1 + intensityT);
          Matter.Body.applyForce(ball, pos, {
            x: (dx / d) * forceMag,
            y: (dy / d) * forceMag,
          });
        }
      }

      for (const b of toRemove) {
        activeBalls.delete(b);
        ballMap.delete(b.id);
        Matter.World.remove(world, b);
      }

      // Mode transitions
      if (!blackholeModeActive && unfired() <= BLACKHOLE_THRESHOLD) {
        blackholeModeActive = true;
        bhBlinkPhase = 0;
        bhBlinkTimer = now;
        bhTextVisible = true;
        bhTextSolid = false;
        if (shader) shader.active = true;
      }

      if (!finaleActive && unfired() <= FINALE_THRESHOLD) {
        finaleActive = true;
        engine.timing.timeScale = 0.25;
        zoomTarget = 2.5;
      }

      // Grow hole radius
      if (blackholeModeActive) {
        const t = Math.min(1, Math.max(0, (BLACKHOLE_THRESHOLD - unfired()) / BLACKHOLE_THRESHOLD));
        updateHoleSensor(HOLE_R_MIN + (HOLE_R_MAX - HOLE_R_MIN) * t);
      }

      // Blink "BLACK HOLE MODE" 5 times then hold
      if (blackholeModeActive && !bhTextSolid) {
        if (now - bhBlinkTimer > 350) {
          bhBlinkTimer = now;
          bhBlinkPhase++;
          bhTextVisible = !bhTextVisible;
          if (bhBlinkPhase >= 10) {
            bhTextSolid = true;
            bhTextVisible = true;
          }
        }
      }

      // Zoom in (finale)
      if (finaleActive && !zoomingOut) {
        zoomScale += (zoomTarget - zoomScale) * 0.04;
      }

      // Check winner
      if (!winnerDeclared) {
        const w = checkWinner(scores, remainingForWinner());
        if (w !== null) {
          triggerWinner(w);
        }
      }

      // All balls gone with no winner yet
      if (!winnerDeclared && !gameOver && unfired() === 0 && activeBalls.size === 0) {
        const w = checkWinner(scores, 0);
        if (w !== null) triggerWinner(w);
      }

      // Zoom-out after winner
      if (zoomingOut) {
        zoomScale += (1.0 - zoomScale) * 0.08;
        if (Math.abs(zoomScale - 1.0) < 0.02) {
          zoomScale = 1.0;
          zoomingOut = false;
          if (pendingWinner !== null) {
            onWinnerRef.current(pendingWinner);
          }
        }
      }

      // Render
      render(now);
    }

    // ── Render ────────────────────────────────────────────────────────────────
    function render(now: number) {
      ctx.clearRect(0, 0, W, H);

      // Zoom transform centered on hole
      ctx.save();
      ctx.translate(HOLE_X, HOLE_Y);
      ctx.scale(zoomScale, zoomScale);
      ctx.translate(-HOLE_X, -HOLE_Y);

      // Background
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      // Hole
      ctx.save();
      if (holeImg && holeImg.naturalWidth > 0) {
        ctx.drawImage(
          holeImg,
          HOLE_X - holeRadius,
          HOLE_Y - holeRadius,
          holeRadius * 2,
          holeRadius * 2
        );
      } else {
        ctx.fillStyle = '#1a0a2e';
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#6600cc';
        ctx.beginPath();
        ctx.arc(HOLE_X, HOLE_Y, holeRadius, 0, Math.PI * 2);
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
      if (map === 'windmill') {
        ctx.save();
        ctx.fillStyle = '#39FF14';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#39FF14';
        for (const wm of windmills) {
          for (let i = 0; i < 4; i++) {
            const a = wm.angle + (i * Math.PI) / 2;
            const bx = wm.cx + Math.cos(a) * 70;
            const by = wm.cy + Math.sin(a) * 70;
            ctx.save();
            ctx.translate(bx, by);
            ctx.rotate(a);
            ctx.fillRect(-70, -8, 140, 16);
            ctx.restore();
          }
        }
        ctx.restore();
      }

      // Balls
      for (const ball of activeBalls) {
        const pos = ball.position;
        const playerId = ballMap.get(ball.id) ?? 0;
        const tinted = tintedBalls[playerId];
        if (tinted) {
          ctx.drawImage(tinted, pos.x - BALL_R, pos.y - BALL_R, BALL_R * 2, BALL_R * 2);
        } else {
          ctx.fillStyle = players[playerId]?.color ?? '#ffffff';
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, BALL_R, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Cannon
      ctx.save();
      ctx.translate(CANNON_X, CANNON_Y);
      ctx.rotate(cannonAngle);
      if (cannonImg && cannonImg.naturalWidth > 0) {
        // cannon.png drawn centered, pointing downward
        ctx.drawImage(cannonImg, -40, -40, 80, 80);
      } else {
        // Fallback: simple cannon shape
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

      ctx.restore(); // zoom

      // ── HUD (not zoomed) ────────────────────────────────────────────────
      if (blackholeModeActive && (bhTextSolid || bhTextVisible)) {
        ctx.save();
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FF0000';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#FF0000';
        ctx.fillText('BLACK HOLE MODE', W - 20, 56);
        ctx.restore();
      }

      // WebGL shader overlay
      if (blackholeModeActive && shader) {
        const intensityT = Math.min(
          1,
          Math.max(0, (BLACKHOLE_THRESHOLD - unfired()) / BLACKHOLE_THRESHOLD)
        );
        const sx = window.innerWidth / W;
        const sy = window.innerHeight / H;
        // Hole screen position accounting for zoom
        const holeScreenX = (HOLE_X + (HOLE_X - HOLE_X) * (zoomScale - 1)) * sx;
        const holeScreenY = (HOLE_Y + (HOLE_Y - HOLE_Y) * (zoomScale - 1)) * sy;
        shader.render(
          now / 1000,
          holeScreenX,
          holeScreenY,
          window.innerWidth,
          window.innerHeight,
          intensityT
        );
      }
    }

    rafId = requestAnimationFrame(loop);

    // Resize
    function onResize() {
      applyCanvasScale();
      if (shader) shader.resize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
      if (shader) shader.destroy();
      clearTintCache();
      window.removeEventListener('resize', onResize);
    };
  }, [players, map]);

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
