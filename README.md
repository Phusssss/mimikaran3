# Mimi kara Oboeru N3 — Web học tiếng Nhật (Từ vựng + Ngữ pháp)

App học tiếng Nhật JLPT N3 xây từ 2 sách scan: 「耳から覚える語彙トレーニングN3」
(880 từ) và 「耳から覚える文法トレーニングN3」(110 mẫu ngữ pháp).

**Next.js (App Router) + TypeScript**, không cần backend riêng.

## Luồng học mỗi ngày (44 ngày, 20 từ/ngày — chỉnh được)
1. **Ôn tập cũ** — quiz ngẫu nhiên từ vựng các ngày trước
2. **Từ vựng mới** — danh sách / thẻ ghi nhớ / bài tập / **4 mini game**
   (Ghép từ, Trí nhớ, Sắp xếp câu, Thử tốc độ) — chọn được chiều học
   (kanji→nghĩa, kana→kanji, nghe→kanji…)
3. **Ngữ pháp** — mẫu câu của ngày: 接続, cách dùng, ví dụ furigana + audio
4. **Luyện tập** — Đề JLPT 11 câu (問題1-4 + 文法 + 読解 2 bài đọc) do AI soạn
   riêng, giải thích từng câu bằng tiếng Việt, chỉ dùng từ đã học trong bài đọc

Khác: furigana tự động (kuromoji), đọc tiếng Nhật (Web Speech API),
luyện đề 740 câu của sách, 22 chuyên mục コラム, tìm kiếm tức thì,
tiến độ lưu localStorage + **đồng bộ Firebase Firestore** (tuỳ chọn).

## Chạy app

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Cấu hình tuỳ chọn trong `web/.env.local` (xem `web/.env.example` + hướng dẫn
Firebase trong `web/README.md`): Firebase (đồng bộ tiến độ), Gemini/Groq API
key (đề AI). Không cấu hình gì app vẫn chạy đầy đủ (đề AI dùng Groq mặc định
khi có key; không có thì dùng đề cơ bản sinh trên máy).

## Cấu trúc

```
web/                app Next.js
  src/data/book.json   dữ liệu tổng hợp (880 từ + 110 ngữ pháp + 22 コラム + 98 đề)
  src/lib/             quiz, jlptQuiz, aiQuiz (đa provider), furigana, speech, progress
  src/components/      UI + games/
  public/dict/         từ điển kuromoji (furigana)
merge.py           script gộp dữ liệu trích xuất từ bản scan (chạy cục bộ)
```

Bản scan sách không nằm trong repo (bản quyền + dung lượng); file
`book.json` đã chứa toàn bộ nội dung học nên app chạy không cần scan.
