"use client";

import type { BookColumn } from "@/lib/types";
import { speak } from "@/lib/speech";

export default function ColumnsView({ columns }: { columns: BookColumn[] }) {
  if (!columns.length)
    return <div className="empty">Chưa có dữ liệu chuyên mục.</div>;
  return (
    <>
      <div className="view-sub">Bấm "Nghe" để đọc từ — các bảng theo đúng thứ tự trong sách</div>
      {columns.map((c, k) => (
        <ColumnCard key={k} col={c} />
      ))}
    </>
  );
}

function ColumnCard({ col }: { col: BookColumn }) {
  const isNew = Array.isArray(col.groups) && col.groups.length > 0;
  return (
    <div className="column-card">
      <h3>
        {col.no ? `コラム ${col.no} · ` : ""}
        {col.title}
        {col.book_page ? (
          <small style={{ color: "var(--muted)", fontWeight: 400 }}>
            {" "}
            · sách tr.{col.book_page}
          </small>
        ) : null}
      </h3>

      {isNew ? (
        (col.groups || []).map((g, gi) => (
          <div key={gi} className="col-group">
            {g.group && <div className="col-group-title">{g.group}</div>}
            <table>
              <thead>
                <tr>
                  <th>Từ</th>
                  <th>Đọc</th>
                  <th>Tiếng Việt</th>
                  <th>EN</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r, ri) => (
                  <tr key={ri}>
                    <td>
                      <button
                        className="btn-speak small"
                        title="Đọc từ này"
                        onClick={() => speak(r.word)}
                      >
                        Nghe
                      </button>{" "}
                      <b>{r.word}</b>
                      {r.note && <div className="col-note">{r.note}</div>}
                    </td>
                    <td>{r.kana || ""}</td>
                    <td>{r.vi || ""}</td>
                    <td className="col-en">{r.en || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        // format cũ (fallback)
        <table>
          <thead>
            <tr>
              <th>Từ</th>
              <th>Cách đọc</th>
              <th>Nghĩa</th>
              <th>Tiếng Việt</th>
            </tr>
          </thead>
          <tbody>
            {(col.items || []).map((it, j) => (
              <tr key={j}>
                <td>{it[0]}</td>
                <td>{it[1] || ""}</td>
                <td>{it[2] || ""}</td>
                <td>{it[3] || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
