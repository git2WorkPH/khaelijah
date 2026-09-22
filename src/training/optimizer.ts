import type { Parameter } from "../model/trainable/parameters.js";
export interface AdamOptions { learningRate: number; beta1: number; beta2: number; epsilon: number; weightDecay: number; clipNorm: number; }
export const DEFAULT_ADAM: AdamOptions = { learningRate: 1e-3, beta1: 0.9, beta2: 0.999, epsilon: 1e-8, weightDecay: 0.01, clipNorm: 1 };
export class AdamW {
  step = 0;
  readonly moments: { first: Float64Array; second: Float64Array }[];
  readonly options: AdamOptions;
  constructor(readonly parameters: readonly Parameter[], options: AdamOptions = DEFAULT_ADAM) {
    if (!Object.values(options).every(Number.isFinite) || options.learningRate <= 0 || options.epsilon <= 0 || options.clipNorm <= 0 || options.weightDecay < 0 || options.beta1 < 0 || options.beta1 >= 1 || options.beta2 < 0 || options.beta2 >= 1) throw new Error("Invalid optimizer options.");
    this.options = { ...options };
    this.moments = parameters.map((p) => ({ first: new Float64Array(p.values.length), second: new Float64Array(p.values.length) }));
  }
  update(): number {
    let norm = 0;
    for (const p of this.parameters) for (const g of p.gradients) { if (!Number.isFinite(g)) throw new Error("Non-finite gradient."); norm = Math.hypot(norm, g); }
    if (!Number.isFinite(norm)) throw new Error("Gradient norm overflow.");
    const o = this.options, clip = Math.min(1, o.clipNorm / Math.max(norm, 1e-30)), nextStep = this.step + 1;
    const updates = this.parameters.map((p, index) => {
      const first = this.moments[index]!.first.slice(), second = this.moments[index]!.second.slice(), values = p.values.slice();
      const decay = p.name.endsWith(".bias") || p.name.endsWith(".gain") ? 0 : o.weightDecay;
      for (let i = 0; i < values.length; i++) {
        const g = p.gradients[i]! * clip;
        first[i] = o.beta1 * first[i]! + (1 - o.beta1) * g;
        second[i] = o.beta2 * second[i]! + (1 - o.beta2) * g * g;
        values[i] = values[i]! * (1 - o.learningRate * decay) - o.learningRate * (first[i]! / (1 - o.beta1 ** nextStep)) / (Math.sqrt(second[i]! / (1 - o.beta2 ** nextStep)) + o.epsilon);
      }
      if (![values, first, second].every((array) => array.every(Number.isFinite))) throw new Error("Non-finite optimizer update.");
      return { values, first, second };
    });
    updates.forEach((u, i) => { this.parameters[i]!.values.set(u.values); this.moments[i]!.first.set(u.first); this.moments[i]!.second.set(u.second); });
    this.step = nextStep; return norm;
  }
}
