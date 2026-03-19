'use client';

interface Player {
  name: string;
  color: string;
}

export default function WinnerDisplay({ player }: { player: Player }) {
  const glow = player.color;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 48,
        right: 48,
        zIndex: 30,
        textAlign: 'right',
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
      {/* Winner label */}
      <div
        style={{
          color: '#fff',
          fontSize: 'clamp(38px, 8vw, 77px)',
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: '-0.02em',
        }}
      >
        Winner
      </div>

      {/* Nickname + ball row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4em',
        }}
      >
        <div
          style={{
            color: glow,
            fontSize: 'clamp(35px, 7.2vw, 70px)',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            textShadow: `0 0 8px ${glow}`,
          }}
        >
          {player.name}
        </div>

        {/* Ball circle */}
        <div
          style={{
            width: 'clamp(35px, 7.2vw, 70px)',
            height: 'clamp(35px, 7.2vw, 70px)',
            borderRadius: '50%',
            background: glow,
            boxShadow: `0 0 8px ${glow}`,
            flexShrink: 0,
          }}
        />
      </div>
    </div>
  );
}
