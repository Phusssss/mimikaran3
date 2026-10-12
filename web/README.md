# Học từ vựng JLPT N3 — Mimi kara Oboeru (Goi)

App học từ vựng tiếng Nhật N3 (880 từ) được trích xuất từ sách
「耳から覚える語彙N3」, dựng bằng **Next.js (App Router) + TypeScript**.

## Tính năng

- **Lộ trình học hằng ngày** — 880 từ + 110 mẫu ngữ pháp chia thành 44 ngày
  (20 từ/ngày, chỉnh được 10/15/20/25/30). Mỗi ngày là một bài học 4 giai
  đoạn (stepper đánh số):
  1. **Ôn tập cũ** — 10 câu ngẫu nhiên từ vựng các ngày trước
  2. **Từ vựng mới** — Danh sách ⇄ Thẻ ghi nhớ, nút Nghe, furigana, đánh dấu
     đã thuộc
  3. **Ngữ pháp** — 2–3 mẫu câu N3 của ngày (từ sách Bunpou): nghĩa, 接続,
     cách dùng, ví dụ furigana + Nghe
  4. **Luyện tập** — Đề JLPT 11 câu: 問題1 đọc kanji ×2, 問題2 viết kanji ×2,
     問題3 ngữ cảnh, 問題4 diễn đạt lại, **文法 ×2** (chọn mẫu + sắp xếp ⭐),
     読解 3 câu / 2 bài đọc chỉ dùng từ đã học. AI soạn, đạt ≥70% tính hoàn
     thành ngày.
- **Bài tập ngày (riêng)** — ~19 câu 6 dạng (nghĩa của từ, chọn từ theo nghĩa,
  cách đọc, nghe và chọn, điền câu ví dụ, nối cặp). 2 nguồn đề:
  - **Đề AI**: Groq (miễn phí — console.groq.com), OpenRouter (`:free`), Z.ai,
    Gemini, hoặc base URL tuỳ chỉnh — dán key ngay trong phần Bài tập (key chỉ
    lưu trên máy). Lỗi mọi mức tự quay về đề cơ bản.
  - **Đề cơ bản**: sinh nhanh ngay trên máy, không cần mạng.
- **Cài đặt đề tuỳ chọn** — trong Ôn tập/Bài tập ngày (đề cơ bản): bật/tắt
  từng dạng câu theo chiều luyện tập: kanji→nghĩa, nghĩa→kanji, kanji→kana,
  **kana→kanji**, nghe→từ, điền câu ví dụ, nối cặp; cộng toggle **Xáo trộn
  thứ tự câu**. Đề JLPT có riêng toggle xáo trộn: các câu trắc nghiệm (kể cả
  文法) bị trộn ngẫu nhiên thay vì theo thứ tự 問題 cứng.
- **Giải thích từng câu** — hộp "Giải thích" sau khi trả lời: vì sao đúng,
  từng phương án sai sai ở đâu, bài đọc trích dẫn bằng chứng. AI hay viết
  giải thích tiếng Nhật → app tự phát hiện (tỷ lệ kana/chữ Hán) và dịch sang
  tiếng Việt. Vị trí đáp án được xáo trộn ngẫu nhiên.
- **Cài đặt giọng đọc** — chọn giọng ja trên máy, chỉnh tốc độ, nút thử giọng.
  TTS khởi động trước + giữ ấm kết nối (âm vô thanh định kỳ + prewarm khi
  hover) để bấm "Nghe" là nói ngay (~300ms). Giọng local phản hồi tức thì
  nhất; giọng "Natural/Online" hay hơn nhưng trễ hơn.
- **Furigana tự động** — kanji trong câu ví dụ được gắn cách đọc (ruby) bằng
  kuromoji (dictionary ~17MB load lười từ `/dict`, bật/tắt bằng nút
  "Furigana" trên đầu trang).
- **Danh sách từ** — duyệt theo 12 Unit + 3 phần まとめ, tìm kiếm tức thì.
- **Chuyên mục (コラム)** — các bảng từ vựng chuyên đề trong sách.
- **Luyện đề (練習問題)** — 98 đề/740 câu của sách, chọn đáp án kiểm tra ngay.
- **Tiến độ** — từ đã thuộc, điểm từng ngày, lưu localStorage; **tự đồng bộ
  Firestore** nếu cấu hình Firebase (union-merge nhiều thiết bị).

## Chạy app

```bash
cd web
npm install
npm run dev        # mở http://localhost:3000
```

Build production:

```bash
npm run build
npm start
```

## Bật đồng bộ Firebase (tuỳ chọn)

App chạy đủ 100% mà không cần Firebase (chỉ lưu trên máy). Muốn đồng bộ tiến
độ giữa các thiết bị:

1. Tạo project miễn phí tại <https://console.firebase.google.com> (Add project).
2. Tạo app **Web** (icon `</>`) → copy cấu hình SDK.
3. Bật **Authentication → Sign-in method → Anonymous → Enable**.
4. Tạo **Firestore Database** (Build → Firestore Database → Create, chế độ
   production là được).
5. Chép `.env.example` thành `.env.local` và điền config:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

6. Rules cho Firestore (chỉ anonymous user tự đọc/ghi tiến độ của mình):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/progress/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

7. Restart `npm run dev` — chip trên đầu trang chuyển thành "☁ Đã đồng bộ".

Dữ liệu lưu tại `users/{uid}/progress/main` gồm `{ learned: {…}, quizBest,
updatedAt }` — tiến độ được **union-merge** giữa máy và cloud nên không mất
dữ liệu khi bật thêm thiết bị mới.

## Cấu trúc dữ liệu

`src/data/book.json` (sinh tự động từ bản scan sách bởi `../merge.py`):

```
{ source, units: [{id, label, title, range:[a,b]}], words: [{no, kanji, kana,
  en, kr, vi, senses[], examples:[{ja, vi}], related:[{type, text}], unit}],
  columns: [{title, book_page, items}], exercises: [{type, range, book_page,
  questions}] }
```

## Ghi chú

- Bản scan gốc: `Mimi_Kara_Oboeru_N3-Goi.pdf` (236 trang).
- Bản web tĩnh không cần build (backup): thư mục `../site/` — mở `index.html`.
- Một số câu ví dụ/đề luyện tập ở trang scan mờ được khôi phục "best-effort",
  các vị trí không chắc chắn được ghi chú trong trường `notes` của JSON.
