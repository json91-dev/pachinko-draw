export const PLAYER_COLORS: string[] = [
  '#FF4757', '#2ED573', '#1E90FF', '#FFA502', '#FF6B81',
  '#70A1FF', '#7BED9F', '#ECCC68', '#A29BFE', '#FD79A8',
  '#00CEC9', '#FDCB6E', '#6C5CE7', '#E17055', '#74B9FF',
  '#55EFC4', '#E84393', '#F8C471', '#48C9B0', '#F0B27A',
  '#FF7675', '#00B894', '#0984E3', '#D35400', '#8E44AD',
  '#27AE60', '#2980B9', '#C0392B', '#F39C12', '#16A085',
];

export function distributeBalls(playerCount: number): number[] {
  const perPlayer = Math.floor(500 / playerCount);
  const remainder = 500 % playerCount;
  return Array.from({ length: playerCount }, (_, i) =>
    i === 0 ? perPlayer + remainder : perPlayer
  );
}

export function createBallQueue(ballCounts: number[]): number[] {
  const queue: number[] = [];
  const remaining = [...ballCounts];
  while (remaining.some(n => n > 0)) {
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] > 0) {
        queue.push(i);
        remaining[i]--;
      }
    }
  }
  // Shuffle for mixed firing order
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  return queue;
}

const tintCache = new Map<string, HTMLCanvasElement>();

export function createTintedBall(color: string, diameter: number): HTMLCanvasElement {
  const key = `${color}-${diameter}`;
  if (tintCache.has(key)) return tintCache.get(key)!;

  const offscreen = document.createElement('canvas');
  offscreen.width = diameter;
  offscreen.height = diameter;
  const ctx = offscreen.getContext('2d')!;
  const r = diameter / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.clip();

  // Base color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, diameter, diameter);

  // Shine highlight (top-left)
  const shine = ctx.createRadialGradient(r * 0.6, r * 0.5, 0, r, r, r);
  shine.addColorStop(0, 'rgba(255,255,255,0.55)');
  shine.addColorStop(0.35, 'rgba(255,255,255,0.15)');
  shine.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, diameter, diameter);

  ctx.restore();

  tintCache.set(key, offscreen);
  return offscreen;
}

export function preloadTintedBalls(colors: string[], diameter: number): HTMLCanvasElement[] {
  return colors.map(c => createTintedBall(c, diameter));
}

export function clearTintCache() {
  tintCache.clear();
}
