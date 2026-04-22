# Phase 2.2 Completion & Phase 2.3 TODOs

## Phase 2.2: Complete

### Rebranding (Complete)
- COT 4400 → COP 4600 (7 files: index.html, router.tsx, AppTop.tsx, FinalExamPage.tsx, package.json, backup.ts, db.ts)
- Analysis of Algorithms → Operating Systems (AppTop.tsx, PseudocodeQuestion.tsx)
- cot4400-study-hub → cop4600-study-hub (package.json, backup.ts, db.ts)
- Algorithms Study Hub → Operating Systems Study Hub (no direct references found)

### build-kb.ts Updates (Complete)
- Changed `isExamPrep` unit check: `"08-exam-prep"` → `"07-exam-prep"`
- Cleared PREREQUISITES array: all AOA-specific prerequisite edges removed; placeholder for OS rebuilding

### Viz Component Stripping (Complete)
- Deleted exports from 13 AOA-specific viz components (AsymptoticPlotter, BstViz, ClosestPair, DpGrid, GraphSandbox, HashTableViz, HeapViz, HuffmanViz, LoopInvariantViz, MasterTheoremCalculator, RecursionTree, SortAnimator, TowerOfHanoi)
- Replaced `src/components/viz/index.tsx` with empty stubs returning undefined for all vizFor() calls
- AlgorithmPage.tsx gracefully handles viz=undefined, so no dangling references

### Data Files (Complete)
- `src/data/final-exam-bank.ts`: Emptied exported array, preserved TypeScript structure for Phase 2.3 rebuild

### Pages Updates (Complete)
- HubPage.tsx: Replaced all AOA-specific content (asymptotic, sorting, graph algorithms) with OS-friendly teaser (scheduling, memory management, synchronization, file systems)
- TrapsPage.tsx: No changes needed; dynamically loads from KB (common-exam-traps.md)
- FinalExamPage.tsx: No changes needed; generic question modes and types work with any KB content

### Unit Labels & Map (Complete)
- Updated kb-loader.ts UNIT_LABELS: mapped AOA units to OS units
  - 01-recursion → 01-processes (Processes & Threads)
  - 02-divide-and-conquer → 02-scheduling (CPU Scheduling)
  - 03-sorting → 03-memory (Memory Management)
  - 04-data-structures → 04-paging (Paging & VM)
  - 05-greedy → 05-sync (Synchronization)
  - 06-dynamic-programming → 06-deadlock (Deadlock)
  - 07-graph-algorithms → 07-io (I/O & File Systems)
  - 08-exam-prep → 07-exam-prep (Exam Prep)
- Updated MapPage.tsx unit color mappings to match

---

## Phase 2.3: TODOs

### Rebuild Prerequisite Graph
- File: `scripts/build-kb.ts`, lines ~434-484
- Current: PREREQUISITES array is empty
- Action: Fill with OS topic prerequisites based on actual KB structure
  - Example: 01-processes/threads → 02-scheduling/fifo
  - Example: 02-scheduling → 05-sync/mutexes
  - Example: 03-memory/paging → 04-paging/tlb
  - Parse ../kb/**/*.md and build edges dynamically, OR hand-author for exam prep

### Rebuild Viz Catalog
- File: `src/components/viz/index.tsx` — currently empty stubs
- Action: Recreate VIZ_FOR_TOPIC and VIZ_CATALOG for OS topics
  - Consider: process state diagrams, page table walks, scheduling gantt charts, deadlock detection graphs
  - Import/create new viz components matching OS semantics
  - Update VizPage.tsx if needed (currently displays VIZ_CATALOG, will render empty until rebuilt)

### Rebuild Final Exam Bank
- File: `src/data/final-exam-bank.ts`
- Current: Empty array
- Action: Hand-author or programmatically generate final exam problems for OS
  - Reference: ../kb/07-exam-prep/ may contain sample problems
  - Respect question kinds: "mcq", "short", "code", "proof" (as defined in type)

### Test KB Build
- Prerequisite: OS KB markdown files must exist in ../kb/ with unit structure (00-foundations, 01-processes, ..., 07-exam-prep)
- Action: `cd app && bun install && bun run kb`
- Expected output: 
  - kb.json populated with topics
  - graph.json with prerequisite edges (from rebuilt PREREQUISITES)
  - flashcards.json, quizzes.json, rubrics.json, traces.json auto-generated

### Address Hardcoded AOA Content
- TracePlayer.tsx, Pseudocode.tsx, ComplexityCard.tsx: These are generic and work with any KB
- PracticePage.tsx, QuizPage.tsx: Check for AOA-specific question types (may need new question kinds for OS)

### Unit Colors in MapPage
- Current mapping in MapPage.tsx UNIT_COLORS is placeholder oklch values
- Future: Customize colors for OS units if desired (current setup will work fine)

---

## Notes on Skipped Changes

1. **AlgorithmPage.tsx**: Not renamed to TopicPage.tsx. Router path `/algorithms/$` kept for stability; component name left as-is. 
   - Rationale: Changing router path could break deep links; semantics are generic enough

2. **VizPage.tsx**: Left intact. When VIZ_CATALOG is rebuilt, it will auto-populate the gallery.

3. **Features folder** (agenda, practice, study-session, syllabus): No changes; all are generic

4. **Stores, lib/keyboard, lib/srs, lib/mastery**: No AOA-specific content detected; unchanged

---

## Files Modified (Summary)

- index.html
- package.json
- vite.config.ts
- tsconfig.json, tsconfig.app.json, tsconfig.node.json
- src/router.tsx
- src/components/chrome/AppTop.tsx
- src/components/viz/index.tsx (replaced entirely)
- src/data/final-exam-bank.ts (emptied)
- src/lib/kb-loader.ts (UNIT_LABELS, UNIT_COLORS)
- src/lib/backup.ts (cot4400 → cop4600)
- src/lib/db.ts (cot4400 → cop4600)
- src/pages/HubPage.tsx (OS teaser content)
- src/pages/MapPage.tsx (unit name mappings)
- src/features/practice/PseudocodeQuestion.tsx (prompt text)
- scripts/build-kb.ts (isExamPrep unit check, PREREQUISITES cleared)

---

## Next Steps for Phase 2.3

1. Verify OS KB exists at ../kb/ with correct unit structure
2. Rebuild PREREQUISITES graph (or leave empty if KB not yet stable)
3. Run `bun run kb` to generate compiled JSON
4. Rebuild viz catalog with OS-specific visualizations
5. Populate final-exam-bank.ts with OS problems
6. Test `bun run typecheck` and `bun run dev`
