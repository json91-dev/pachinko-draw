'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import PlayerList from '@/components/PlayerList';
import WinnerDisplay from '@/components/game/WinnerDisplay';
import Confetti from '@/components/game/Confetti';
import { PLAYER_COLORS, distributeBalls } from '@/lib/ballTint';

const MapPreview = dynamic(() => import('@/components/game/MapPreview'), { ssr: false });
const PachinkoBoard = dynamic(() => import('@/components/game/PachinkoBoard'), { ssr: false });

interface Player {
  name: string;
  color: string;
  initialBalls: number;
}

const MAP_LINGER_MS = 150;

export default function Page() {
  // ── Setup form state ─────────────────────────────────────────────────────
  const [namesInput, setNamesInput] = useState('');
  const [map, setMap] = useState('windmill');

  // ── Shuffle order (maps display position → name index) ───────────────────
  const [shuffledOrder, setShuffledOrder] = useState<number[]>([]);

  // ── Phase ────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup');

  // ── MapPreview visibility ─────────────────────────────────────────────────
  const [showMapPreview, setShowMapPreview] = useState(true);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleMapPreviewHide() {
    if (lingerTimer.current) clearTimeout(lingerTimer.current);
    lingerTimer.current = setTimeout(() => setShowMapPreview(false), MAP_LINGER_MS);
  }
  useEffect(() => () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); }, []);

  // ── Form visibility ────────────────────────────────────────────────────────
  const [formVisible, setFormVisible] = useState(true);

  // ── Game state ───────────────────────────────────────────────────────────
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeMap, setActiveMap] = useState('windmill');
  const [scores, setScores] = useState<number[]>([]);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [gameKey, setGameKey] = useState(0);

  // Preload PachinkoBoard chunk
  useEffect(() => { import('@/components/game/PachinkoBoard'); }, []);

  // ── Derived values ───────────────────────────────────────────────────────
  const names = namesInput.split(',').map((n) => n.trim()).filter(Boolean);
  const isValid = names.length >= 2 && names.length <= 30;
  const ballCounts = names.length >= 2 ? distributeBalls(names.length) : [];

  // Use shuffled order if it matches current names length, else identity
  const effectiveOrder =
    shuffledOrder.length === names.length
      ? shuffledOrder
      : names.map((_, i) => i);

  const previewPlayers = effectiveOrder.map((nameIdx, colorIdx) => ({
    name: names[nameIdx],
    color: PLAYER_COLORS[colorIdx % PLAYER_COLORS.length],
    initialBalls: ballCounts[colorIdx] ?? 0,
  }));

  // ── Handlers ─────────────────────────────────────────────────────────────
  function shuffle(currentNames: string[]): number[] {
    const order = currentNames.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  function handleShuffle() {
    if (names.length < 2) return;
    setShuffledOrder(shuffle(names));
    // If called after game ends → reset to pre-game state
    if (winnerIndex !== null) {
      setPhase('setup');
      setWinnerIndex(null);
      setShowMapPreview(true);
      setFormVisible(true);
    }
  }

  const handleStart = useCallback(() => {
    if (!isValid) return;
    const counts = distributeBalls(previewPlayers.length);
    const newPlayers = previewPlayers.map((p, i) => ({ ...p, initialBalls: counts[i] }));
    setPlayers(newPlayers);
    setActiveMap(map);
    setScores(Array(newPlayers.length).fill(0));
    setWinnerIndex(null);
    setFormVisible(false);
    setPhase('playing');
    scheduleMapPreviewHide();
  }, [isValid, previewPlayers, map]);

  const onScore = useCallback((playerId: number) => {
    setScores((prev) => {
      const next = [...prev];
      next[playerId] = (next[playerId] ?? 0) + 1;
      return next;
    });
  }, []);

  const onWinner = useCallback((playerIndex: number) => {
    setWinnerIndex(playerIndex);
    requestAnimationFrame(() => requestAnimationFrame(() => setFormVisible(true)));
  }, []);

  const handleNewGame = useCallback(() => {
    if (!isValid) return;
    const counts = distributeBalls(previewPlayers.length);
    const newPlayers = previewPlayers.map((p, i) => ({ ...p, initialBalls: counts[i] }));
    setPlayers(newPlayers);
    setActiveMap(map);
    setScores(Array(newPlayers.length).fill(0));
    setWinnerIndex(null);
    setFormVisible(false);
    setShowMapPreview(true);
    setGameKey((k) => k + 1);
    scheduleMapPreviewHide();
  }, [isValid, previewPlayers, map]);

  // ── Shared form UI ────────────────────────────────────────────────────────
  const isPlaying = phase === 'playing';
  const setupForm = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: '#aaa', fontSize: 13, fontFamily: 'monospace', marginBottom: 4 }}>
        이름들을 입력하세요 (콤마로 구분, 2~30명)
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        <textarea
          value={namesInput}
          onChange={(e) => setNamesInput(e.target.value)}
          placeholder="플레이어A, 플레이어B, 플레이어C"
          style={{
            width: 320, height: 120,
            background: '#111', color: '#fff',
            border: '1px solid #333', borderRadius: 6,
            padding: 10, fontFamily: 'monospace', fontSize: 14,
            resize: 'none', outline: 'none',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'space-between' }}>
          <select
            value={map}
            onChange={(e) => setMap(e.target.value)}
            style={{
              background: '#111', color: '#fff',
              border: '1px solid #333', borderRadius: 6,
              padding: '6px 10px', fontFamily: 'monospace', fontSize: 14,
              outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="windmill">빙글빙글 물레방아</option>
          </select>
          <button
            onClick={isPlaying ? handleNewGame : handleStart}
            disabled={!isValid}
            style={{
              background: isValid ? '#1E90FF' : '#222',
              color: isValid ? '#fff' : '#555',
              border: 'none', borderRadius: 6,
              padding: '10px 24px', fontFamily: 'monospace',
              fontSize: 16, fontWeight: 'bold',
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            시작
          </button>
          <button
            onClick={handleShuffle}
            disabled={!isValid}
            style={{
              background: isValid ? '#222' : '#1a1a1a',
              color: isValid ? '#FFA502' : '#444',
              border: `1px solid ${isValid ? '#FFA502' : '#333'}`,
              borderRadius: 6,
              padding: '8px 24px', fontFamily: 'monospace',
              fontSize: 14, fontWeight: 'bold',
              cursor: isValid ? 'pointer' : 'not-allowed',
            }}
          >
            섞기
          </button>
        </div>
      </div>
      {names.length > 30 && (
        <div style={{ color: '#FF4757', fontSize: 12, fontFamily: 'monospace' }}>
          최대 30명까지 가능합니다
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', position: 'relative' }}>

      {showMapPreview && <MapPreview map={phase === 'playing' ? activeMap : map} />}

      {phase === 'playing' && (
        <PachinkoBoard
          key={gameKey}
          players={players}
          map={activeMap}
          onScore={onScore}
          onWinner={onWinner}
        />
      )}

      {/* PlayerList */}
      {phase === 'setup' && previewPlayers.length > 0 && (
        <PlayerList players={previewPlayers} scores={Array(previewPlayers.length).fill(0)} gameStarted={false} />
      )}
      {phase === 'playing' && (
        <PlayerList players={players} scores={scores} gameStarted={true} />
      )}

      {/* Winner overlays */}
      {phase === 'playing' && winnerIndex !== null && (
        <>
          <WinnerDisplay player={players[winnerIndex]} />
          <Confetti />
        </>
      )}

      {/* Form */}
      {(phase === 'setup' || winnerIndex !== null) && (
        <div
          style={{
            position: 'fixed', bottom: 24, left: 24, zIndex: 40,
            opacity: formVisible ? 1 : 0,
            transition: 'opacity 0.5s ease',
            pointerEvents: formVisible ? 'auto' : 'none',
          }}
        >
          {setupForm}
        </div>
      )}
    </div>
  );
}
