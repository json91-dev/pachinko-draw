'use client';

interface Player {
  name: string;
  color: string;
}

export default function WinnerDisplay({ player }: { player: Player }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 30,
        textAlign: 'right',
        pointerEvents: 'none',
      }}
    >
      <div style={{ color: '#fff', fontSize: 36, fontWeight: 900, lineHeight: 1.2 }}>
        Winner
      </div>
      <div
        style={{
          color: player.color,
          fontSize: 32,
          fontWeight: 900,
          lineHeight: 1.2,
          textShadow: `0 0 20px ${player.color}, 0 0 40px ${player.color}`,
        }}
      >
        {player.name}
      </div>
    </div>
  );
}
