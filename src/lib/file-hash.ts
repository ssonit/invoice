import { createHash } from "node:crypto";

/** Hex-encoded SHA-256 of a buffer — used to detect exact-duplicate file uploads. */
export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
