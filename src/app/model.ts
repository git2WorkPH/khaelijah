import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import {
  CausalDecoder,
  DEFAULT_DECODER_CONFIG,
} from "../model/trainable/decoder.js";
import { generate } from "../model/trainable/generation.js";
import { batches, loadDataset } from "../training/dataset.js";
import { AdamW } from "../training/optimizer.js";
import {
  train,
  evaluateLoss,
  DEFAULT_TRAINING,
  type TrainingMetric,
} from "../training/trainer.js";
import {
  captureCheckpoint,
  dataIdentity,
  loadCheckpoint,
  restoreCheckpoint,
  saveCheckpoint,
  checkpointHash,
  type Checkpoint,
} from "../training/checkpoint.js";

const dataset = loadDataset(
  new URL("../../datasets/synthetic-pattern-v1.json", import.meta.url),
);
const args = process.argv.slice(2),
  command = args.shift();
const usage =
  "Usage: model train <checkpoint> [steps=200] [seed=11] | resume <checkpoint> [additionalSteps=200] | generate <checkpoint> <prompt> | experiment <output-directory> <report.json>";
function boundedInteger(
  text: string | undefined,
  fallback: number,
  max: number,
  min = 1,
): number {
  const value = text === undefined ? fallback : Number(text);
  if (
    (text !== undefined && !/^\d+$/.test(text)) ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    throw new Error("Invalid steps/seed.");
  return value;
}
async function checkpointTraining(resume: boolean) {
  if (!args[0] || args.length > (resume ? 2 : 3)) throw new Error(usage);
  const path = resolve(args[0]),
    steps = boundedInteger(args[1], 200, 2000);
  const previous = resume ? await loadCheckpoint(path) : null;
  if (resume && !previous?.training)
    throw new Error("Full training checkpoint required.");
  const identity = dataIdentity(
    dataset,
    previous?.config.context ?? DEFAULT_DECODER_CONFIG.context,
    previous?.training?.data.batchSize ?? 4,
  );
  const restored = previous ? restoreCheckpoint(previous, identity) : null;
  const model =
    restored?.model ??
    new CausalDecoder({
      ...DEFAULT_DECODER_CONFIG,
      seed: boundedInteger(args[2], 11, 0xffffffff, 0),
    });
  const optimizer = restored?.optimizer ?? new AdamW(model.parameters());
  const history = previous?.training?.metrics ?? [],
    samplerState = restored?.sampler.state ?? model.config.seed;
  const training = batches(
    dataset,
    "train",
    model.config.context,
    identity.batchSize,
  );
  await mkdir(dirname(path), { recursive: true });
  const controller = new AbortController(),
    cancel = () => controller.abort();
  process.once("SIGINT", cancel);
  process.once("SIGTERM", cancel);
  try {
    const result = await train(model, training, optimizer, {
      ...DEFAULT_TRAINING,
      maxSteps: steps,
      signal: controller.signal,
      onBoundary: async (state) => {
        if (state.stopReason || state.step % 25 === 0)
          await saveCheckpoint(
            path,
            captureCheckpoint(model, {
              optimizer,
              data: identity,
              samplerState,
              metrics: [...history, ...state.metrics],
            }),
          );
      },
    });
    console.log(
      JSON.stringify(
        { checkpoint: path, cumulativeSteps: optimizer.step, ...result },
        null,
        2,
      ),
    );
    if (result.stopReason !== "max_steps") process.exitCode = 2;
  } finally {
    process.removeListener("SIGINT", cancel);
    process.removeListener("SIGTERM", cancel);
  }
}

async function experiment() {
  if (args.length !== 2) throw new Error(usage);
  const directory = resolve(args[0]!),
    reportPath = resolve(args[1]!);
  await mkdir(directory, { recursive: true });
  await mkdir(dirname(reportPath), { recursive: true });
  const identity = dataIdentity(dataset, DEFAULT_DECODER_CONFIG.context, 4);
  const training = batches(dataset, "train", identity.context, 4),
    validation = batches(dataset, "validation", identity.context, 4),
    testing = batches(dataset, "test", identity.context, 4);
  const results = [];
  // Fixed before running: 200 updates, validation every 25; never inspect test for selection.
  for (const seed of [11, 22, 33]) {
    const model = new CausalDecoder({ ...DEFAULT_DECODER_CONFIG, seed }),
      optimizer = new AdamW(model.parameters());
    const initialValidationNll = evaluateLoss(model, validation),
      curve = [{ step: 0, validationNll: initialValidationNll }];
    let best = initialValidationNll,
      selected = captureCheckpoint(model, { optimizer, data: identity });
    const metrics: TrainingMetric[] = [],
      started = performance.now();
    let stopReason = "max_steps";
    for (let interval = 0; interval < 8; interval++) {
      const remaining =
        DEFAULT_TRAINING.maxMilliseconds - (performance.now() - started);
      if (remaining <= 0) {
        stopReason = "time_limit";
        break;
      }
      const result = await train(model, training, optimizer, {
        ...DEFAULT_TRAINING,
        maxSteps: 25,
        maxMilliseconds: remaining,
      });
      metrics.push(...result.metrics);
      stopReason = result.stopReason;
      const nll = evaluateLoss(model, validation);
      curve.push({ step: optimizer.step, validationNll: nll });
      if (nll < best) {
        best = nll;
        selected = captureCheckpoint(model, {
          optimizer,
          data: identity,
          metrics,
        });
      }
      if (result.stopReason !== "max_steps") break;
    }
    const path = join(directory, `seed-${seed}.json`);
    await saveCheckpoint(path, selected);
    const loaded = await loadCheckpoint(path),
      restored = restoreCheckpoint(loaded, identity);
    const before = checkpointHash(
      captureCheckpoint(restored.model, {
        optimizer: restored.optimizer!,
        data: identity,
      }),
    );
    const selectedValidationNll = evaluateLoss(restored.model, validation);
    const testNll = evaluateLoss(restored.model, testing); // Exactly once, after selection.
    const prompt = "abc ",
      generated = generate(restored.model, prompt, { maxNewTokens: 12 });
    const repeated = generate(restoreCheckpoint(loaded).model, prompt, {
      maxNewTokens: 12,
    });
    const readOnly =
      before ===
      checkpointHash(
        captureCheckpoint(restored.model, {
          optimizer: restored.optimizer!,
          data: identity,
        }),
      );
    const reproducible = JSON.stringify(generated) === JSON.stringify(repeated);
    const learnedPattern = generated.text === "abc abc abc ";
    const passed =
      optimizer.step === 200 &&
      stopReason === "max_steps" &&
      selectedValidationNll <= initialValidationNll * 0.9 &&
      readOnly &&
      reproducible &&
      learnedPattern;
    const result = {
      seed,
      initialValidationNll,
      selectedValidationNll,
      testNll,
      selectedStep: loaded.training!.step,
      completedSteps: optimizer.step,
      stopReason,
      elapsedMilliseconds: performance.now() - started,
      checkpoint: path,
      checkpointHash: checkpointHash(loaded),
      curve,
      metrics,
      prompt,
      generated,
      readOnly,
      reproducible,
      learnedPattern,
      passed,
    };
    results.push(result);
    console.error(
      `seed ${seed}: validation ${initialValidationNll.toFixed(6)} -> ${selectedValidationNll.toFixed(6)}; passed=${passed}`,
    );
  }
  const report = {
    experiment: "TASK-012-held-out-patterns",
    runtime: process.version,
    dataset: identity,
    architecture: DEFAULT_DECODER_CONFIG,
    optimizer: new AdamW([]).options,
    policy:
      "200 steps; validation every 25; minimum validation NLL selects checkpoint; test once after selection; fixed 12-byte continuation of abc-space",
    limitations:
      "Original near-duplicate synthetic patterns; not realistic domain generalization or application-building evidence.",
    results,
    passed: results.every((r) => r.passed),
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ report: reportPath, passed: report.passed }));
  if (!report.passed) process.exitCode = 1;
}

try {
  if (command === "train") await checkpointTraining(false);
  else if (command === "resume") await checkpointTraining(true);
  else if (command === "generate") {
    if (args.length !== 2) throw new Error(usage);
    const loaded: Checkpoint = await loadCheckpoint(resolve(args[0]!));
    console.log(
      JSON.stringify(
        generate(restoreCheckpoint(loaded).model, args[1]!),
        null,
        2,
      ),
    );
  } else if (command === "experiment") await experiment();
  else throw new Error(usage);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
