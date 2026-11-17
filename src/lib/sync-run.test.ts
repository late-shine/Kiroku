import assert from "node:assert/strict";
import test from "node:test";
import { recordId, type CheckinRecord, type CheckinSession } from "./checkin";
import {
  decodeCloud,
  deviceKey,
  encodeSnapshot,
  freshContext,
  mergeSnapshots,
  SYNC_SCHEMA,
  type CloudTree,
  type SyncMode,
  type SyncSnapshot,
} from "./sync";
import { runSync, type CloudIO, type RunResult } from "./sync-run";

const now = new Date("2026-11-18T12:00:00.000Z");
const context = () => ({ ...freshContext(now), linked: true });

function recordsFor(hex: string): Record<CheckinRecord["status"], CheckinRecord> {
  const session: CheckinSession = {
    version: 1,
    id: `ci_${hex.repeat(32)}`,
    createdAt: now.toISOString(),
    lessons: [{ day: 1, title: "Introductions" }],
    completedDays: [1],
    questionCount: 5,
    sources: [{ id: "d1-g1", day: 1, kind: "grammar", label: "です", detail: "Polite copula" }],
    questions: Array.from({ length: 5 }, (_, i) => ({
      id: `q${i + 1}`,
      sourceId: "d1-g1",
      kind: "grammar",
    })),
  };
  return {
    pending: { status: "pending", session },
    complete: {
      status: "complete",
      session,
      savedAt: now.toISOString(),
      result: {
        type: "kiroku-checkin",
        version: 1,
        sessionId: session.id,
        submitted: true,
        summary: "Clear introductions.",
        strengths: ["Polite sentence endings"],
        revisit: [],
        questions: session.questions.map((q) => ({
          ...q,
          prompt: "Introduce yourself as a student.",
          answer: "学生です。",
          expectedAnswer: "学生です。",
          feedback: "Correct.",
          score: 2,
          status: "answered",
        })),
      },
    },
    deleted: { status: "deleted", id: session.id, deletedAt: now.toISOString() },
  };
}

const a = recordsFor("a");
const b = recordsFor("b");
const c = recordsFor("c");

function snapshot(...records: CheckinRecord[]): SyncSnapshot {
  const decoded = decodeCloud(null);
  assert.ok(decoded.ok);
  return {
    ...decoded.snapshot,
    progress: {
      ...decoded.snapshot.progress,
      checkins: Object.fromEntries(records.map((record) => [recordId(record), record])),
    },
  };
}

const acknowledgedKey = (result: Extract<RunResult, { ok: true }>) =>
  deviceKey(result.plan.replaceDevice ? result.plan.result : result.device);

class FakeCloud {
  value: unknown;
  revision = 0;

  constructor(value: unknown = null) {
    this.value = structuredClone(value);
  }

  client(beforeWrite?: () => Promise<void>) {
    const reads: string[] = [];
    const writes: { tree: CloudTree; etag: string; accepted: boolean }[] = [];
    const io: CloudIO = {
      read: async () => {
        const etag = `"revision-${this.revision}"`;
        reads.push(etag);
        return { value: structuredClone(this.value), etag };
      },
      write: async (tree, etag) => {
        await beforeWrite?.();
        const accepted = etag === `"revision-${this.revision}"`;
        writes.push({ tree: structuredClone(tree), etag, accepted });
        if (accepted) {
          this.value = structuredClone(tree);
          this.revision++;
        }
        return accepted;
      },
    };
    return { io, reads, writes };
  }

  snapshot(): SyncSnapshot {
    const decoded = decodeCloud(this.value);
    assert.ok(decoded.ok);
    return decoded.snapshot;
  }
}

const statuses = ["pending", "complete", "deleted"] as const;
for (const leftStatus of statuses) {
  for (const rightStatus of statuses) {
    test(`concurrent ${leftStatus}/${rightStatus} check-ins converge on two clients`, async () => {
      const cloud = new FakeCloud();
      const left = cloud.client();
      const right = cloud.client();
      const [leftResult, rightResult] = await Promise.all([
        runSync(left.io, "merge", () => snapshot(a[leftStatus], b.pending), context()),
        runSync(right.io, "merge", () => snapshot(a[rightStatus], c.complete), context()),
      ]);
      assert.ok(leftResult.ok);
      assert.ok(rightResult.ok);
      assert.equal(leftResult.wrote, true);
      assert.equal(rightResult.wrote, true);
      assert.equal(left.reads.length + right.reads.length, 3);
      assert.equal([...left.writes, ...right.writes].filter((write) => !write.accepted).length, 1);
      const winner =
        statuses[Math.max(statuses.indexOf(leftStatus), statuses.indexOf(rightStatus))]!;
      const expected = snapshot(a[winner], b.pending, c.complete);
      assert.deepEqual(cloud.snapshot().progress.checkins, expected.progress.checkins);

      const settled = await Promise.all([
        runSync(left.io, "merge", () => leftResult.plan.result, context()),
        runSync(right.io, "merge", () => rightResult.plan.result, context()),
      ]);
      for (const result of settled) {
        assert.ok(result.ok);
        assert.equal(result.wrote, false);
        assert.equal(acknowledgedKey(result), deviceKey(expected));
      }
    });
  }
}

test("same-timestamp writes use fresh ETags and one retry preserves both records", async () => {
  const cloud = new FakeCloud(encodeSnapshot(snapshot(), now));
  const other = cloud.client();
  let interleaved = false;
  const client = cloud.client(async () => {
    if (interleaved) return;
    interleaved = true;
    const result = await runSync(other.io, "merge", () => snapshot(b.complete), context());
    assert.ok(result.ok && result.wrote);
  });
  const result = await runSync(client.io, "merge", () => snapshot(a.pending), context());
  assert.ok(result.ok && result.wrote);
  assert.deepEqual(client.reads, ['"revision-0"', '"revision-1"']);
  assert.deepEqual(
    client.writes.map(({ accepted }) => accepted),
    [false, true],
  );
  assert.deepEqual(
    client.writes.map(({ etag }) => etag),
    client.reads,
  );
  for (const { tree } of [...other.writes, ...client.writes]) {
    assert.deepEqual(tree["meta"], { schema: SYNC_SCHEMA, updatedAt: now.toISOString() });
  }
  assert.deepEqual(
    cloud.snapshot().progress.checkins,
    snapshot(a.pending, b.complete).progress.checkins,
  );
  assert.equal(acknowledgedKey(result), deviceKey(cloud.snapshot()));
});

test("a conflict refreshes the device snapshot as well as the cloud read", async () => {
  const cloud = new FakeCloud();
  const other = cloud.client();
  let device = snapshot(a.pending);
  let attempted = false;
  const client = cloud.client(async () => {
    if (attempted) return;
    attempted = true;
    device = snapshot(a.complete, c.pending);
    const result = await runSync(other.io, "merge", () => snapshot(b.deleted), context());
    assert.ok(result.ok && result.wrote);
  });
  const result = await runSync(client.io, "merge", () => device, context());
  assert.ok(result.ok && result.wrote);
  assert.equal(result.device, device);
  assert.deepEqual(
    cloud.snapshot().progress.checkins,
    snapshot(a.complete, b.deleted, c.pending).progress.checkins,
  );
});

test("persistent conflicts stop after two attempts without acknowledging a write", async () => {
  const cloud = new FakeCloud();
  const other = cloud.client();
  let interleavings = 0;
  const client = cloud.client(async () => {
    const record = interleavings++ === 0 ? b.pending : c.complete;
    const result = await runSync(other.io, "merge", () => snapshot(record), context());
    assert.ok(result.ok && result.wrote);
  });
  const device = snapshot(a.pending);
  const result = await runSync(client.io, "merge", () => device, context());
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.retryable);
  assert.equal("plan" in result, false);
  assert.equal("device" in result, false);
  assert.equal("wrote" in result, false);
  assert.equal(client.reads.length, 2);
  assert.deepEqual(
    client.writes.map(({ accepted }) => accepted),
    [false, false],
  );
  assert.deepEqual(
    cloud.snapshot().progress.checkins,
    snapshot(b.pending, c.complete).progress.checkins,
  );
  assert.deepEqual(device.progress.checkins, snapshot(a.pending).progress.checkins);
});

for (const mode of ["merge", "use-cloud", "use-device"] as const) {
  test(`${mode} rejects an unknown schema without writing`, async () => {
    const cloud = new FakeCloud({ meta: { schema: SYNC_SCHEMA + 1 } });
    const client = cloud.client();
    const result = await runSync(client.io, mode, () => snapshot(a.pending), context());
    assert.ok(!result.ok && !result.retryable);
    assert.match(result.message, /newer Kiroku/);
    assert.equal(client.reads.length, 1);
    assert.equal(client.writes.length, 0);
  });

  test(`${mode} acknowledgement settles without another automatic upload`, async () => {
    const cloud = new FakeCloud(
      mode === "use-device" ? null : encodeSnapshot(snapshot(b.complete), now),
    );
    const client = cloud.client();
    const device = snapshot(a.pending);
    const result = await runSync(client.io, mode, () => device, context());
    assert.ok(result.ok);
    const applied = result.plan.replaceDevice ? result.plan.result : device;
    assert.equal(deviceKey(applied), acknowledgedKey(result));
    const settled = await runSync(client.io, "merge", () => applied, context());
    assert.ok(settled.ok);
    assert.equal(settled.wrote, false);
    assert.equal(deviceKey(applied), acknowledgedKey(settled));
  });
}

test("an unknown schema appearing during a conflict is rejected on the fresh read", async () => {
  const cloud = new FakeCloud();
  const client = cloud.client(async () => {
    cloud.value = { meta: { schema: SYNC_SCHEMA + 1 } };
    cloud.revision++;
  });
  const result = await runSync(client.io, "merge", () => snapshot(a.pending), context());
  assert.ok(!result.ok && !result.retryable);
  assert.equal(client.reads.length, 2);
  assert.deepEqual(
    client.writes.map(({ accepted }) => accepted),
    [false],
  );
});

const dirtyCases: { mode: SyncMode; replaceDevice: boolean }[] = [
  { mode: "merge", replaceDevice: true },
  { mode: "merge", replaceDevice: false },
  { mode: "use-device", replaceDevice: false },
];
for (const { mode, replaceDevice } of dirtyCases) {
  test(`${mode}, replaceDevice=${replaceDevice}: changes during I/O stay dirty until uploaded`, async () => {
    const cloud = new FakeCloud(replaceDevice ? encodeSnapshot(snapshot(b.pending), now) : null);
    let device = snapshot(a.pending);
    const client = cloud.client(async () => {
      device = snapshot(a.complete, c.deleted);
    });
    const result = await runSync(client.io, mode, () => device, context());
    assert.ok(result.ok && result.wrote);
    assert.equal(result.plan.replaceDevice, replaceDevice);
    const applied = replaceDevice ? mergeSnapshots(device, result.plan.result) : device;
    assert.notEqual(deviceKey(applied), acknowledgedKey(result));
    assert.equal(cloud.snapshot().progress.checkins?.[recordId(a.pending)]?.status, "pending");
    assert.equal(cloud.snapshot().progress.checkins?.[recordId(c.deleted)], undefined);
    assert.deepEqual(result.device.progress.checkins, snapshot(a.pending).progress.checkins);

    const followup = await runSync(client.io, "merge", () => applied, context());
    assert.ok(followup.ok && followup.wrote);
    assert.equal(deviceKey(applied), acknowledgedKey(followup));
    assert.deepEqual(cloud.snapshot().progress.checkins, applied.progress.checkins);
    const settled = await runSync(client.io, "merge", () => applied, context());
    assert.ok(settled.ok);
    assert.equal(settled.wrote, false);
    assert.equal(deviceKey(applied), acknowledgedKey(settled));
    assert.equal(client.writes.length, 2);
  });
}

test("read and write failures propagate instead of producing a successful sync", async () => {
  const failure = Object.assign(new Error("The database refused the request."), {
    code: "permission-denied",
  });
  for (const failRead of [true, false]) {
    let writes = 0;
    const io: CloudIO = {
      read: async () => {
        if (failRead) throw failure;
        return { value: null, etag: '"empty"' };
      },
      write: async () => {
        writes++;
        throw failure;
      },
    };
    await assert.rejects(
      runSync(io, "merge", () => snapshot(a.pending), context()),
      (error) => error === failure,
    );
    assert.equal(writes, failRead ? 0 : 1);
  }
});
