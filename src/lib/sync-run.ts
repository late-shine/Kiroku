/**
 * Phase 9c — one sync, start to finish, against an abstract account (`CloudIO`). Pure async logic: no Firebase, no
 * React, so the check script can drive it with an in-memory fake, including a second device writing in the middle.
 *
 * The race guard (PLAN.md, 9c point 5): the plan is made from one read of the account. Just before writing, the tiny
 * `meta/updatedAt` stamp is read again; if another device has written since, the whole read-merge-plan is redone once
 * from fresh data. If it moved again, the sync stops with a retryable message and writes nothing. Only the stamp read
 * to the write is unguarded (one network round trip), which is the best a plain database write allows.
 */
import {
  decodeCloud,
  encodeSnapshot,
  planSync,
  stampOf,
  type CloudTree,
  type SyncContext,
  type SyncMode,
  type SyncPlan,
  type SyncSnapshot,
} from "@/lib/sync";

export interface CloudIO {
  /** The raw value of `users/<uid>` (null when empty). */
  read(): Promise<unknown>;
  /** Just `users/<uid>/meta/updatedAt` (null when missing). */
  readStamp(): Promise<string | null>;
  /** Replaces `users/<uid>` with this tree. */
  write(tree: CloudTree): Promise<void>;
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
    const raw = await io.read();
    const decoded = decodeCloud(raw);
    if (!decoded.ok) return { ok: false, message: decoded.message, retryable: false };
    const device = getDevice(); // taken after the read, so it is as fresh as possible
    const plan = planSync(mode, device, decoded.snapshot, ctx);
    if (!plan.ok) return { ok: false, message: plan.message, retryable: false };
    if (!plan.writeCloud) return { ok: true, plan, wrote: false, device };
    if ((await io.readStamp()) !== stampOf(raw)) continue; // someone wrote since we read: merge again from fresh data
    await io.write(encodeSnapshot(plan.result, ctx.now));
    return { ok: true, plan, wrote: true, device };
  }
  return {
    ok: false,
    message: "Your account changed while syncing, so nothing was written. It will try again.",
    retryable: true,
  };
}
