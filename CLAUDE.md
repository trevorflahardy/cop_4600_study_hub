# CLAUDE.md — COP 4600 Final Exam Prep

Notes for any Claude agent working on this repo.

## What this is

A self-contained study hub for USF's COP 4600 Operating Systems final exam,
Spring 2026. Cloned and adapted from the COT 4400 Analysis of Algorithms hub
next door (`../COT 4400 Analysis of Algorithms/exams/final_exam_prep/`).

The app is a Vite + React 19 + TypeScript + Tailwind v4 + Dexie + TanStack
Router SPA. All user progress lives in IndexedDB. No server, no cloud sync.

## Repo layout

```
kb/                     — markdown knowledge base (source of truth)
  00-foundations/       — unit folders, one .md per topic
  01-processes/
  02-scheduling/
  03-memory/
  04-concurrency/
  05-deadlock/
  06-persistence/
  07-exam-prep/         — cumulative problem sets + mock finals
  INVENTORY.md          — materials-and-question-shapes snapshot
  MEMORY.md             — master index used by humans and agents
  prereqs.json          — DAG of topic prerequisites

app/                    — the SPA
  scripts/build-kb.ts   — markdown → src/data/*.json compiler
  src/components/       — notebook primitives + viz catalog
  src/components/viz/   — interactive OS visualizations (one per concept)
  src/data/             — compiled KB JSON + hand-authored final-exam-bank.ts
  src/features/         — agenda, practice, study-session, syllabus
  src/lib/              — db (Dexie), kb-loader, mastery, srs, ollama
  src/pages/            — top-level routes
  src/router.tsx        — TanStack Router config
  src/stores/           — Zustand stores (session, settings)
  src/styles/           — globals.css + notebook.css

README.md               — user-facing docs
CLAUDE.md               — this file
```

## Ground rules

**No emojis anywhere.** Not in markdown, not in UI copy, not in code
comments. The notebook aesthetic is deliberate — lowercase eyebrows, serif
italic side-notes, JetBrains Mono for metadata, hand-drawn highlighter
accents.

**KB is the source of truth.** Don't put quiz questions or trace tables in
`src/data/*.json` by hand — put them in the markdown and let `build-kb.ts`
extract them. The only hand-authored data file is `src/data/final-exam-bank.ts`
for cross-topic scenario prompts.

**Every topic page must not be a dead end.** Finish a topic → next topic in
the unit. Finish the unit → chapter quiz. Score low → back to weakest topic.
If you add a page that leaves the user unsure what to do next, it's a bug.

**Mastery ladder is 0–5.** Two correct in a row nudges up; a confident wrong
answer pulls down two. Don't invent new mastery semantics — extend the
existing `MasteryLevel` type in `src/lib/db.ts`.

## Topic schema

Every topic markdown must have:

- `# Title` (one H1)
- `## Definition` (required — the kb parser checks for it on non-exam-prep
  topics)
- At least three H2 sections total
- Ideally also: `## When to use`, `## Key ideas`, `## Pseudocode`,
  `## Hand-trace example`, `## Complexity` or `## Mechanism`,
  `## Common exam questions`, `## Gotchas`, `## Sources`

The parser is forgiving about optional sections but strict about Definition +
3 H2 minimum. Files under `kb/07-exam-prep/` are study guides, not algorithm
entries, and the parser skips the Definition check for them (see
`isExamPrep` in `scripts/build-kb.ts`).

## Adding a topic

1. Author `kb/<unit>/<slug>.md` following the schema.
2. Add prereq edges to `kb/prereqs.json` under `topics[<slug>].prereqs`.
3. If the topic has a good interactive viz, build it in
   `src/components/viz/<Name>.tsx` and register in
   `src/components/viz/index.tsx → VIZ_FOR_TOPIC`.
4. Run `npm run kb` (or `bun kb`) to recompile. The dev server picks up
   changes on the next boot.

## Adding a viz

- One file per viz in `src/components/viz/`.
- Default to interactive controls (sliders, step buttons, play/pause). Static
  images don't earn their place.
- Use the notebook primitives from `@/components/notebook` (`Frame`,
  `Eyebrow`, `Chip`, `Button`, `MiniLabel`) — don't roll your own layout.
- Deterministic: same inputs → same output. Seed RNG if you need randomness.
- Keep internal state with `useState` / `useReducer` — never touch Dexie from
  a viz.

Current OS viz catalog:

- `SchedulerAnimator` (FIFO/SJF/STCF/RR/MLFQ/CFS)
- `PageTableWalk` (single or two-level)
- `TlbSimulator`
- `LockSimulator` (TAS/CAS/Ticket)
- `DiskScheduler` (FCFS/SSTF/SCAN/C-SCAN)
- `RaidLayout` (0/1/4/5)
- `InodeLayout`

## Adding a quiz question

Two paths:

**Auto-extracted from markdown.** Add a bullet under `## Common exam
questions` in the topic. The builder turns it into a short-answer prompt.
This is the fastest path and keeps everything in one place.

**Hand-authored scenario / MCQ.** Append an entry to
`src/data/final-exam-bank.ts` (type `KbQuizQuestion[]`). Use `kind: "mcq"`,
`"short"`, or `"scenario"`. The OS hub does not currently use `"graph-walk"`,
`"pseudocode"`, or `"runtime"` (those are AOA infrastructure left dormant).

## Running locally

```bash
cd app
npm install
npm run kb            # compile kb/ → src/data/*.json
npm run dev           # Vite dev server on http://localhost:5173
npm run typecheck     # tsc -b --noEmit (run before committing)
npm run build         # production build
```

Bun also works if installed. The `scripts/build-kb.ts` uses `node
--experimental-strip-types` when run through `npm run kb`.

## Things that matter during development

- Run `npm run typecheck` before declaring work done. The app's strict mode
  is non-negotiable.
- After any KB change, re-run `npm run kb` or the app will still load the
  old compiled JSON.
- If you add a new unit slug, update `UNIT_LABELS` in `src/lib/kb-loader.ts`
  AND `UNIT_COLORS` in `src/pages/MapPage.tsx`.
- `kb/MEMORY.md` is the human-facing index. If you add or remove topics,
  update it by hand — the builder does not regenerate MEMORY.md.
- `kb/INVENTORY.md` is a one-time snapshot taken during Phase 1 and is
  excluded from the build walk. Don't try to keep it in sync with reality
  automatically.

## Known dormant surfaces

These were cloned from AOA and left in place because removing them would
mean rewriting scaffolding that might be useful later. They're inert when
no questions of those kinds exist in the bank:

- `src/features/practice/GraphWalkQuestion.tsx` (BFS/DFS/Dijkstra graph
  walk question renderer)
- `src/features/practice/PseudocodeQuestion.tsx` (pseudocode-grading
  question renderer)
- `src/features/practice/RuntimeQuestion.tsx` (complexity-bound fill-in
  question renderer)
- `src/components/viz/{AsymptoticPlotter,BstViz,ClosestPair,DpGrid,
  GraphSandbox,HashTableViz,HeapViz,HuffmanViz,LoopInvariantViz,
  MasterTheoremCalculator,RecursionTree,SortAnimator,TowerOfHanoi}.tsx` —
  stubbed to `return null`. Safe to delete once you're sure nothing wants
  them back.

## Reference

The AOA hub next door is the architectural template. When unsure about the
shape of a feature, check the equivalent file at
`../COT 4400 Analysis of Algorithms/exams/final_exam_prep/app/src/...`.

OSTEP (Arpaci-Dusseau) is the course textbook. Lecture decks, TA chapters
(Zhang), past midterms, and in-class quizzes live under `../lectures/`,
`../zhang/`, `../past_exams/`, and `../quizzes/` in the COP 4600 folder.
