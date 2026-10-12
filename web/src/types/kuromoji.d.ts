declare module "kuromoji" {
  export function builder(options: { dicPath: string }): {
    build: (cb: (err: Error | null, tokenizer: unknown) => void) => void;
  };
}
