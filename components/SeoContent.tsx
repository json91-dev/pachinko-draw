import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

const FAQ = [
  {
    q: '몇 명까지 추첨할 수 있나요?',
    a: '이름을 콤마로 구분해 2명부터 30명까지 입력할 수 있어요.',
  },
  {
    q: '결과는 공정한가요?',
    a: '총 1000개의 구슬을 참가자 수로 균등하게 나눠 대포에서 발사하고, 물리 엔진으로 핀에 부딪히며 떨어져요. 결과는 매번 달라져요.',
  },
  {
    q: '어떤 맵이 있나요?',
    a: '빙글빙글 물레방아와 바운스 깔때기 맵이 있고, 맵에 따라 구슬의 움직임이 달라져요.',
  },
  {
    q: '무료인가요? 설치가 필요한가요?',
    a: '완전 무료이고 설치 없이 PC와 모바일 브라우저에서 바로 쓸 수 있어요.',
  },
];

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    description: SITE_DESCRIPTION,
    inLanguage: 'ko',
    applicationCategory: 'GameApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  },
];

// 게임 화면은 전체 화면 canvas라 텍스트가 없어, 크롤러와 스크린리더용 소개 콘텐츠를 시각적으로만 숨겨 둔다.
export default function SeoContent() {
  return (
    <>
      <section className="sr-only">
        <h1>파칭코 뽑기 - 랜덤 추첨 게임</h1>
        <p>{SITE_DESCRIPTION}</p>
        <h2>사용 방법</h2>
        <ol>
          <li>참가자 이름을 콤마로 구분해 입력해요. (2~30명)</li>
          <li>맵을 고르고 시작 버튼을 눌러요.</li>
          <li>각자의 색 구슬이 핀 사이로 떨어지고, 바닥의 구멍에 구슬을 가장 많이 넣은 사람이 당첨돼요.</li>
        </ol>
        <h2>이럴 때 쓰세요</h2>
        <ul>
          <li>벌칙자 정하기</li>
          <li>청소 당번, 발표 순서 뽑기</li>
          <li>점심 메뉴, 커피 내기 정하기</li>
        </ul>
        <h2>자주 묻는 질문</h2>
        {FAQ.map(({ q, a }) => (
          <div key={q}>
            <h3>{q}</h3>
            <p>{a}</p>
          </div>
        ))}
      </section>
      {jsonLd.map((data, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
      ))}
    </>
  );
}
