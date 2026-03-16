'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import PlayerList from '@/components/PlayerList';
import WinnerDisplay from '@/components/game/WinnerDisplay';
import Confetti from '@/components/game/Confetti';
import { PLAYER_COLORS, distributeBalls } from '@/lib/ballTint';

// PachinkoBoard uses browser APIs, must be loaded client-side only
const PachinkoBoard = dynamic(() => import('@/components/game/PachinkoBoard'), {
  ssr: false,
});

interface Player {
  name: string;
  color: string;
  initialBalls: number;
}

export default function GamePage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [map, setMap] = useState('default');
  const [scores, setScores] = useState<number[]>([]);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [setupVisible, setSetupVisible] = useState(false);
  const [gameKey, setGameKey] = useState(0);

  // New game form state
  const [namesInput, setNamesInput] = useState('');
  const [newMap, setNewMap] = useState('default');

  useEffect(() => {
    const stored = sessionStorage.getItem('players');
    const storedMap = sessionStorage.getItem('map');
    if (!stored) {
      router.push('/');
      return;
    }
    const parsed = JSON.parse(stored) as Player[];
    setPlayers(parsed);
    setMap(storedMap ?? 'default');
    setScores(Array(parsed.length).fill(0));
    setWinnerIndex(null);
    setShowSetup(false);
    setSetupVisible(false);
  }, [gameKey, router]);

  const onScore = useCallback((playerId: number) => {
    setScores((prev) => {
      const next = [...prev];
      next[playerId] = (next[playerId] ?? 0) + 1;
      return next;
    });
  }, []);

  const onWinner = useCallback((playerIndex: number) => {
    setWinnerIndex(playerIndex);
    setShowSetup(true);
    // Trigger CSS fade-in on next paint
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setSetupVisible(true))
    );
  }, []);

  // New game form validation
  const newNames = namesInput
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  const newUnique = [...new Set(newNames)];
  const newIsValid =
    newUnique.length >= 2 &&
    newUnique.length <= 30 &&
    newUnique.length === newNames.length;

  const handleNewGame = useCallback(() => {
    if (!newIsValid) return;
    const counts = distributeBalls(newUnique.length);
    const newPlayers = newUnique.map((name, i) => ({
      name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      initialBalls: counts[i],
    }));
    sessionStorage.setItem('players', JSON.stringify(newPlayers));
    sessionStorage.setItem('map', newMap);
    setNamesInput('');
    setGameKey((k) => k + 1);
  }, [newIsValid, newUnique, newMap]);

  if (players.length === 0) return null;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <PachinkoBoard
        key={gameKey}
        players={players}
        map={map}
        onScore={onScore}
        onWinner={onWinner}
      />

      <PlayerList players={players} scores={scores} gameStarted={true} />

      {winnerIndex !== null && (
        <>
          <WinnerDisplay player={players[winnerIndex]} />
          <Confetti />
        </>
      )}

      {showSetup && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: 24,
            opacity: setupVisible ? 1 : 0,
            transition: 'opacity 1s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            zIndex: 40,
          }}
        >
          <div
            style={{
              color: '#aaa',
              fontSize: 13,
              fontFamily: 'monospace',
              marginBottom: 4,
            }}
          >
            이름들을 입력하세요 (콤마로 구분, 2~30명)
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
            <textarea
              value={namesInput}
              onChange={(e) => setNamesInput(e.target.value)}
              placeholder="플레이어A, 플레이어B, 플레이어C"
              style={{
                width: 320,
                height: 120,
                background: '#111',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: 6,
                padding: 10,
                fontFamily: 'monospace',
                fontSize: 14,
                resize: 'none',
                outline: 'none',
              }}
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                justifyContent: 'space-between',
              }}
            >
              <select
                value={newMap}
                onChange={(e) => setNewMap(e.target.value)}
                style={{
                  background: '#111',
                  color: '#fff',
                  border: '1px solid #333',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontFamily: 'monospace',
                  fontSize: 14,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="default">기본맵</option>
                <option value="windmill">빙글빙글 물레방아</option>
              </select>
              <button
                onClick={handleNewGame}
                disabled={!newIsValid}
                style={{
                  background: newIsValid ? '#1E90FF' : '#222',
                  color: newIsValid ? '#fff' : '#555',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 24px',
                  fontFamily: 'monospace',
                  fontSize: 16,
                  fontWeight: 'bold',
                  cursor: newIsValid ? 'pointer' : 'not-allowed',
                  flex: 1,
                }}
              >
                시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
