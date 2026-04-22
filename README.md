# COP 4600 · Final Exam Prep

A local-first, offline study app for Operating Systems (USF, Spring 2026).
Runs entirely in the browser, talks to nothing external except an optional
local Ollama instance for deep Feynman feedback. All progress lives in
IndexedDB.

The knowledge base is authored as markdown under `kb/` and compiled into JSON
bundles the app reads at boot. Every topic has sections, pseudocode, traces,
quiz questions, and rubrics pulled from the same source of truth.

---

## Design philosophy

This app exists because I learn badly from walls of slides and well from
structured retrieval. These are the principles it's built on — they're also
the rules any new feature has to respect.

**One concept at a time, not a wall of slides.** Each topic is a *stepper*:
one section per screen with a "Got it · next" button. No single page dumps the
definition, mechanism, hand-trace, complexity table, gotchas, and sources at
once. You decide when to move on.

**Teach-back and test-back, on a rhythm.** After every two teach screens
there's a mandatory two-question check-in. Every three teach screens there's a
short Feynman prompt — explain the mechanism in your own words, two sentences
is fine. At the end of a topic: a larger Feynman workbench and a full topic
quiz. Retrieval is what makes study feel real; reading is not learning.

**Coherent flow over fragmented tools.** Everything chains. Finish a topic →
next topic in the unit. Finish the last topic → chapter quiz. Score under 70%
→ back to the weakest topic's stepper. Every page should answer "what now?" —
dead ends are bugs.

**Map for navigation, stepper for doing.** `/map` is a dependency graph of
the whole course. Clicking a node opens a side panel with "Start learning"
(stepper) and "Full reference" (all-in-one topic page). The map picks *what*;
the stepper is where the learning happens.

**Mastery is a ladder, not a score.** Zero through five:
`fresh → seen → recognized → applied → explained → mastered`. Two correct in
a row nudges you up; a confident wrong answer pulls you down two. It's a
position, not a grinding metric.

**Offline-first.** Airplane mode works. Nothing about the core flow requires
a network. Ollama is opt-in and scoped to "extra" feedback on Feynman
explanations.

**Notebook tone.** Lowercase eyebrows, serif italic side-notes, JetBrains
Mono for metadata, hand-drawn highlighter accents. It should feel like
working in a nice notebook, not clicking through an LMS.

---

## The learning flow

1. **`/map`** — see the course as a graph. Click a topic to open the side
   panel.
2. **`/learn/:slug`** — the stepper. One section per screen, check-ins every
   two, explain-backs every three, big Feynman + topic quiz at the end.
   Completion surfaces the next topic, or the chapter quiz if the unit is
   done.
3. **`/module/:id/quiz`** — chapter quiz. Questions pulled round-robin
   across every topic in the unit, sized quick / medium / full.
4. **`/review`** — spaced-review queue. Weakest and least-recently-reviewed
   topics come up first.
5. **`/feynman`** — standalone Feynman workbench for deep teach-back on a
   single topic. Optional Ollama feedback.
6. **`/debrief`** — post-session summary. Shows mastery movement and points
   at the weakest spot.
7. **`/final`** — mock final exam simulator, 75-minute target, mixed across
   all units.
8. **`/viz`** — visualization catalog. Interactive schedulers, page-table
   walkers, TLB simulator, lock primitives, disk scheduler, RAID layout,
   inode index.

## Unit map

`00-foundations` (5) — what an OS is, virtualization, user/kernel mode,
traps, limited direct execution.
`01-processes` (6) — the process abstraction, address space, fork/exec/wait,
zombies & orphans, context switch, shell redirection.
`02-scheduling` (8) — metrics, FIFO, SJF, STCF, RR, MLFQ, lottery/stride,
CFS.
`03-memory` (12) — malloc API, base and bounds, segmentation, paging
basics/math, TLB, multi-level page tables, inverted tables, swap, page
replacement, thrashing.
`04-concurrency` (20) — threads, races, locks (TAS/CAS/LL-SC/ticket/TTAS/
futex), two-phase, sloppy counter, concurrent DS, condition variables,
producer-consumer, semaphores, reader-writer + preference.
`05-deadlock` (11) — four conditions, four preventions, avoidance,
detection/recovery, dining philosophers, atomicity/order violations,
livelock.
`06-persistence` (20) — PIO/DMA, IDE, HDD mechanics, disk scheduling, RAID,
files/dirs, FD/open-file/inode tables, inodes + multi-level index, links,
FFS, I/O counts, fsync, crash consistency, fsck, journaling modes,
transactions, revoke records, SSDs/FTL.
`07-exam-prep` (6) — cumulative problem sets and two mock finals.

## Running it

```bash
cd app
npm install
npm run kb        # compile kb/ markdown → src/data/*.json
npm run dev       # start the Vite dev server (http://localhost:5173)
```

All data stays on the machine (IndexedDB via Dexie). To wipe progress, clear
the site's local storage in the browser.

Bun works too if you prefer — `bun install && bun kb && bun dev`. The
`scripts/build-kb.ts` script runs under either runtime via
`--experimental-strip-types`.

## Ollama (optional)

With Ollama running locally (`ollama serve` on `http://localhost:11434`),
turn it on in `/settings`. The Feynman page will stream tutor-style feedback
on top of the offline rubric grade. Everything else works without it.

## Adding content

- **New topic** — create `kb/<unit>/<slug>.md` using the topic schema (H1
  title + `## Definition`, `## When to use`, `## Key ideas`, `## Pseudocode`
  or `## Hand-trace example` as appropriate, `## Common exam questions`,
  `## Gotchas`, `## Sources`). Add prereq edges to `kb/prereqs.json`. Run
  `npm run kb`.
- **New visualization** — add to `src/components/viz/`, register in
  `viz/index.tsx → VIZ_FOR_TOPIC`.
- **New quiz question** — either author under "Common exam questions" in
  the topic markdown (the kb builder emits MCQ/short automatically) or
  append to `src/data/final-exam-bank.ts` for hand-crafted scenario
  prompts.

## Stack

Vite · React 19 · TypeScript · TanStack Router · Zustand · Dexie
(IndexedDB) · Tailwind v4 · @xyflow/react · recharts · d3 · katex ·
lucide-react · motion · mermaid. Knowledge base compiled from markdown at
build time.

## License

Personal study project. Course content is paraphrased for my own use — if
you're a USF student or instructor and want something changed or taken
down, open an issue.
