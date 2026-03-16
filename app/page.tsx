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

// How long to keep MapPreview alive after PachinkoBoard mounts (ms).
// PachinkoBoard draws its first frame synchronously in useEffect,
// so 100ms is more than enough for it to cover MapPreview before we remove it.
const MAP_LINGER_MS = 150;

export default function Page() {
  // ── Setup form state ─────────────────────────────────────────────────────
  const [namesInput, setNamesInput] = useState('');
  const [map, setMap] = useState('default');

  // ── Phase ────────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup');

  // ── MapPreview visibility ─────────────────────────────────────────────────
  // Stays true until PachinkoBoard has had time to draw its first frame.
  const [showMapPreview, setShowMapPreview] = useState(true);
  const lingerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleMapPreviewHide() {
    if (lingerTimer.current) clearTimeout(lingerTimer.current);
    lingerTimer.current = setTimeout(() => setShowMapPreview(false), MAP_LINGER_MS);
  }
  useEffect(() => () => { if (lingerTimer.current) clearTimeout(lingerTimer.current); }, []);

  // ── Form visibility (only the form fades, not the canvas) ────────────────
  const [formVisible, setFormVisible] = useState(true);

  // ── Game state ───────────────────────────────────────────────────────────
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeMap, setActiveMap] = useState('default');
  const [scores, setScores] = useState<number[]>([]);
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null);
  const [gameKey, setGameKey] = useState(0);

  // Preload PachinkoBoard chunk before user clicks
  useEffect(() => { import('@/components/game/PachinkoBoard'); }, []);

  // ── Setup form derived values ────────────────────────────────────────────
  const names = namesInput.split(',').map((n) => n.trim()).filter(Boolean);
  const uniqueNames = [...new Set(names)];
  const hasDuplicates = names.length !== uniqueNames.length;
  const isValid = uniqueNames.length >= 2 && uniqueNames.length <= 30 && !hasDuplicates;

  const ballCounts = uniqueNames.length >= 2 ? distributeBalls(uniqueNames.length) : [];
  const previewPlayers = uniqueNames.map((name, i) => ({
    name,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    initialBalls: ballCounts[i] ?? 0,
  }));

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    if (!isValid) return;
    const counts = distributeBalls(uniqueNames.length);
    const newPlayers = uniqueNames.map((name, i) => ({
      name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      initialBalls: counts[i],
    }));
    setPlayers(newPlayers);
    setActiveMap(map);
    setScores(Array(newPlayers.length).fill(0));
    setWinnerIndex(null);
    setFormVisible(false);   // fade out form
    setPhase('playing');     // mount PachinkoBoard on top of MapPreview
    scheduleMapPreviewHide();// remove MapPreview after PachinkoBoard has drawn
  }, [isValid, uniqueNames, map]);

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
    const counts = distributeBalls(uniqueNames.length);
    const newPlayers = uniqueNames.map((name, i) => ({
      name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      initialBalls: counts[i],
    }));
    setPlayers(newPlayers);
    setActiveMap(map);
    setScores(Array(newPlayers.length).fill(0));
    setWinnerIndex(null);
    setFormVisible(false);
    setNamesInput('');
    // Briefly bring back MapPreview so it shows while old PachinkoBoard
    // unmounts and new one draws its first frame.
    setShowMapPreview(true);
    setGameKey((k) => k + 1);
    scheduleMapPreviewHide();
  }, [isValid, uniqueNames, map]);

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
            <option value="default">기본맵</option>
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
              cursor: isValid ? 'pointer' : 'not-allowed', flex: 1,
            }}
          >
            시작
          </button>
        </div>
      </div>
      {hasDuplicates && (
        <div style={{ color: '#FF4757', fontSize: 12, fontFamily: 'monospace' }}>
          중복된 이름이 있습니다
        </div>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', position: 'relative' }}>

      {/*
        MapPreview: stays in DOM briefly after PachinkoBoard mounts.
        PachinkoBoard canvas is transparent until its useEffect draws —
        MapPreview shows through. Then PachinkoBoard fills with black and
        MapPreview is safely removed 150ms later with no visible gap.
      */}
      {showMapPreview && <MapPreview map={phase === 'playing' ? activeMap : map} />}

      {/* PachinkoBoard: renders after MapPreview in DOM so its canvas is on top */}
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

      {/* Form: fades out on start, fades in after winner */}
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
