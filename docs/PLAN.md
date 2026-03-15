# 파칭코 뽑기 구현 플랜

## 기술 스택
- **프레임워크:** Next.js (App Router)
- **물리 엔진:** Matter.js
- **언어:** TypeScript
- **렌더링:** HTML Canvas (오프스크린 합성 포함) + WebGL (블랙홀 쉐이더)

---

## 핵심 설계 원칙

### 고정 가상 해상도 + CSS 스케일링
- 캔버스 내부 좌표계: **1600 × 900** (가상 해상도 고정)
- Matter.js 물리 월드도 동일 좌표 기준
- CSS `transform: scale()` + `transform-origin: top left`로 뷰포트에 맞게 스케일링
- 핀·물레·블랙홀 위치는 모두 1600×900 기준 절대 좌표로 정의 → 브라우저 크기 변화에 무관

---

## 단계별 구현 계획

### Phase 1 — 프로젝트 초기 설정
1. `public/images/`에 에셋 배치 (`cannon.png`, `pin_128.png`, `pinball.png`, `hole.png`)
2. 디렉터리 구조 생성
   ```
   app/
     page.tsx                  ← 설정 화면
     game/
       page.tsx                ← 게임 화면 (결과 포함)
   components/
     PlayerList.tsx            ← 우측 상단 플레이어 목록 (설정·게임 공통)
     game/
       PachinkoBoard.tsx       ← 메인 게임 캔버스 (1600×900 가상 해상도)
       Windmill.tsx            ← 물레 컴포넌트
       BlackHole.tsx           ← 블랙홀 sensor + 모드
       WinnerBanner.tsx        ← 우측 하단 우승자 배너
   lib/
     ballTint.ts
     blackholeShader.ts
     winnerCheck.ts
   ```

---

### Phase 2 — 설정 화면 (`app/page.tsx`)
- **레이아웃:** 전체화면, 검정 배경
- **입력 영역 (화면 하단):**
  - "이름들을 입력하세요" 제목
  - 큰 textarea (콤마 구분 닉네임 입력)
  - 맵 선택 `<select>` 드롭다운 (기본맵 / 빙글빙글 물레방아)
  - "시작" 버튼 (유효성 통과 시 활성화)
- **유효성 검사:** 빈 닉네임 불허, 중복 불허, 2~30명
- **전환:** 시작 버튼 클릭 → 입력 영역 즉시 제거 → 게임 화면으로 이동
- **PlayerList 컴포넌트:** 우측 상단에 항상 표시 (설정 화면에서도 실시간 미리보기)

---

### Phase 3 — PlayerList 컴포넌트 (`components/PlayerList.tsx`)
설정 화면과 게임 화면 모두에서 공통으로 사용하는 우측 상단 플레이어 목록.

- **위치:** `position: fixed; top; right` — 화면 우측 상단 고정
- **형식:** 각 플레이어 한 행, 우측 정렬
  ```
  10개 닉네임1 #1
  33개 닉네임2 #2
  ```
- **색상:** 행별 텍스트 색상 = 해당 플레이어의 구슬 색상
- **설정 화면:** 구슬 수 = 분배된 초기 구슬 수 표시
- **게임 화면:** 구슬 수 = 현재 점수(구멍에 넣은 수)로 실시간 업데이트
- **이 컴포넌트가 게임 중 HUD 역할을 동시에 수행 (별도 Scoreboard 컴포넌트 없음)**

---

### Phase 4 — 핵심 유틸리티

#### `lib/ballTint.ts`
- **색상 팔레트:** 30개 사전 정의 색상 배열
- **구슬 분배 계산:** 총 1000개 ÷ 참가 인원 수 (나머지는 첫 번째 플레이어에 배분)
- **Canvas 합성 함수:**
  - `pinball.png` 베이스 이미지 로드 및 캐싱
  - `globalCompositeOperation: 'multiply'`로 플레이어 색상 적용
  - 플레이어별 오프스크린 Canvas 이미지 생성 및 캐싱

#### `lib/blackholeShader.ts`
- WebGL 컨텍스트 초기화 및 오버레이 Canvas 관리
- Fragment shader: UV → 극좌표 변환, 거리·시간 기반 나선형 왜곡
- `intensity` uniform으로 블랙홀 모드 강도 점진적 강화
- 매 프레임 `uniform` 업데이트 (시간, 구멍 위치, 강도)

#### `lib/winnerCheck.ts`
- **판정 로직:**
  1. **구슬 소진:** 잔여 구슬 = 0 → 최고점 플레이어 반환
  2. **조기 확정:** `1위 점수 > 2위 점수 + 잔여 구슬 수` → 즉시 반환
- 동점: 구슬 소진 시 공동 1위 가능

---

### Phase 5 — 게임 화면 (`app/game/page.tsx`)
게임 상태 관리: `playing → blackhole → finale → finished`

조기 확정 시:
- `WinnerBanner` 표시 (우측 하단 fade-in)
- 게임(구슬 발사·물리)은 계속 진행
- 설정 입력 영역이 화면 좌측 하단에 CSS fade-in으로 복귀 → 다음 게임 시작 가능

구슬 소진 시:
- `WinnerBanner` 표시
- 게임 종료

---

### Phase 6 — PachinkoBoard 컴포넌트

#### 캔버스 설정
- 가상 해상도: `BOARD_W = 1600`, `BOARD_H = 900`
- `canvas.width = 1600`, `canvas.height = 900`
- CSS: `transform: scale(scaleX, scaleY)` → 뷰포트 가득 채우도록 스케일링
- Matter.js 월드 좌표 = 1600×900 기준

#### 핀 배치 (기본맵)
- 핀 영역: y = 120 ~ 680 (1600×900 기준)
- 행 간격: (680 - 120) / 9 ≈ 62px
- 홀수 행: 6개, x 간격 = 1600 / 7 ≈ 229px
- 짝수 행: 7개, x 간격 = 1600 / 8 = 200px (홀수 행 대비 반칸 오프셋)
- 총 10행 (홀수 5행 × 6개 + 짝수 5행 × 7개 = 65핀)
- 렌더링: `ctx.shadowBlur = 12`, `ctx.shadowColor = '#8888ff'`로 glow

#### 대포
- 위치: (800, 60) — 가상 해상도 상단 중앙
- 좌우 스윙: ±40°, 주기 약 4초
- 발사 간격: **40ms** (1000개 × 40ms = 40초)
- 발사 방향: 캐논 각도 기준 벡터

#### 구슬 발사
- 총 1000개, 인원수 균등 분배 + 라운드로빈 셔플 혼합
- `BALL_RADIUS = 10` (1600×900 기준)
- 매 40ms 큐에서 꺼내 캐논 끝 위치에 spawn + velocity 적용

#### 물리 설정
- `engine.gravity.y = 1.5`
- 벽: 좌(x=0), 우(x=1600), 상단(y=0)
- 구슬 `restitution = 0.5`, `friction = 0.05`
- 보드 이탈(y > 950) 구슬은 즉시 월드에서 제거

---

### Phase 7 — Windmill 컴포넌트 (빙글빙글 물레방아 맵)
- 물레 1: (480, 450), 물레 2: (1120, 450) — 1600×900 기준
- 핀 제외 구역: y = 300 ~ 600 (물레 중앙 구역), 나머지 상하는 기본맵 동일 핀
- 날개: 길이 140px × 너비 16px, 4개 (90° 간격)
- 구현: `isStatic: true` 바디를 매 프레임 `Body.setPosition` + `Body.setAngle`로 수동 이동
- 회전 속도: 0.015 rad/frame (시계방향)
- 렌더링: `fillStyle = '#39FF14'`, `shadowBlur = 20`, `shadowColor = '#39FF14'`

---

### Phase 8 — BlackHole 컴포넌트
- **위치:** (800, 720) — 1600×900 기준
- **기본 반경:** 40px → 블랙홀 모드에서 최대 80px까지 확대
- **sensor body:** Matter.js `isSensor: true`
- **점수 집계:** 충돌 이벤트 → 해당 플레이어 점수 +1 → `winnerCheck` 호출 → PlayerList 업데이트

**블랙홀 모드 (잔여 ≤ 200개):**
- 구멍 반경 점진적 확대
- WebGL 쉐이더 오버레이 활성화 (intensity 0→1 점진적 증가)
- "BLACK HOLE MODE" 텍스트 오버레이
- 매 프레임 각 활성 구슬에 구멍 방향 인력 적용: `Body.applyForce`

**피날레 (잔여 ≤ 10개):**
- `engine.timing.timeScale = 0.25` (슬로우모션)
- Canvas transform으로 hole 중심 줌인 (scale 1.0 → 2.5, 약 1초에 걸쳐)

---

### Phase 9 — WinnerDisplay + 컨페티

#### WinnerDisplay 컴포넌트 (`components/game/WinnerDisplay.tsx`)
- **위치:** `position: fixed; bottom: 24px; right: 24px`
- **표시 방식:** 즉각 표시 (fade-in 없음)
- **레이아웃:**
  ```
  Winner
  플레이어A
  ```
  - "Winner": 흰색, 36px
  - 닉네임: 해당 플레이어 구슬 색상, 32px

#### 컨페티 (`components/game/Confetti.tsx`)
- **트리거:** 우승 확정 즉시
- **구현:** Canvas 또는 절대 위치 DOM div 배열
- **동작:**
  - 시작 위치: 화면 우측 하단
  - 방향: 좌측 상단을 향해 포물선 발사
  - 네모 박스 약 40개, 형형색색 (PLAYER_COLORS 팔레트 활용)
  - 크기: 8~16px 무작위 네모
  - 1~2초 간격으로 5회 반복 발사
  - 각 박스는 포물선 궤적 + 회전 애니메이션

#### 설정 UI 복귀
- **트리거:** 우승 확정 즉시
- **위치:** `position: fixed; bottom: 24px; left: 24px`
- **내용:** textarea + 드롭다운 + 시작 버튼 (설정 화면과 동일)
- **CSS:** `opacity: 0 → 1`, `transition: opacity 1s ease`

---

## 구현 순서 요약

| 순서 | 항목 |
|------|------|
| 1 | 에셋 배치 + 디렉터리 구조 |
| 2 | `lib/ballTint.ts` |
| 3 | `lib/winnerCheck.ts` |
| 4 | `components/PlayerList.tsx` |
| 5 | 설정 화면 (`app/page.tsx`) |
| 6 | PachinkoBoard — 캔버스 스케일링 + Matter.js 월드 + 핀 배치 |
| 7 | 대포 스윙 + 구슬 발사 (40ms 간격) |
| 8 | BlackHole sensor + 점수 집계 + winnerCheck 연동 |
| 9 | WinnerDisplay (즉시 표시) + 컨페티 + 설정 UI fade-in (1초) |
| 10 | 블랙홀 모드 (구멍 확대 + 인력) |
| 11 | `lib/blackholeShader.ts` + WebGL 오버레이 |
| 12 | 피날레 연출 (슬로우모션 + 줌인) |
| 13 | Windmill 컴포넌트 (빙글빙글 물레방아 맵) |
| 14 | 60fps 최적화 |
| 15 | (P1) 효과음 |

---

## 성능 고려사항
- 구슬은 구멍 진입 또는 y > 950 이탈 즉시 Matter.js 월드에서 제거
- 오프스크린 Canvas 캐싱으로 합성 비용 최소화
- WebGL 쉐이더 오버레이는 별도 Canvas에서 구동 (메인 Canvas와 분리)
- `requestAnimationFrame` + `Matter.Engine.update(engine, delta)` 수동 루프
