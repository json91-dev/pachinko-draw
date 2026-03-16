import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "파칭코 뽑기",
  description: "파칭코 방식의 뽑기 게임",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
