# Friends verifier context

Plan revision: 2026-11-05 / R1  
Current phase: F2 — sharing settings, publication and plain cards  
Artifact reviewed: `F:\Kiroku` at commit `a3f1f00756fadb092c3ddf7accb4cc783cd2d8b1` (`Updated F2 Files`). F1 is parent commit `08f73706c711157bb6ac3888aaf2ecdc4652ad9d`.

## Status

F2 is static-review ready, but not live-verified. Recommendation: run the missing live friend check before release acceptance. No F2 micro-fix is justified by the evidence reviewed.

## Scope and source of truth

The canonical planning files (`START-HERE.md`, `contracts.md`, `phases/F2.md`, and `handoffs/phase-F2.md`) were read from the working copy at `F:\kiroku friend project`; the F2 source/rules were reviewed from the canonical Git repo at `F:\Kiroku`. The eight files in commit `a3f1f00756fadb092c3ddf7accb4cc783cd2d8b1` match the working-copy F2 files byte-for-byte.

The attached screenshot shows the earlier F1 Friends panel with setup/code and empty relationship lists. It is not F2 sharing or card runtime evidence. The handoff is implementation context, not verification evidence.

## Observed F2 implementation

- The existing single Friends controller now receives hydrated lessons/progress/quest preferences plus sync readiness; no duplicate provider or auth listener was added.
- Sharing consent is held in owner-only revisioned settings with expected-revision/previous-revision checks. Deliberate settings edits send settings and matching card/photo replacements or deletions in one root update.
- Start sharing uses an explicit preview of the current device's public fields and optional uploaded photo; setup, request and accept do not enable sharing.
- Public card construction uses an explicit allowlist, bounded counts, known badges/dates, safe glyphs, selected decoration fields, and `profileStats.vocab` for `vc`. Google email/photo and private lesson data are not used.
- Ordinary publication rereads confirmed settings, writes only card/photo with the current revision, checks source stability, applies quiet/rate/age gates, and does not mutate consent.
- Friend cards are read only after final reciprocal links. Null, denied, unsupported, invalid, cached and stale states remain distinguishable; photos load only for a selected live card with matching revision and are not stored in the Friends cache.
- The cumulative R2 rules retain the F1 users/deletion guard and relationship rules while replacing only the settings/cards/photos placeholders with owner-CAS and mutual-friend access rules.
- No F3 name-card redesign, F4 comparison shell, F5 cheers or F6 effects were added.

## Evidence

- The canonical Git working tree is clean at the supplied commit.
- `git show --check a3f1f00756fadb092c3ddf7accb4cc783cd2d8b1` completed without reported whitespace errors.
- `firebase/database.rules.json` parsed successfully with PowerShell `ConvertFrom-Json` during this review.
- User-reported: `npx tsc --noEmit` clean and `npm run build` clean. These were not rerun by the verifier.
- User-reported: lint produced 32 problems (22 errors, 10 warnings), described as Prettier and refresh warnings. This is a reported failed lint result, not proof of an F2 runtime defect; no broad formatting rewrite was made.
- User-reported: Firebase rules were updated in the console. This is publication evidence supplied by Shine, not independently observed authorization-path evidence.
- No live two-account friend flow, card publication, opt-out, photo, race, new-device, or deletion/resume result was supplied. No live cloud data was modified by this review.

## Open verification item

After deploying this commit with the full cumulative R2 rules, use two disposable accounts and record observed results for: first sharing preview and Not now; name/glyph confirmation; opt-in uploaded photo versus Google photo exclusion; card publication and server age; second-account refresh and closed cover; opt-out while another tab is open; name/photo choice revision changes; Update now after study/sync readiness; stale settings/card/photo revision behavior; account switch/new-device review; and card/photo removal after friendship removal or blocked access. Check 390 px/desktop layout, scrollable consent dialog, keyboard focus, and that lesson sync remains unaffected.

Do not call the rules or privacy paths verified from source inspection, a clean build, or the F1 screenshot alone. Do not test deletion on data that should be kept.

## Phase history

- 2026-11-05: F1 implementation reviewed in the working copy; static review found no micro-fix, while second-account/live rules testing remained pending.
- 2026-11-05/06: F2 commit `a3f1f00756fadb092c3ddf7accb4cc783cd2d8b1` reviewed from `F:\Kiroku`; static checks passed, live friend testing remains pending.
