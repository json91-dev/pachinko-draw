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

// Virtual resolution — portrait 9:16, CSS-scaled uniformly to fit viewport
const W = 1080;
const H = 1920;

const BALL_R = 10;
const PIN_R = 10;
const PIN_VISUAL_R = 13;

const HOLE_X = 540;
const HOLE_Y = 1558; // moved up ~10% from 1750
const HOLE_R_MIN = 40;
const HOLE_R_MAX = 80;

const CANNON_X = 540;
const CANNON_Y = 80;
const CANNON_SWING = (40 * Math.PI) / 180; // ±40°
const CANNON_PERIOD = 4000; // ms

const FIRE_MS = 40;

const BLACKHOLE_THRESHOLD = 200;
const FINALE_THRESHOLD = 150;

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

interface BumperDef {
  x: number;
  y: number;
  r: number;
}

interface FlipperDef {
  cx: number;
  cy: number;
  width: number;
  height: number;
  rangeX: number; // oscillation amplitude
  period: number;
  phase: number; // phase offset in radians
  body: Matter.Body | null;
}

// Funnel map obstacle definitions (shared between buildPins and game logic)
const FUNNEL_BUMPERS: BumperDef[] = [
  { x: 540, y: 450, r: 50 },
  { x: 270, y: 700, r: 45 },
  { x: 810, y: 700, r: 45 },
];

const FUNNEL_FLIPPERS: Omit<FlipperDef, 'body'>[] = [
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

  const HOLE_EXCLUDE = HOLE_R_MAX + 65;
  const WALL_PIN_MARGIN = 50;

  function addPin(x: number, y: number) {
    const skipWm = wmCenters.some((wm) => Math.hypot(x - wm.x, y - wm.y) < 150);
    const skipHole = Math.hypot(x - HOLE_X, y - HOLE_Y) < HOLE_EXCLUDE;
    // Skip pins near funnel bumpers
    const skipBumper = map === 'funnel' && FUNNEL_BUMPERS.some((b) => Math.hypot(x - b.x, y - b.y) < b.r + 60);
    // Skip pins near funnel flipper paths
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

    // Uniform scale to fill viewport while keeping 1600×900 aspect ratio
    let canvasScale = 1;
    let canvasOffsetX = 0;
    let canvasOffsetY = 0;

    function applyCanvasScale() {
      const sx = window.innerWidth / W;
      const sy = window.innerHeight / H;
      canvasScale = Math.min(sx, sy);
      canvasOffsetX = (window.innerWidth - W * canvasScale) / 2;
      canvasOffsetY = (window.innerHeight - H * canvasScale) / 2;
      canvas!.style.transform = `translate(${canvasOffsetX}px, ${canvasOffsetY}px) scale(${canvasScale})`;
      canvas!.style.transformOrigin = 'top left';
    }
    applyCanvasScale();

    // ── Matter.js setup ──────────────────────────────────────────────────────
    const engine = Matter.Engine.create({ gravity: { y: 0.96 } });
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
        restitution: 0.65,
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
        { x: 270, y: 960 },
        { x: 810, y: 960 },
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

    // Bumpers (funnel map)
    const bumperBodies: Matter.Body[] = [];
    if (map === 'funnel') {
      for (const b of FUNNEL_BUMPERS) {
        const body = Matter.Bodies.circle(b.x, b.y, b.r, {
          isStatic: true,
          friction: 0,
          restitution: 1.3,
          label: 'bumper',
        });
        bumperBodies.push(body);
        Matter.World.add(world, body);
      }
    }

    // Flippers (funnel map)
    const flippers: FlipperDef[] = [];
    if (map === 'funnel') {
      for (const f of FUNNEL_FLIPPERS) {
        const body = Matter.Bodies.rectangle(f.cx, f.cy, f.width, f.height, {
          isStatic: true,
          friction: 0,
          restitution: 0.5,
          label: 'flipper',
        });
        Matter.World.add(world, body);
        flippers.push({ ...f, body });
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
    let finaleStartTime: number | null = null;
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

    // Track consumed pins (absorbed by blackhole)
    const consumedPins = new Set<number>();
    // Suction particle max spawn radius determines the blackhole gravity field
    const SUCTION_FIELD_RADIUS = 340; // holeRadius + 60 + 280

    // Suction particles
    interface SuctionParticle {
      angle: number;
      dist: number;
      angularSpeed: number;
      size: number;
      alpha: number;
      hue: number;
    }
    const suctionParticles: SuctionParticle[] = [];

    // ── Images ──────────────────────────────────────────────────────────────
    let pinImg: HTMLImageElement | null = null;
    let tintedBalls: HTMLCanvasElement[] = [];

    const pi = new Image();
    pi.onload = () => { pinImg = pi; };
    pi.src = '/images/pin_128.png';

    tintedBalls = preloadTintedBalls(players.map((p) => p.color), BALL_R * 2);

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

    // ── Ball firing (3 barrels) ─────────────────────────────────────────────
    const BARREL_LENGTH = 60;
    const BARREL_SPREAD = 14 * Math.PI / 180;

    function fireBall() {
      if (queueIdx >= ballQueue.length) return;

      // const barrelOffsets = [-BARREL_SPREAD, 0, BARREL_SPREAD]; // 3줄기
      const barrelOffsets = [0]; // 1줄기
      const speed = 9;

      for (const offset of barrelOffsets) {
        if (queueIdx >= ballQueue.length) break;
        const playerId = ballQueue[queueIdx++];

        const dir = cannonAngle + offset;
        // Canvas CW rotation: x' = -length*sin(θ), y' = length*cos(θ)
        const spawnX = CANNON_X - Math.sin(dir) * BARREL_LENGTH;
        const spawnY = CANNON_Y + Math.cos(dir) * BARREL_LENGTH + BALL_R;

        const ball = Matter.Bodies.circle(spawnX, spawnY, BALL_R, {
          restitution: 0.72,
          friction: 0.03,
          frictionAir: 0.004,
          density: 0.004,
          label: 'ball',
        });
        Matter.Body.setVelocity(ball, {
          x: -Math.sin(dir) * speed,
          y: Math.cos(dir) * speed,
        });
        Matter.World.add(world, ball);
        ballMap.set(ball.id, playerId);
        activeBalls.add(ball);
      }
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

      // Oscillate flippers
      for (const f of flippers) {
        if (!f.body) continue;
        const t = (now / f.period) * Math.PI * 2 + f.phase;
        const newX = f.cx + Math.sin(t) * f.rangeX;
        Matter.Body.setPosition(f.body, { x: newX, y: f.cy });
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

        // Blackhole attraction — steer direction toward hole, preserve speed
        if (blackholeModeActive) {
          const dx = HOLE_X - pos.x;
          const dy = HOLE_Y - pos.y;
          const d = Math.max(dist, 20);
          const intensityT = Math.min(1, (BLACKHOLE_THRESHOLD - unfired()) / BLACKHOLE_THRESHOLD);
          const vel = ball.velocity;
          let speed = Math.hypot(vel.x, vel.y);
          const toHoleX = dx / d;
          const toHoleY = dy / d;

          // Minimum speed guarantee near hole
          if (speed < 2 && d < 200) {
            speed = 2;
          }

          if (speed > 0.5) {
            const belowBoost = pos.y > HOLE_Y ? 1.8 : 1.0;
            const steer = (0.08 + intensityT * 0.25) * Math.min(3, 200 / d) * belowBoost;
            const newVx = vel.x + toHoleX * steer;
            const newVy = vel.y + toHoleY * steer;

            // Lerp velocity toward hole direction — closer = stronger
            // Balls below the hole get much stronger lerp to overcome gravity
            const isBelow = pos.y > HOLE_Y;
            const baseLerp = d < 200 ? (1 - d / 200) : 0;
            const lerpT = isBelow ? baseLerp * 0.85 : baseLerp * 0.4;
            const finalVx = newVx * (1 - lerpT) + toHoleX * speed * lerpT;
            const finalVy = newVy * (1 - lerpT) + toHoleY * speed * lerpT;
            const finalSpeed = Math.hypot(finalVx, finalVy);
            Matter.Body.setVelocity(ball, {
              x: (finalVx / finalSpeed) * speed,
              y: (finalVy / finalSpeed) * speed,
            });
          }

          // Disable ball-ball collisions near blackhole to prevent clumping
          if (d < 200) {
            if (ball.collisionFilter.group !== -1) {
              ball.collisionFilter.group = -1;
            }
          } else {
            if (ball.collisionFilter.group !== 0) {
              ball.collisionFilter.group = 0;
            }
          }
        }
      }

      for (const b of toRemove) {
        activeBalls.delete(b);
        ballMap.delete(b.id);
        Matter.World.remove(world, b);
      }

      // Suction particles: spawn + update when blackhole active
      if (blackholeModeActive) {
        const intensity = Math.min(1, (BLACKHOLE_THRESHOLD - unfired()) / BLACKHOLE_THRESHOLD);
        if (Math.random() < 0.4 + intensity * 0.4) {
          suctionParticles.push({
            angle: Math.random() * Math.PI * 2,
            dist: holeRadius + 60 + Math.random() * 280,
            angularSpeed: 0.015 + Math.random() * 0.025,
            size: 1.5 + Math.random() * 3,
            alpha: 0.7 + Math.random() * 0.3,
            hue: 260 + Math.random() * 60,
          });
        }
        for (const p of suctionParticles) {
          p.angle += p.angularSpeed * (1 + 40 / Math.max(p.dist, 10));
          p.dist -= 1.2 + (holeRadius * 3) / Math.max(p.dist, 20);
          p.alpha -= 0.006;
        }
        // Remove consumed particles
        for (let i = suctionParticles.length - 1; i >= 0; i--) {
          if (suctionParticles[i].dist <= holeRadius + 2 || suctionParticles[i].alpha <= 0) {
            suctionParticles.splice(i, 1);
          }
        }
      }

      // Absorb pins within suction field
      if (blackholeModeActive) {
        const intensityForPins = Math.min(1, (BLACKHOLE_THRESHOLD - unfired()) / BLACKHOLE_THRESHOLD);
        // Shrink the safe zone as intensity grows — pins get consumed progressively
        const consumeRadius = holeRadius + 40 + intensityForPins * (SUCTION_FIELD_RADIUS - holeRadius - 40);
        for (let i = 0; i < pinDefs.length; i++) {
          if (consumedPins.has(i)) continue;
          const d = Math.hypot(pinDefs[i].x - HOLE_X, pinDefs[i].y - HOLE_Y);
          if (d < consumeRadius) {
            consumedPins.add(i);
            Matter.World.remove(world, pinBodies[i]);
          }
        }
      }

      // Mode transitions
      if (!blackholeModeActive && unfired() <= BLACKHOLE_THRESHOLD) {
        blackholeModeActive = true;
        bhBlinkPhase = 0;
        bhBlinkTimer = now;
        bhTextVisible = true;
        bhTextSolid = false;
      }

      if (!finaleActive && unfired() === 0) {
        finaleActive = true;
        finaleStartTime = now;
        engine.timing.timeScale = 0.25;
        zoomTarget = 1.8; // show entire blackhole + suction field
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

      // Finale timeout — force end after 15 seconds
      if (finaleActive && !winnerDeclared && finaleStartTime !== null && now - finaleStartTime > 15000) {
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
      const bhIntensity = blackholeModeActive
        ? Math.min(1, (BLACKHOLE_THRESHOLD - unfired()) / BLACKHOLE_THRESHOLD)
        : 0;

      // Suction particles (draw first, behind hole)
      for (const p of suctionParticles) {
        const px = HOLE_X + Math.cos(p.angle) * p.dist;
        const py = HOLE_Y + Math.sin(p.angle) * p.dist;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsl(${p.hue}, 100%, 65%)`;
        ctx.fillStyle = `hsl(${p.hue}, 100%, 65%)`;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Accretion disk (glowing ring around hole)
      const diskR = holeRadius + 18 + bhIntensity * 14;
      const accGrad = ctx.createRadialGradient(HOLE_X, HOLE_Y, holeRadius, HOLE_X, HOLE_Y, diskR + 20);
      accGrad.addColorStop(0, `rgba(255, 120, 0, ${0.6 + bhIntensity * 0.3})`);
      accGrad.addColorStop(0.4, `rgba(180, 0, 120, ${0.3 + bhIntensity * 0.2})`);
      accGrad.addColorStop(1, 'rgba(80, 0, 200, 0)');
      ctx.fillStyle = accGrad;
      ctx.beginPath();
      ctx.arc(HOLE_X, HOLE_Y, diskR + 20, 0, Math.PI * 2);
      ctx.fill();

      // Bright event horizon ring
      ctx.shadowBlur = 50 + bhIntensity * 30;
      ctx.shadowColor = '#ff6600';
      ctx.strokeStyle = `rgba(255, ${120 - bhIntensity * 80}, 0, ${0.8 + bhIntensity * 0.2})`;
      ctx.lineWidth = 3 + bhIntensity * 2;
      ctx.beginPath();
      ctx.arc(HOLE_X, HOLE_Y, holeRadius + 2, 0, Math.PI * 2);
      ctx.stroke();

      // Outer purple ring
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#8800ff';
      ctx.strokeStyle = '#6600cc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(HOLE_X, HOLE_Y, holeRadius + 14, 0, Math.PI * 2);
      ctx.stroke();

      // Dark singularity center with gravitational lens highlight
      const lensGrad = ctx.createRadialGradient(
        HOLE_X - holeRadius * 0.25, HOLE_Y - holeRadius * 0.25, 0,
        HOLE_X, HOLE_Y, holeRadius
      );
      lensGrad.addColorStop(0, '#0d0020');
      lensGrad.addColorStop(0.6, '#000000');
      lensGrad.addColorStop(1, '#000008');
      ctx.shadowBlur = 0;
      ctx.fillStyle = lensGrad;
      ctx.beginPath();
      ctx.arc(HOLE_X, HOLE_Y, holeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Spiral arms (6 arms, faster rotation)
      const armCount = 6;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < armCount; i++) {
        const a = spiralTime * 2 + i * (Math.PI * 2 / armCount);
        const opacity = (0.25 + 0.25 * Math.sin(spiralTime * 3 + i)) * (0.5 + bhIntensity * 0.5);
        ctx.strokeStyle = `rgba(200, 60, 255, ${opacity})`;
        ctx.beginPath();
        ctx.moveTo(HOLE_X, HOLE_Y);
        ctx.lineTo(
          HOLE_X + Math.cos(a) * (holeRadius - 4),
          HOLE_Y + Math.sin(a) * (holeRadius - 4)
        );
        ctx.stroke();
      }

      // Lens flare dot
      ctx.fillStyle = 'rgba(255, 200, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(HOLE_X - holeRadius * 0.3, HOLE_Y - holeRadius * 0.3, holeRadius * 0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Pins
      for (let pi = 0; pi < pinDefs.length; pi++) {
        if (consumedPins.has(pi)) continue;
        const pin = pinDefs[pi];
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

      // Bumpers (funnel map)
      if (map === 'funnel') {
        ctx.save();
        for (let i = 0; i < FUNNEL_BUMPERS.length; i++) {
          const b = FUNNEL_BUMPERS[i];
          // Outer glow ring
          ctx.shadowBlur = 30;
          ctx.shadowColor = '#FF1493';
          ctx.strokeStyle = '#FF1493';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r + 4, 0, Math.PI * 2);
          ctx.stroke();
          // Inner gradient fill
          const bGrad = ctx.createRadialGradient(b.x - b.r * 0.2, b.y - b.r * 0.2, 0, b.x, b.y, b.r);
          bGrad.addColorStop(0, '#FF69B4');
          bGrad.addColorStop(0.6, '#FF1493');
          bGrad.addColorStop(1, '#C71585');
          ctx.shadowBlur = 20;
          ctx.fillStyle = bGrad;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          // Highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.beginPath();
          ctx.arc(b.x - b.r * 0.25, b.y - b.r * 0.25, b.r * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Flippers
        ctx.save();
        ctx.shadowBlur = 18;
        ctx.shadowColor = '#FF8C00';
        for (const f of flippers) {
          if (!f.body) continue;
          const pos = f.body.position;
          ctx.fillStyle = '#FFA500';
          ctx.beginPath();
          ctx.roundRect(pos.x - f.width / 2, pos.y - f.height / 2, f.width, f.height, 8);
          ctx.fill();
          // Highlight stripe
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.beginPath();
          ctx.roundRect(pos.x - f.width / 2 + 4, pos.y - f.height / 2 + 2, f.width - 8, f.height / 3, 4);
          ctx.fill();
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

      // ── Cannon ────────────────────────────────────────────────────────────
      ctx.save();
      ctx.translate(CANNON_X, CANNON_Y);
      ctx.rotate(cannonAngle);

      // Carriage base (behind barrels)
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
        // Spokes
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

      // 3 Barrels (pointing downward / forward)
      const cannonBarrelAngles = [-BARREL_SPREAD, 0, BARREL_SPREAD];
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate(cannonBarrelAngles[i]);
        // Barrel body
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#22FFFF';
        ctx.fillStyle = '#1a7a9a';
        ctx.beginPath();
        ctx.roundRect(-5, 2, 10, 52, [2, 2, 5, 5]);
        ctx.fill();
        // Barrel highlight
        ctx.fillStyle = '#22FFFF';
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.roundRect(-4, 3, 4, 50, [2, 2, 3, 3]);
        ctx.fill();
        ctx.globalAlpha = 1;
        // Muzzle ring
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#22FFFF';
        ctx.fillStyle = '#22FFFF';
        ctx.beginPath();
        ctx.roundRect(-6, 46, 12, 8, 3);
        ctx.fill();
        // Breech ring
        ctx.fillStyle = '#0AEEEE';
        ctx.beginPath();
        ctx.roundRect(-6, 2, 12, 7, 2);
        ctx.fill();
        ctx.restore();
      }

      // Hub (pivot)
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
      // Hub center dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      ctx.restore(); // zoom

      // ── HUD (not zoomed) ────────────────────────────────────────────────
      // Ball count + progress bar (top-left)
      {
        const totalBalls = ballQueue.length;
        const remaining = unfired();
        const fired = totalBalls - remaining;
        const progress = totalBalls > 0 ? fired / totalBalls : 1;
        const barW = 200;
        const barH = 10;
        const bx = 16;
        const by = 24;

        ctx.save();
        // Label
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#aaaaaa';
        ctx.shadowBlur = 0;
        ctx.fillText(`남은 공: ${remaining}`, bx, by);
        // Bar background
        ctx.fillStyle = '#222233';
        ctx.beginPath();
        ctx.roundRect(bx, by + 6, barW, barH, 4);
        ctx.fill();
        // Bar fill with gradient
        if (progress > 0) {
          const barGrad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
          barGrad.addColorStop(0, '#22FFFF');
          barGrad.addColorStop(1, '#8800ff');
          ctx.fillStyle = barGrad;
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#22FFFF';
          ctx.beginPath();
          ctx.roundRect(bx, by + 6, barW * progress, barH, 4);
          ctx.fill();
        }
        ctx.restore();
      }

      if (blackholeModeActive && (bhTextSolid || bhTextVisible)) {
        ctx.save();
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#FF0000';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#FF0000';
        ctx.fillText('BLACK HOLE MODE', W - 16, 56);
        ctx.restore();
      }

    }

    // Draw first frame synchronously so canvas is never blank when it appears
    render(performance.now());
    rafId = requestAnimationFrame(loop);

    // Resize
    function onResize() {
      applyCanvasScale();
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(rafId);
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);

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
