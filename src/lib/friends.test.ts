import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeFriendCard,
  restyleFriendPublication,
  type FriendCard,
  type FriendSettings,
} from "./friends";

const oldRevision = "a".repeat(32);
const newRevision = "b".repeat(32);
const photo = { rev: oldRevision, data: "data:image/jpeg;base64,AQID" };
const existing: FriendCard = {
  v: 4,
  rev: oldRevision,
  ph: true,
  t: 1794000000000,
  d: "2026-11-07",
  n: "Old name",
  g: "neko",
  r: 3,
  c: 54,
  s: 8,
  m: 23,
  l: 12,
  k: 78,
  vc: 149,
  a: "1,3,5,7,9,11,13",
  w: "2,4,6,8,10,12,14",
  bd: { "first-carve": "2026-10-01" },
  pin: "first-carve",
  acc: "sakura",
  st: "moss",
  fr: "plain",
  fx: "none",
  bk: 1,
  sb: "quiet",
  sh: "2026-10-01",
};
const settings: FriendSettings = {
  v: 4,
  rev: newRevision,
  prev: oldRevision,
  on: true,
  photo: true,
  n: "New name",
  since: existing.sh,
  deco: {
    fr: "orbit",
    fx: "glint",
    border: "gilt",
    charm: "moon",
    statusText: "Still studying",
    bannerId: "c".repeat(32),
    pin: "first-carve",
  },
};

function decodedCard(): FriendCard {
  const state = decodeFriendCard(existing);
  assert.equal(state.kind, "published");
  if (state.kind !== "published") throw new Error("Invalid test fixture");
  return state.card;
}

test("restyling retains public totals, week, day, badges and identity without mutating the source", () => {
  const previous = decodedCard();
  const before = structuredClone(previous);
  const publication = restyleFriendPublication(settings, previous, photo);
  assert.ok(publication);
  for (const key of [
    "r",
    "c",
    "s",
    "m",
    "l",
    "k",
    "vc",
    "a",
    "w",
    "d",
    "bd",
    "g",
    "acc",
    "st",
    "sh",
  ] as const)
    assert.deepEqual(publication.card[key], previous[key], key);
  assert.deepEqual(previous, before);
  assert.equal(publication.card.rev, newRevision);
  assert.equal(publication.card.n, settings.n);
  for (const key of ["fr", "fx", "border", "charm", "statusText", "bannerId", "pin"] as const)
    assert.equal(publication.card[key], settings.deco[key], key);
  assert.equal(publication.card.bk, undefined);
  assert.equal(publication.card.sb, undefined);
  assert.equal(publication.card.ph, true);
  assert.deepEqual(publication.photo, { rev: newRevision, data: photo.data });
  assert.equal(decodeFriendCard({ ...publication.card, t: previous.t }).kind, "published");
  assert.equal(restyleFriendPublication(settings, previous, photo)?.fp, publication.fp);
  assert.notEqual(
    restyleFriendPublication({ ...settings, n: "Another" }, previous, photo)?.fp,
    publication.fp,
  );
});

test("turning sharing off returns no publication or photo", () => {
  assert.equal(restyleFriendPublication({ ...settings, on: false }, decodedCard(), photo), null);
});

test("turning photo sharing off retains study data but removes the photo", () => {
  const publication = restyleFriendPublication({ ...settings, photo: false }, decodedCard(), photo);
  assert.ok(publication);
  assert.equal(publication.photo, null);
  assert.equal(publication.card.ph, false);
  assert.equal(publication.card.a, existing.a);
});

test("missing, malformed or revision-mismatched old photos cannot leak", () => {
  for (const invalid of [
    null,
    {},
    { rev: oldRevision, data: "https://example.com/private.jpg" },
    { rev: oldRevision, data: "data:image/svg+xml;base64,AQID" },
    { rev: "bad", data: photo.data },
    { rev: newRevision, data: photo.data },
  ]) {
    const publication = restyleFriendPublication(settings, decodedCard(), invalid);
    assert.ok(publication);
    assert.equal(publication.photo, null);
    assert.equal(publication.card.ph, false);
  }
});

test("a photo not advertised by the old card is not reused", () => {
  const publication = restyleFriendPublication(settings, { ...decodedCard(), ph: false }, photo);
  assert.ok(publication);
  assert.equal(publication.photo, null);
  assert.equal(publication.card.ph, false);
});

test("restyling copies only allowlisted fields, not unrelated input properties", () => {
  const previous = { ...decodedCard(), privateProgress: "not public", email: "not public" };
  const publication = restyleFriendPublication(settings, previous, photo);
  assert.ok(publication);
  assert.equal("privateProgress" in publication.card, false);
  assert.equal("email" in publication.card, false);
  assert.equal("t" in publication.card, false);
});
