export const BYTE_VOCABULARY_SIZE = 259;
export const PAD = 256;
export const BOS = 257;
export const EOS = 258;

/** Byte-exact for valid Unicode text. Invalid generated UTF-8 decodes as U+FFFD. */
export class ByteTokenizer {
  readonly id = "utf8-bytes-v1";
  encode(text: string, boundaries = false): Int32Array {
    const bytes = new TextEncoder().encode(text);
    return Int32Array.from(boundaries ? [BOS, ...bytes, EOS] : bytes);
  }
  decode(tokens: Iterable<number>): string {
    const bytes: number[] = [];
    for (const token of tokens) {
      if (!Number.isInteger(token) || token < 0 || token >= BYTE_VOCABULARY_SIZE) throw new Error("Invalid byte token ID.");
      if (token < 256) bytes.push(token);
    }
    return new TextDecoder("utf-8", { ignoreBOM: true }).decode(Uint8Array.from(bytes));
  }
}
