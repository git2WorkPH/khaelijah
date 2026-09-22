/** Row-major Float64 matrices. Kernels return explicit local derivatives;
 * the caller composes the graph and accumulates shared parameter gradients.
 */
export class Matrix {
  readonly data: Float64Array;
  constructor(readonly rows: number, readonly cols: number, data?: Iterable<number>) {
    const count = rows * cols;
    if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(cols) || rows < 1 || cols < 1 || count > 10_000_000) throw new Error("Invalid matrix shape.");
    this.data = data === undefined ? new Float64Array(count) : Float64Array.from(data);
    if (this.data.length !== count || !this.data.every(Number.isFinite)) throw new Error("Invalid matrix data.");
  }
}

export interface Kernel {
  readonly output: Matrix;
  /** One gradient per floating-point input, in argument order. Never accumulates. */
  backward(upstream: Matrix): readonly Matrix[];
}
function same(a: Matrix, b: Matrix): void {
  if (a.rows !== b.rows || a.cols !== b.cols) throw new Error("Matrix shape mismatch.");
}
function snapshot(input: Matrix): Matrix { return new Matrix(input.rows, input.cols, input.data); }
function kernel(output: Matrix, backward: (upstream: Matrix) => readonly Matrix[]): Kernel {
  return { output, backward(upstream) {
    same(output, upstream);
    if (!upstream.data.every(Number.isFinite)) throw new Error("Non-finite upstream gradient.");
    const gradients = backward(upstream);
    if (gradients.some((gradient) => !gradient.data.every(Number.isFinite))) throw new Error("Non-finite backward result.");
    return gradients;
  } };
}

export function add(left: Matrix, right: Matrix): Kernel {
  same(left, right);
  return kernel(new Matrix(left.rows, left.cols, left.data.map((value, i) => value + right.data[i]!)), (g) => [snapshot(g), snapshot(g)]);
}

export function scale(input: Matrix, factor: number): Kernel {
  if (!Number.isFinite(factor)) throw new Error("Invalid scale.");
  return kernel(new Matrix(input.rows, input.cols, input.data.map((value) => value * factor)), (g) => [new Matrix(input.rows, input.cols, g.data.map((value) => value * factor))]);
}

export function transpose(input: Matrix): Kernel {
  const output = new Matrix(input.cols, input.rows);
  for (let r = 0; r < input.rows; r++) for (let c = 0; c < input.cols; c++) output.data[c * input.rows + r] = input.data[r * input.cols + c]!;
  return kernel(output, (g) => {
    const dx = new Matrix(input.rows, input.cols);
    for (let r = 0; r < input.rows; r++) for (let c = 0; c < input.cols; c++) dx.data[r * input.cols + c] = g.data[c * input.rows + r]!;
    return [dx];
  });
}

export function matmul(left: Matrix, right: Matrix): Kernel {
  if (left.cols !== right.rows) throw new Error("Matmul shape mismatch.");
  const a = snapshot(left), b = snapshot(right);
  const output = new Matrix(a.rows, b.cols);
  for (let r = 0; r < a.rows; r++) for (let c = 0; c < b.cols; c++) {
    let sum = 0;
    for (let k = 0; k < a.cols; k++) sum += a.data[r * a.cols + k]! * b.data[k * b.cols + c]!;
    output.data[r * b.cols + c] = sum;
  }
  if (!output.data.every(Number.isFinite)) throw new Error("Matmul overflow.");
  return kernel(output, (g) => {
    const da = new Matrix(a.rows, a.cols), db = new Matrix(b.rows, b.cols);
    for (let r = 0; r < a.rows; r++) for (let c = 0; c < b.cols; c++) for (let k = 0; k < a.cols; k++) {
      da.data[r * a.cols + k] = da.data[r * a.cols + k]! + g.data[r * b.cols + c]! * b.data[k * b.cols + c]!;
      db.data[k * b.cols + c] = db.data[k * b.cols + c]! + a.data[r * a.cols + k]! * g.data[r * b.cols + c]!;
    }
    return [da, db];
  });
}

export function addBias(input: Matrix, bias: Matrix): Kernel {
  if (bias.rows !== 1 || bias.cols !== input.cols) throw new Error("Bias shape mismatch.");
  return kernel(new Matrix(input.rows, input.cols, input.data.map((value, i) => value + bias.data[i % input.cols]!)), (g) => {
    const db = new Matrix(1, bias.cols);
    for (let i = 0; i < g.data.length; i++) db.data[i % bias.cols] = db.data[i % bias.cols]! + g.data[i]!;
    return [snapshot(g), db];
  });
}

export function relu(input: Matrix): Kernel {
  const x = snapshot(input);
  return kernel(new Matrix(x.rows, x.cols, x.data.map((value) => Math.max(0, value))), (g) => [new Matrix(x.rows, x.cols, g.data.map((value, i) => x.data[i]! > 0 ? value : 0))]);
}

export function embedding(table: Matrix, ids: readonly number[]): Kernel {
  if (!ids.length || ids.some((id) => !Number.isInteger(id) || id < 0 || id >= table.rows)) throw new Error("Invalid embedding IDs.");
  const indices = [...ids];
  const output = new Matrix(indices.length, table.cols);
  indices.forEach((id, row) => output.data.set(table.data.subarray(id * table.cols, (id + 1) * table.cols), row * table.cols));
  return kernel(output, (g) => {
    const dt = new Matrix(table.rows, table.cols);
    indices.forEach((id, row) => {
      for (let c = 0; c < table.cols; c++) dt.data[id * table.cols + c] = dt.data[id * table.cols + c]! + g.data[row * table.cols + c]!;
    });
    return [dt];
  });
}

/** mask=1 permits a key. Fully masked rows are invalid; PAD queries are handled by the caller. */
export function maskedSoftmax(input: Matrix, mask: Uint8Array = new Uint8Array(input.data.length).fill(1)): Kernel {
  if (mask.length !== input.data.length || mask.some((value) => value !== 0 && value !== 1)) throw new Error("Invalid softmax mask.");
  const x = snapshot(input), output = new Matrix(x.rows, x.cols);
  for (let r = 0; r < x.rows; r++) {
    const offset = r * x.cols;
    let max = -Infinity;
    for (let c = 0; c < x.cols; c++) if (mask[offset + c]) max = Math.max(max, x.data[offset + c]!);
    if (max === -Infinity) throw new Error("Fully masked softmax row.");
    let total = 0;
    for (let c = 0; c < x.cols; c++) {
      const value = mask[offset + c] ? Math.exp(x.data[offset + c]! - max) : 0;
      output.data[offset + c] = value; total += value;
    }
    for (let c = 0; c < x.cols; c++) output.data[offset + c] = output.data[offset + c]! / total;
  }
  const probabilities = output.data.slice();
  return kernel(output, (g) => {
    const dx = new Matrix(x.rows, x.cols);
    for (let r = 0; r < x.rows; r++) {
      const offset = r * x.cols;
      let weighted = 0;
      for (let c = 0; c < x.cols; c++) weighted += g.data[offset + c]! * probabilities[offset + c]!;
      for (let c = 0; c < x.cols; c++) dx.data[offset + c] = probabilities[offset + c] === 0 ? 0 : probabilities[offset + c]! * (g.data[offset + c]! - weighted);
    }
    return [dx];
  });
}

export function layerNorm(input: Matrix, gamma: Matrix, beta: Matrix, epsilon = 1e-5): Kernel {
  if (gamma.rows !== 1 || gamma.cols !== input.cols) throw new Error("Layer norm shape mismatch.");
  same(gamma, beta);
  if (!Number.isFinite(epsilon) || epsilon <= 0) throw new Error("Invalid layer norm epsilon.");
  const x = snapshot(input), gains = snapshot(gamma);
  const normalized = new Float64Array(x.data.length), inverse = new Float64Array(x.rows);
  const output = new Matrix(x.rows, x.cols);
  for (let r = 0; r < x.rows; r++) {
    const offset = r * x.cols;
    let mean = 0, variance = 0;
    for (let c = 0; c < x.cols; c++) mean += x.data[offset + c]! / x.cols;
    for (let c = 0; c < x.cols; c++) variance += (x.data[offset + c]! - mean) ** 2 / x.cols;
    inverse[r] = 1 / Math.sqrt(variance + epsilon);
    for (let c = 0; c < x.cols; c++) {
      normalized[offset + c] = (x.data[offset + c]! - mean) * inverse[r]!;
      output.data[offset + c] = normalized[offset + c]! * gains.data[c]! + beta.data[c]!;
    }
  }
  if (!output.data.every(Number.isFinite)) throw new Error("Layer norm overflow.");
  return kernel(output, (g) => {
    const dx = new Matrix(x.rows, x.cols), dg = new Matrix(1, x.cols), db = new Matrix(1, x.cols);
    for (let r = 0; r < x.rows; r++) {
      const offset = r * x.cols;
      let sum = 0, weighted = 0;
      for (let c = 0; c < x.cols; c++) {
        const dy = g.data[offset + c]!, norm = normalized[offset + c]!;
        sum += dy * gains.data[c]!; weighted += dy * gains.data[c]! * norm;
        dg.data[c] = dg.data[c]! + dy * norm; db.data[c] = db.data[c]! + dy;
      }
      for (let c = 0; c < x.cols; c++) dx.data[offset + c] = inverse[r]! * (g.data[offset + c]! * gains.data[c]! - sum / x.cols - normalized[offset + c]! * weighted / x.cols);
    }
    return [dx, dg, db];
  });
}
