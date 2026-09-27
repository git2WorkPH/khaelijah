import { statfsSync } from "node:fs";
export const DEFAULT_DISK_RESERVE = 1024 ** 3;
/** 1 GiB conservative initial reserve; caller may raise it, never bypass disk checking. */
export function requireDiskSpace(directory: string, estimatedBytes: number, reserveBytes = DEFAULT_DISK_RESERVE, available = () => { const s = statfsSync(directory); return s.bavail * s.bsize; }): void {
  if (!Number.isSafeInteger(estimatedBytes) || estimatedBytes < 0 || !Number.isSafeInteger(reserveBytes) || reserveBytes < DEFAULT_DISK_RESERVE) throw new Error("Invalid disk budget.");
  if (available() < estimatedBytes + reserveBytes) throw new Error("Insufficient disk reserve; no data removed.");
}
