# Pipeline Sync Lab

A clean-room, fully client-side demo of **initial and incremental ingestion between two data
stores**, with revision checkpoints and document linkage. It is published as a single static page
(`https://prodax-pipeline.pages.dev`) and runs entirely in the browser.

The page is a **technique demo**, not a product and not a copy of any real pipeline. It exists to
show how a two-store sync behaves, and how a reviewer can verify that behaviour in one click.

---

## Provenance of the data

Every record, value, document and log line in this repository is **invented for this demo**.

- The six source records describe observations on an imaginary survey network
  (`SYN-SITE-ORBITAL-01`, `SYN-SITE-MERIDIAN-04`, `SYN-SITE-LATITUDE-07`, ...).
- The four documents are short synthetic notes written for this page.
- No client, employer, personal or otherwise real dataset is present, and no schema, field-name
  set, code or workflow configuration was copied from any external system. The implementation was
  written from scratch against the demo's own specification.

The page states this in a visible **Synthetic data** notice, and the same statement is repeated in
the footer.

## Scope and honesty statement

- This is **not** a production pipeline. It demonstrates ingestion technique only; it has no
  scheduler, no queue, no back-pressure, no retries, no schema registry and no scale claims.
- The volumes are deliberately tiny (6 source rows) so that every count on screen can be checked
  by hand.
- The demo stores nothing: no cookies, no local storage, no network calls, no backend.

---

## Run it

```bash
npm ci                 # clean install from the lockfile
npm run dev            # local dev server
npm run build          # typecheck + production build into dist/
npm run preview        # serve the built dist/ on http://127.0.0.1:4101
```

## Verify it

```bash
npm run verify
```

`verify` runs the whole gate in order:

| Step | Command | What it proves |
|---|---|---|
| 1 | `npm run typecheck` | `tsc --noEmit` is clean |
| 2 | `npm run test` | Vitest unit tests pin every domain behaviour |
| 3 | `npm run build` | typecheck + Vite production build into `dist/` |
| 4 | `npm run test:e2e` | Playwright drives system Chrome against a Vite preview server on port `4101` |
| 5 | `node scripts/verify-build.mjs` | exactly one `dist/index.html`, non-empty JS/CSS bundles, demo marker present |

The final step prints `VERIFY_OK prodax-pipeline`.

Individual commands:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright uses the **installed system Chrome** (`channel: "chrome"`), so no browser download is
required. The preview server is started by Playwright with `reuseExistingServer: false` on
`http://127.0.0.1:4101`.

---

## Architecture

```
src/
  data.ts          authored, frozen synthetic fixtures (types + records + documents)
  domain.ts        pure sync logic: runInitialLoad, applyIncremental, simulateSourceChanges,
                   resetDemo, and the checkpoint / document selectors
  domain.test.ts   Vitest unit tests pinning every count and every invariant
  App.tsx          interactive lab UI (React)
  main.tsx         React entry point
  styles.css       responsive dark lab styling
tests/
  demo.spec.ts     Playwright: full run sequence, document inspection, reset,
                   390px overflow, axe accessibility, no non-local request
scripts/
  verify-build.mjs static-build gate
```

### Domain model

| Concept | Meaning |
|---|---|
| Source register | The side that changes. Holds observed asset rows with a `revision`. |
| Target store | The side that is ingested. Holds the rows currently in sync. |
| `recordId` | Stable identity of a row across both stores. |
| `revision` | Monotonic version of a source row. Bumped whenever the row is edited. |
| `documentId` | Link from a row to the synthetic document that supports it. |
| Checkpoint | `runNumber` (runs since reset) and `revisionWatermark` (highest revision held). |

### Sync rules

- **`runInitialLoad`** rebuilds the target store from the whole source register. Every source row
  is *inserted*; nothing is updated or skipped.
- **`applyIncremental`** compares source rows against target rows on `recordId` + `revision`:
  - unknown `recordId` → **inserted**
  - `revision` advanced → **updated**
  - `revision` did not move → **skipped** (the stored row is left untouched)
- **`simulateSourceChanges`** revises two existing records and adds one new record together with
  one new document. It is derived from the authored fixtures, so applying it twice produces the
  same source register.
- **`resetDemo`** restores the initial pre-run state: six source records, three documents, an
  empty target store, an empty log and checkpoint `run 0 / rev 0`.

All domain functions are pure. They return a new state object, they never mutate their input, and
the frozen fixture constants in `src/data.ts` are never mutated — a unit test asserts this.

### Expected counts

| Step | Inserted | Updated | Skipped | Target rows | Source records | Documents |
|---|---:|---:|---:|---:|---:|---:|
| Initial load | 6 | 0 | 0 | 6 | 6 | 3 |
| Simulate source changes | - | - | - | 6 | 7 | 4 |
| First incremental sync | 1 | 2 | 4 | 7 | 7 | 4 |
| Second incremental sync | 0 | 0 | 7 | 7 | 7 | 4 |
| Reset demo | 0 | 0 | 0 | 0 | 6 | 3 |

---

## Demo contract

- `index.html` carries the fixed marker `<meta name="dual-orbit:demo" content="prodax-pipeline">`.
- The build is a plain static bundle: one `dist/index.html` plus hashed JS/CSS assets. It can be
  served from any static host.
- The page makes **no** request to a non-local origin at runtime; a Playwright test asserts this.
- The layout has no horizontal overflow at 390px and no serious or critical axe violations; both
  are asserted in the browser test.
