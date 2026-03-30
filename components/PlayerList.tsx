'use client';

interface Player {
  name: string;
  color: string;
  initialBalls: number;
}

interface PlayerListProps {
  players: Player[];
  scores: number[];
  gameStarted: boolean;
}

export default function PlayerList({ players, scores, gameStarted }: PlayerListProps) {
  if (players.length === 0) return null;

  const entries = players.map((p, i) => ({
    name: p.name,
    color: p.color,
    value: gameStarted ? scores[i] ?? 0 : p.initialBalls,
    originalIndex: i,
  }));

  if (gameStarted) {
    entries.sort((a, b) => b.value - a.value);
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 2,
        maxHeight: 'calc(100vh - 32px)',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {entries.map((entry, rank) => (
        <div
          key={entry.originalIndex}
          style={{
            color: entry.color,
            fontSize: 18,
            fontWeight: 'bold',
            fontFamily: 'monospace',
            textShadow: `0 0 8px ${entry.color}`,
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}
        >
          {gameStarted ? entry.value : 0}개 {entry.name} #{rank + 1}
        </div>
      ))}
    </div>
  );
}
