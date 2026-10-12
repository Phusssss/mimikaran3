// Furigana tự động cho câu ví dụ: tokenize bằng kuromoji,
// sinh chuỗi HTML với <ruby> trên các phần chứa kanji.
// Dictionary (~17MB) được load lười từ /dict, cache trong module.

type KuromojiToken = {
  surface_form: string;
  reading?: string;
  base_form?: string;
  pos?: string;
};

type Tokenizer = { tokenize: (text: string) => KuromojiToken[] };

let tokenizerPromise: Promise<Tokenizer> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type KuromojiBuilder = any;

async function getTokenizer(): Promise<Tokenizer> {
  if (tokenizerPromise) return tokenizerPromise;
  tokenizerPromise = (async () => {
    const kuromoji: { builder: KuromojiBuilder } = await import("kuromoji");
    return new Promise<Tokenizer>((resolve, reject) => {
      kuromoji
        .builder({ dicPath: "/dict" })
        .build((err: Error | null, tokenizer: Tokenizer) => {
          if (err) {
            tokenizerPromise = null; // cho phép thử lại
            reject(err);
          } else {
            resolve(tokenizer);
          }
        });
    });
  })();
  return tokenizerPromise;
}

const KANJI_RE = /[\u4e00-\u9faf\u3400-\u4dbf々〆ゝゞ]/;

function katakanaToHiragana(s: string): string {
  return s.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

/** Tokenize 1 câu và trả về các đoạn {surface, reading?}. */
export type FuriganaSegment = { surface: string; reading: string | null };

export async function segmentsFor(text: string): Promise<FuriganaSegment[]> {
  const tokenizer = await getTokenizer();
  return tokenizer.tokenize(text).map((t) => {
    const surface = t.surface_form ?? "";
    let reading = t.reading ?? null;
    if (reading === "*" || reading === undefined) reading = null;
    if (reading && !KANJI_RE.test(surface)) reading = null; // chỉ cần ruby khi có kanji
    if (reading) reading = katakanaToHiragana(reading);
    // nếu surface không có ký tự cần ruby (toàn kana/latin) thì bỏ
    if (reading && surface.length === reading.length && surface === reading) reading = null;
    return { surface, reading };
  });
}

export { KANJI_RE };
