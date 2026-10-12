# Gộp toàn bộ extract_NN.json thành site/data.js
import json, glob, os, re, sys

BASE = r"D:\TEMP\apphoctiengnhat"

# Map word number -> unit (theo mục lục sách)
UNIT_RANGES = [
    ("u01", "Unit 01", "名詞 A — Danh từ A", 1, 120),
    ("u02", "Unit 02", "動詞 A — Động từ A", 121, 220),
    ("m01", "まとめ 1", "連用名詞 — Danh từ liên động từ", 221, 258),
    ("u03", "Unit 03", "形容詞 A — Tính từ A", 259, 298),
    ("m02", "まとめ 2", "形容詞＋まる/める", 299, 310),
    ("u04", "Unit 04", "名詞 B — Danh từ B", 311, 410),
    ("u05", "Unit 05", "動詞 B — Động từ B", 411, 510),
    ("u06", "Unit 06", "カタカナ A — Từ mượn A", 511, 550),
    ("u07", "Unit 07", "形容詞 B — Tính từ B", 551, 590),
    ("u08", "Unit 08", "副詞 A — Trạng từ A", 591, 635),
    ("u09", "Unit 09", "名詞 C — Danh từ C", 636, 715),
    ("u10", "Unit 10", "動詞 C — Động từ C", 716, 795),
    ("u11", "Unit 11", "カタカナ B — Từ mượn B", 796, 835),
    ("m03", "まとめ 3", "料理の動詞 — Động từ nấu ăn", 836, 845),
    ("u12", "Unit 12", "副詞 B・連体詞・接続詞 — Trạng từ B, định ngữ, liên từ", 846, 880),
]

def unit_of(no):
    if no is None:
        return None
    for uid, label, title, a, b in UNIT_RANGES:
        if a <= no <= b:
            return uid
    return None

def norm_related(r):
    """Chuẩn hóa mọi biến thể symbol-box về {type, text}."""
    if isinstance(r, str):
        return {"type": "関", "text": r}
    if not isinstance(r, dict):
        return {"type": "関", "text": str(r)}
    t = r.get("type") or r.get("symbol") or "関"
    body = r.get("text") or r.get("word") or r.get("pattern") or r.get("ja") or ""
    extra = []
    if r.get("vi"):
        extra.append(r["vi"])
    if r.get("note"):
        extra.append(r["note"])
    text = str(body).strip()
    if extra:
        text = (text + " — " + " — ".join(str(x) for x in extra)).strip(" —")
    return {"type": str(t), "text": text}

def norm_sense(s):
    """Chuẩn hóa sense về chuỗi dễ đọc."""
    if isinstance(s, str):
        return s
    if isinstance(s, dict):
        head = s.get("label") or s.get("en") or ""
        no = s.get("no")
        prefix = f"{no}. " if no is not None else ""
        out = prefix + str(head)
        if s.get("vi") and s["vi"] != head:
            out += f" ({s['vi']})"
        if s.get("text"):
            out += f" — {s['text']}"
        return out
    return str(s)

def norm_word(w):
    """Chuẩn hóa 1 entry từ vựng về schema chung của app."""
    out = dict(w)
    if not out.get("kanji"):
        out["kanji"] = out.get("kana") or ""
    # examples: {jp,...} -> {ja,...}
    exs = []
    for e in out.get("examples") or []:
        if isinstance(e, dict):
            exs.append({"ja": e.get("ja") or e.get("jp") or "", "vi": e.get("vi") or ""})
        elif isinstance(e, str):
            exs.append({"ja": e, "vi": ""})
    out["examples"] = exs
    out["related"] = [norm_related(r) for r in out.get("related") or []]
    out["senses"] = [s for s in (norm_sense(x) for x in out.get("senses") or []) if s]
    # notes: str | list | None -> str
    notes = out.pop("notes", None)
    parts = []
    if isinstance(notes, list):
        parts += [str(x) for x in notes if x]
    elif notes:
        parts.append(str(notes))
    if out.pop("note", None):
        parts.append(str(out.get("note")))
    if out.get("cn"):
        parts.append("CN: " + str(out.pop("cn")))
    out["notes"] = "; ".join(parts)
    out.pop("pos", None)  # giữ pos riêng nếu cần, app không dùng trực tiếp
    return out

def norm_question(q, bank=None):
    if not isinstance(q, dict):
        return None
    text = q.get("text") or q.get("ja") or q.get("question") or q.get("sentence") or ""
    options = q.get("options") or q.get("choices") or q.get("opts") or None
    if not options and isinstance(bank, list) and bank:
        options = bank
    answer = q.get("answer") or q.get("correct") or None
    out = {"no": q.get("no"), "text": str(text).strip(), "answer": answer}
    if options:
        out["options"] = [str(o) for o in options]
    return out if out["text"] else None

def norm_exercise(e):
    """Chuẩn hóa mọi biến thể 練習問題 về {type, range, book_page, questions}."""
    if not isinstance(e, dict):
        return None
    book_page = e.get("book_page") or (e.get("page") if isinstance(e.get("page"), int) else None)
    out = []
    if isinstance(e.get("sections"), list):
        title = e.get("title") or e.get("exercise_title") or e.get("unit") or ""
        unit = e.get("unit") or ""
        for sec in e["sections"]:
            if not isinstance(sec, dict):
                continue
            label = sec.get("label") or ""
            bank = sec.get("box") if isinstance(sec.get("box"), list) else (sec.get("word_box") if isinstance(sec.get("word_box"), list) else None)
            qs = []
            for q in sec.get("questions") or []:
                nq = norm_question(q, bank)
                if nq:
                    qs.append(nq)
            if not qs:
                continue
            out.append({
                "type": f"{unit} {title} — {label}".strip(" —"),
                "range": str(e.get("range") or e.get("word_range") or ""),
                "book_page": book_page,
                "instruction": sec.get("instruction_vi") or sec.get("instruction") or "",
                "questions": qs,
            })
        return out or None
    qs = []
    for q in e.get("questions") or []:
        nq = norm_question(q)
        if nq:
            qs.append(nq)
    if not qs:
        return None
    return [{
        "type": str(e.get("type") or e.get("title") or ""),
        "range": str(e.get("range") or ""),
        "book_page": book_page,
        "instruction": e.get("instruction_vi") or e.get("instruction") or "",
        "questions": qs,
    }]

files = sorted(glob.glob(os.path.join(BASE, "data", "extract_*.json")))
print("Files:", [os.path.basename(f) for f in files])

words, columns, exercises = {}, [], []
for f in files:
    with open(f, encoding="utf-8") as fh:
        d = json.load(fh)
    for w in d.get("words", []):
        w = norm_word(w)
        no = w.get("no")
        key = no if no is not None else f"null_{len(words)}_{w.get('kanji','')}"
        if key in words:
            print(f"  WARN duplicate word no {key} in {os.path.basename(f)}")
        w["unit"] = unit_of(no) or w.get("unit") or "misc"
        words[key] = w
    for c in d.get("columns", []):
        columns.append(c)
    for e in d.get("exercises", []):
        normed = norm_exercise(e)
        if normed:
            exercises.extend(normed)

all_words = sorted(words.values(), key=lambda w: (w.get("no") is None, w.get("no") or 0))

# Ưu tiên columns tái trích xuất chuẩn hóa (columns_a/b.json) thay vì bản rời rạc trong extract
col_files = sorted(glob.glob(os.path.join(BASE, "data", "columns_*.json")))
if col_files:
    columns = []
    for cf in col_files:
        with open(cf, encoding="utf-8") as fh:
            cd = json.load(fh)
        columns.extend(cd.get("columns", []))
    columns.sort(key=lambda c: c.get("no") or 999)
    n_rows = sum(len(g.get("rows", [])) for c in columns for g in c.get("groups", []))
    print(f"Columns (chuẩn hóa mới): {len(columns)} cột, {n_rows} dòng")
nums = sorted(w["no"] for w in all_words if w.get("no") is not None)
missing = [n for n in range(1, 881) if n not in set(nums)]
dupes = len(nums) - len(set(nums))

print(f"Words: {len(all_words)} (numbered {len(nums)})")
print(f"Duplicates: {dupes}")
print(f"Missing numbers 1-880: {missing if missing else 'NONE'}")
print(f"Columns: {len(columns)}, Exercise sections: {len(exercises)}")

units = [{"id": uid, "label": label, "title": title, "range": [a, b]} for uid, label, title, a, b in UNIT_RANGES]

# ---- Ngữ pháp từ grammar_*.json (sách Bunpou N3, 110 mẫu) ----
gfiles = sorted(glob.glob(os.path.join(BASE, "data", "grammar_*.json")))
grammar = []
seen_g = set()
for gf in gfiles:
    with open(gf, encoding="utf-8") as fh:
        gd = json.load(fh)
    for pt in gd.get("points", []):
        no = pt.get("no")
        if no is not None:
            if no in seen_g:
                print(f"  WARN duplicate grammar no {no} in {os.path.basename(gf)}")
                continue
            seen_g.add(no)
        grammar.append(pt)
grammar.sort(key=lambda p: (p.get("no") is None, p.get("no") or 99999))
print(f"Grammar: {len(grammar)} mẫu ({len([p for p in grammar if p.get('no') is not None])} đánh số)")

data = {
    "source": "Mimi kara Oboeru N3 — Goi (耳から覚える語彙N3) + Bunpou (文法N3)",
    "units": units,
    "words": all_words,
    "columns": columns,
    "exercises": exercises,
    "grammar": grammar,
}

out = os.path.join(BASE, "site", "data.js")
with open(out, "w", encoding="utf-8") as fh:
    fh.write("const BOOK_DATA = ")
    json.dump(data, fh, ensure_ascii=False, indent=1)
    fh.write(";\n")
print("Wrote", out, f"({os.path.getsize(out)/1e6:.2f} MB)")

out2 = os.path.join(BASE, "web", "src", "data", "book.json")
with open(out2, "w", encoding="utf-8") as fh:
    json.dump(data, fh, ensure_ascii=False, indent=1)
print("Wrote", out2, f"({os.path.getsize(out2)/1e6:.2f} MB)")

# Xuất danh sách thiếu để xử lý tiếp
if missing:
    with open(os.path.join(BASE, "data", "_missing.json"), "w") as fh:
        json.dump(missing, fh)
    print("Saved missing list -> data/_missing.json")
