export const PLAYER_COLORS: string[] = [
  '#FF4757', '#2ED573', '#1E90FF', '#FFA502', '#FF6B81',
  '#70A1FF', '#7BED9F', '#ECCC68', '#A29BFE', '#FD79A8',
  '#00CEC9', '#FDCB6E', '#6C5CE7', '#E17055', '#74B9FF',
  '#55EFC4', '#E84393', '#F8C471', '#48C9B0', '#F0B27A',
  '#FF7675', '#00B894', '#0984E3', '#D35400', '#8E44AD',
  '#27AE60', '#2980B9', '#C0392B', '#F39C12', '#16A085',
];

export function distributeBalls(playerCount: number): number[] {
  const perPlayer = Math.floor(1000 / playerCount);
  const remainder = 1000 % playerCount;
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

let pinballImg: HTMLImageElement | null = null;

async function loadPinballImage(): Promise<HTMLImageElement> {
  if (pinballImg) return pinballImg;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { pinballImg = img; resolve(img); };
    img.onerror = () => resolve(img); // fallback: use empty image
    img.src = '/images/pinball.png';
  });
}

const tintCache = new Map<string, HTMLCanvasElement>();

export async function createTintedBall(color: string, diameter: number): Promise<HTMLCanvasElement> {
  const key = `${color}-${diameter}`;
  if (tintCache.has(key)) return tintCache.get(key)!;

  const offscreen = document.createElement('canvas');
  offscreen.width = diameter;
  offscreen.height = diameter;
  const ctx = offscreen.getContext('2d')!;

  // Clip to circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(diameter / 2, diameter / 2, diameter / 2, 0, Math.PI * 2);
  ctx.clip();

  // Base: player color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, diameter, diameter);

  // Overlay pinball shading via multiply
  try {
    const base = await loadPinballImage();
    if (base.complete && base.naturalWidth > 0) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(base, 0, 0, diameter, diameter);
    }
  } catch {}

  // Highlight shine
  ctx.globalCompositeOperation = 'source-over';
  const shine = ctx.createRadialGradient(
    diameter * 0.35, diameter * 0.3, 0,
    diameter * 0.5, diameter * 0.5, diameter * 0.5
  );
  shine.addColorStop(0, 'rgba(255,255,255,0.45)');
  shine.addColorStop(0.4, 'rgba(255,255,255,0.1)');
  shine.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, diameter, diameter);

  ctx.restore();

  tintCache.set(key, offscreen);
  return offscreen;
}

export async function preloadTintedBalls(colors: string[], diameter: number): Promise<HTMLCanvasElement[]> {
  return Promise.all(colors.map(c => createTintedBall(c, diameter)));
}

export function clearTintCache() {
  tintCache.clear();
  pinballImg = null;
}
