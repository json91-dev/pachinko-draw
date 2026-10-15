import type { Metadata } from "next";
import "./globals.css";
import SeoContent from "@/components/SeoContent";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const TITLE = `${SITE_NAME} - 랜덤 추첨 · 벌칙 · 당번 뽑기 게임`;

export const metadata: Metadata = {
  metadataBase: new URL(`${SITE_URL}/`),
  title: TITLE,
  description: SITE_DESCRIPTION,
  keywords: ["파칭코 뽑기", "랜덤 추첨", "벌칙 정하기", "당번 뽑기", "점심 메뉴 정하기", "뽑기 게임", "사다리타기 대체"],
  alternates: { canonical: "./" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "./",
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "og.png", width: 1200, height: 630, alt: `${SITE_NAME} 게임 화면` }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: ["og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <SeoContent />
        {children}
      </body>
    </html>
  );
}
