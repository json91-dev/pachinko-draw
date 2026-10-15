const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// 커스텀 도메인을 연결하면 ORIGIN만 바꾸고 workflow의 NEXT_PUBLIC_BASE_PATH를 제거한다.
export const SITE_ORIGIN = 'https://json91-dev.github.io';
export const SITE_URL = `${SITE_ORIGIN}${BASE_PATH}`;
export const SITE_NAME = '파칭코 뽑기';
export const SITE_DESCRIPTION =
  '이름을 입력하고 구슬을 떨어뜨려 당첨자를 뽑는 파칭코 방식의 랜덤 추첨 게임. 벌칙, 당번, 점심 메뉴 정하기를 무료로 즐겨보세요.';
