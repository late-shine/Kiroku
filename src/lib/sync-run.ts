/**
 * Phase 9c — one sync, start to finish, against an abstract account (`CloudIO`). Pure async logic: no Firebase, no
 * React, so the check script can drive it with an in-memory fake, including a second device writing in the middle.
 */
import {
  decodeCloud,
  encodeSnapshot,
  planSync,
  type CloudTree,
  type SyncContext,
  type SyncMode,
  type SyncPlan,
  type SyncSnapshot,
} from "@/lib/sync";

export interface CloudIO {
  /** The raw value of `users/<uid>` (null when empty) and its ETag. */
  read(): Promise<{ value: unknown; etag: string }>;
  /** Atomically replaces `users/<uid>` if its ETag matches; false means a conflict. */
  write(tree: CloudTree, etag: string): Promise<boolean>;
}

export type RunResult =
  | { ok: true; plan: Extract<SyncPlan, { ok: true }>; wrote: boolean; device: SyncSnapshot }
  | { ok: false; message: string; retryable: boolean };

export async function runSync(
  io: CloudIO,
  mode: SyncMode,
  getDevice: () => SyncSnapshot,
  ctx: SyncContext,
): Promise<RunResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { value, etag } = await io.read();
    const decoded = decodeCloud(value);
    if (!decoded.ok) return { ok: false, message: decoded.message, retryable: false };
    const device = getDevice(); // taken after the read, so it is as fresh as possible
    const plan = planSync(mode, device, decoded.snapshot, ctx);
    if (!plan.ok) return { ok: false, message: plan.message, retryable: false };
    if (!plan.writeCloud) return { ok: true, plan, wrote: false, device };
    if (!(await io.write(encodeSnapshot(plan.result, ctx.now), etag))) continue;
    return { ok: true, plan, wrote: true, device };
  }
  return {
    ok: false,
    message: "Your account changed while syncing, so nothing was written. It will try again.",
    retryable: true,
  };
}
