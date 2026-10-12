import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Học từ vựng JLPT N3 — Mimi kara Oboeru (Goi)",
  description:
    "880 từ vựng tiếng Nhật N3 (Mimi kara Oboeru Goi) kèm ví dụ, thẻ ghi nhớ, luyện tập và đồng bộ tiến độ.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
