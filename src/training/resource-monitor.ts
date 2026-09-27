import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { statfsSync } from "node:fs";
const execute = promisify(execFile);
export interface Observation { workerRss: number; pressure: number; swapBytes: number; freeDiskBytes: number; support: string; }
export async function observeResources(pid: number, directory: string): Promise<Observation> {
  if (process.platform !== "darwin") throw new Error("Production memory-pressure monitor currently requires macOS.");
  const options = { timeout: 1000, maxBuffer: 8192 };
  const [rss, pressure, swap] = await Promise.all([
    execute("/bin/ps", ["-o", "rss=", "-p", String(pid)], options),
    execute("/usr/sbin/sysctl", ["-n", "kern.memorystatus_vm_pressure_level"], options),
    execute("/usr/sbin/sysctl", ["-n", "vm.swapusage"], options),
  ]);
  const workerRss = Number(rss.stdout.trim()) * 1024, level = Number(pressure.stdout.trim());
  const match = /used\s*=\s*([\d.]+)([MG])/.exec(swap.stdout);
  if (!Number.isFinite(workerRss) || workerRss <= 0 || ![1, 2, 4].includes(level) || !match) throw new Error("Resource monitoring unavailable.");
  const fs = statfsSync(directory);
  return { workerRss, pressure: level, swapBytes: Number(match[1]) * (match[2] === "G" ? 1024 ** 3 : 1024 ** 2), freeDiskBytes: fs.bavail * fs.bsize, support: "macOS ps RSS + memorystatus pressure + system swap; sampled, not hard reservation" };
}
export function resourceStop(observation: Observation, rssLimit: number, initialSwap: number, estimatedBytes: number): string | null {
  if (![observation.workerRss, observation.pressure, observation.swapBytes, observation.freeDiskBytes].every(Number.isFinite)) return "monitor_unavailable";
  if (observation.workerRss >= rssLimit) return "memory_limit";
  if (observation.pressure !== 1 || observation.swapBytes - initialSwap > 64 * 1024 ** 2) return "memory_pressure";
  if (observation.freeDiskBytes < 1024 ** 3 + estimatedBytes) return "disk_reserve";
  return null;
}
