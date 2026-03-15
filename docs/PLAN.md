# 파칭코 뽑기 구현 플랜

## 기술 스택
- **프레임워크:** Next.js (App Router)
- **물리 엔진:** Matter.js
- **언어:** TypeScript
- **렌더링:** HTML Canvas (오프스크린 합성 포함) + WebGL (블랙홀 쉐이더)

---

## 단계별 구현 계획

### Phase 1 — 프로젝트 초기 설정
1. Next.js 프로젝트 생성 (`create-next-app`)
2. Matter.js 패키지 설치
3. `public/images/` 에 에셋 배치
   - `cannon.png`, `pin_128.png`, `pinball.png`, `hole.png`
4. 기본 디렉터리 구조 생성
   ```
   app/
     page.tsx                  ← 설정 화면 (닉네임 입력 + 맵 선택)
     game/
       page.tsx                ← 게임 화면
       result/
         page.tsx              ← 결과 화면
   components/
     game/
       PachinkoBoard.tsx       ← 기본맵 보드
       Windmill.tsx            ← 물레 컴포넌트 (빙글빙글 물레방아 맵)
       BlackHole.tsx
       Scoreboard.tsx
     result/
       WinnerDisplay.tsx
       RankingTable.tsx
   lib/
     ballTint.ts               ← 색상 팔레트 + Canvas 합성 유틸
     blackholeShader.ts        ← WebGL 블랙홀 쉐이더 유틸
   ```

---

### Phase 2 — 설정 화면 (`app/page.tsx`)
- **닉네임 입력:** 전체화면 레이아웃, 하단에 textarea + "시작" 버튼
- **파싱 로직:** 콤마(`,`) 구분, 공백 유지, 빈 값/중복 허용 안 함
- **유효성 검사:**
  - 빈 닉네임 불허
  - 중복 닉네임 불허
  - 2명 이상 30명 이하
  - 조건 충족 시 "시작" 버튼 활성화
- **플레이어 카드:** 파싱된 이름 수만큼 실시간 자동 생성/제거 (상단 영역)
- **맵 선택:** 게임 시작 전 아래 두 맵 중 선택
  - `기본맵` — 불규칙 핀 배치 표준 파칭코 보드
  - `빙글빙글 물레방아` — 물레 2개 배치, 물레 영역에 핀 없음
- **전환:** 시작 버튼 클릭 → 선택한 맵의 게임 화면으로 이동

---

### Phase 3 — 핵심 유틸리티

#### `lib/ballTint.ts`
- **색상 팔레트:** 30개 사전 정의 색상 배열
- **구슬 분배 계산:** 총 1000개 ÷ 참가 인원 수 (균등 분배, 나머지는 첫 번째 플레이어에게 배분)
- **Canvas 합성 함수:**
  - `pinball.png` 베이스 이미지 로드
  - `globalCompositeOperation: 'multiply'` 로 플레이어 색상 적용
  - 플레이어별 오프스크린 Canvas 이미지 생성 및 캐싱

#### `lib/blackholeShader.ts`
- WebGL 컨텍스트 초기화 및 오버레이 Canvas 관리
- **쉐이더 구현:** 블랙홀 흡인 왜곡 이펙트
  - Fragment shader로 UV 좌표를 구멍 중심 기준 극좌표로 변환
  - 거리·시간 기반 나선형 왜곡 적용
  - 블랙홀 모드 진입 강도(`intensity`) 파라미터로 점진적 강화
- 매 프레임 `uniform` 업데이트 (시간, 구멍 위치, 강도)

---

### Phase 4 — 게임 화면 (`app/game/page.tsx`)
게임 상태를 React로 관리: `setup → playing → blackhole → finale → result`

#### 4-1. PachinkoBoard 컴포넌트
- **Matter.js 월드 초기화:** 엔진, 렌더러, 러너 생성
- **경계:** 좌벽, 우벽, 상단 경계 (바닥 없음)
- **핀(페그) 배치:** `pin_128.png` 이미지, `paint.png` 스케치를 참고한 불규칙 산포 배치
- **대포 (`cannon.png`):**
  - 보드 상단 중앙 렌더링
  - 좌우 천천히 스윙 (각도 애니메이션)
  - 현재 각도 방향으로 구슬 순차 발사
- **구슬 발사 로직:**
  - 총 1000개, 인원수에 따라 균등 분배 (예: 10명 → 인당 100개)
  - 플레이어별 색상 구슬(오프스크린 합성) 혼합 발사

#### 4-2. Windmill 컴포넌트 (빙글빙글 물레방아 맵 전용)
- **배치:** 보드 중앙부에 물레 2개 배치 (물레 영역에는 핀 없음)
- **구현:** Matter.js 키네마틱 바디 (매 프레임 각도 수동 업데이트)
  - 물레 중심축 + 십자 날개 4개로 구성
  - 시계방향 일정 속도 회전
  - 구슬과 날개 충돌 시 물리 반발 적용
- **렌더링:** Canvas에 회전 변환 적용하여 날개 이미지 드로우

#### 4-3. BlackHole 컴포넌트
- **위치:** 보드 하단 약 70~80% 지점 중앙
- **구현:** Matter.js sensor body
- **점수 집계:** 구슬이 sensor에 진입하면 투명 처리 후 해당 플레이어 점수 +1

- **블랙홀 모드 (잔여 구슬 ≤ 200개):**
  - 구멍 크기 점점 확대 애니메이션
  - `blackholeShader.ts` WebGL 쉐이더로 흡인 왜곡 이펙트 오버레이 (회오리 애니메이션 없음)
  - 화면 전체에 "BLACK HOLE MODE" 텍스트 표시
  - Matter.js 중력 방향을 구멍 쪽으로 전환 → 남은 구슬 흡인

- **피날레 연출 (잔여 구슬 ≤ 10개):**
  - Matter.js 엔진 `timeScale`을 0.2~0.3으로 낮춰 슬로우모션 적용
  - Canvas 변환(scale + translate)으로 hole 위치로 카메라 줌인
  - 마지막 구슬 소진 시 결과 화면 전환

#### 4-4. Scoreboard (HUD) 컴포넌트
- 화면 측면 고정
- 플레이어별 현재 점수, 잔여 구슬 수 실시간 표시

---

### Phase 5 — 결과 화면 (`app/game/result/page.tsx`)
- **WinnerDisplay:** 1위 닉네임을 초대형 폰트로 중앙 표시 + 컨페티 애니메이션
- **RankingTable:** 1위~최하위 전체 순위, 플레이어별 구슬 획득 수 표시
  - 동점자 → 공동 순위 처리
- **다시하기 버튼:** 설정 화면(`/`)으로 복귀

---

## 구현 순서 요약

| 순서 | 항목 |
|------|------|
| 1 | 프로젝트 초기 설정 + 에셋 배치 |
| 2 | 설정 화면 (닉네임 입력 + 맵 선택 + 유효성 검사) |
| 3 | `lib/ballTint.ts` — 1000개 분배 + 색상 팔레트 + Canvas 합성 유틸 |
| 4 | PachinkoBoard — Matter.js 월드 + 핀 배치 |
| 5 | 대포 스윙 + 구슬 발사 로직 (1000개 균등 분배) |
| 6 | BlackHole sensor + 점수 집계 |
| 7 | Scoreboard HUD 실시간 업데이트 |
| 8 | 블랙홀 모드 (잔여 200개 이하 · 구멍 확대 · 흡인력) |
| 9 | `lib/blackholeShader.ts` — WebGL 쉐이더 흡인 이펙트 |
| 10 | 피날레 연출 (잔여 10개 · 슬로우모션 · 줌인) |
| 11 | Windmill 컴포넌트 (빙글빙글 물레방아 맵) |
| 12 | 결과 화면 (WinnerDisplay + RankingTable) |
| 13 | 60fps 성능 최적화 |
| 14 | (P1) 구슬 발사 순차 딜레이 |
| 15 | (P2) 배경음악 + 효과음 |

---

## 성능 고려사항
- 총 1000개 구슬 동시 시뮬레이션 시 60fps 유지 목표
- Matter.js 바디 수 최적화 (구멍에 들어간/보드 이탈 구슬 즉시 제거)
- 오프스크린 Canvas 캐싱으로 합성 비용 최소화
- WebGL 쉐이더는 별도 오버레이 Canvas에서 구동 (메인 Canvas와 분리)
- 데스크탑 Chrome 최신 버전 기준 최적화
