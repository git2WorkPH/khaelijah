import { CausalDecoder } from "../model/trainable/decoder.js";
import { batches, digest, loadDataset } from "../training/dataset.js";
import { AdamW } from "../training/optimizer.js";
import { evaluateLoss, train } from "../training/trainer.js";

const dataset = loadDataset(new URL("../../datasets/synthetic-pattern-v1.json", import.meta.url));
const model = new CausalDecoder();
const training = batches(dataset, "train", model.config.context, 4);
const initialLoss = evaluateLoss(model, training);
const controlLoss = evaluateLoss(model, training);
const before = new Map(model.parameters().map((p) => [p.name, p.values.slice()]));
const optimizer = new AdamW(model.parameters());
const result = await train(model, training, optimizer, { maxSteps: 200, maxMilliseconds: 900000, maxRssBytes: 1024 ** 3 });
const finalLoss = evaluateLoss(model, training);
const changed = (name: string) => model.parameters().find((p) => p.name === name)!.values.some((value, i) => value !== before.get(name)![i]);
const attentionChanged = changed("block.0.q.weight"), feedForwardChanged = changed("block.0.ff1.weight");
const passed = result.stopReason === "max_steps" && initialLoss === controlLoss && finalLoss <= initialLoss * 0.5 && attentionChanged && feedForwardChanged;
console.log(JSON.stringify({ experiment: "tiny-overfit", datasetVersion: dataset.version, datasetHash: digest(JSON.stringify(dataset)), nodeVersion: process.version, optimizer: optimizer.options, config: model.config, parameterCount: model.registry.count, initialLoss, controlLoss, finalLoss, attentionChanged, feedForwardChanged, passed, ...result }, null, 2));
if (!passed) process.exitCode = 1;
