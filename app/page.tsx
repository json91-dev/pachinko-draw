'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PlayerList from '@/components/PlayerList';
import { PLAYER_COLORS, distributeBalls } from '@/lib/ballTint';

export default function SetupPage() {
  const router = useRouter();
  const [namesInput, setNamesInput] = useState('');
  const [map, setMap] = useState('default');

  const names = namesInput
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  const uniqueNames = [...new Set(names)];
  const hasDuplicates = names.length !== uniqueNames.length;
  const isValid =
    uniqueNames.length >= 2 &&
    uniqueNames.length <= 30 &&
    !hasDuplicates;

  const ballCounts = uniqueNames.length >= 2 ? distributeBalls(uniqueNames.length) : [];
  const players = uniqueNames.map((name, i) => ({
    name,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    initialBalls: ballCounts[i] ?? 0,
  }));

  const handleStart = useCallback(() => {
    if (!isValid) return;
    sessionStorage.setItem('players', JSON.stringify(players));
    sessionStorage.setItem('map', map);
    router.push('/game');
  }, [isValid, players, map, router]);

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
      {players.length > 0 && (
        <PlayerList
          players={players}
          scores={Array(players.length).fill(0)}
          gameStarted={false}
        />
      )}

      {/* Setup form — bottom-left */}
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          left: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
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
          {/* Textarea */}
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

          {/* Right column */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              justifyContent: 'space-between',
            }}
          >
            <select
              value={map}
              onChange={(e) => setMap(e.target.value)}
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
              onClick={handleStart}
              disabled={!isValid}
              style={{
                background: isValid ? '#1E90FF' : '#222',
                color: isValid ? '#fff' : '#555',
                border: 'none',
                borderRadius: 6,
                padding: '10px 24px',
                fontFamily: 'monospace',
                fontSize: 16,
                fontWeight: 'bold',
                cursor: isValid ? 'pointer' : 'not-allowed',
                flex: 1,
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
        {names.length > 30 && (
          <div style={{ color: '#FF4757', fontSize: 12, fontFamily: 'monospace' }}>
            최대 30명까지 가능합니다
          </div>
        )}
      </div>
    </div>
  );
}
