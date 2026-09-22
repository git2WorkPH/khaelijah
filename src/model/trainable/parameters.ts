export interface Parameter {
  readonly name: string;
  readonly shape: readonly number[];
  readonly values: Float64Array;
  readonly gradients: Float64Array;
}

/** Mulberry32 with an explicit unsigned 32-bit state, including zero. */
export class SeededRandom {
  constructor(public state: number) { this.restore(state); }
  restore(state: number): void {
    if (!Number.isInteger(state) || state < 0 || state > 0xffffffff) throw new Error("Invalid PRNG state.");
    this.state = state;
  }
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
}

export class ParameterRegistry {
  private readonly entries = new Map<string, Parameter>();
  constructor(readonly random: SeededRandom) {}
  create(name: string, shape: readonly number[], initialization: "weight" | "zero" | "one" = "weight"): Parameter {
    if (!name.trim() || this.entries.has(name)) throw new Error("Empty or duplicate parameter name.");
    const size = shape.reduce((product, dimension) => product * dimension, 1);
    if (!shape.length || shape.some((dimension) => !Number.isSafeInteger(dimension) || dimension < 1) || !Number.isSafeInteger(size) || size > 10_000_000) throw new Error("Invalid or oversized parameter shape.");
    const values = new Float64Array(size);
    // Uniform [-sqrt(3/fanIn), sqrt(3/fanIn)] gives variance 1/fanIn.
    const bound = Math.sqrt(3 / shape[0]!);
    for (let i = 0; i < size; i++) values[i] = initialization === "zero" ? 0 : initialization === "one" ? 1 : (2 * this.random.next() - 1) * bound;
    const parameter = { name, shape: Object.freeze([...shape]), values, gradients: new Float64Array(size) };
    this.entries.set(name, parameter);
    return parameter;
  }
  parameters(): readonly Parameter[] { return [...this.entries.values()]; }
  get count(): number { return this.parameters().reduce((sum, parameter) => sum + parameter.values.length, 0); }
  zeroGrad(): void { for (const parameter of this.entries.values()) parameter.gradients.fill(0); }
  accumulate(name: string, gradient: Float64Array): void {
    const parameter = this.entries.get(name);
    if (!parameter || gradient.length !== parameter.values.length || !gradient.every(Number.isFinite)) throw new Error("Invalid parameter gradient.");
    const next = gradient.map((value, index) => value + parameter.gradients[index]!);
    if (!next.every(Number.isFinite)) throw new Error("Gradient accumulation overflow.");
    parameter.gradients.set(next);
  }
}
