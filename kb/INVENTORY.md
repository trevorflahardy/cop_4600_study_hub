# COP 4600 OS Study Hub — KB Inventory

**Status:** Phase 1.1 (Discovery). Working document. Not compiled.
**Course:** COP 4600.002, USF Spring 2026, cumulative final prep with post-MT2 emphasis.
**Textbook:** *Operating Systems: Three Easy Pieces* (Arpaci-Dusseau), a.k.a. OSTEP.
**Destination of compiled KB:** `kb/*.md` → `bun kb` → `kb.json`, `graph.json`, `flashcards.json`, `quizzes.json`, `rubrics.json`, `traces.json`.

---

## 1. Materials inventory

All paths below are relative to the course root `.../COP 4600 Operating Systems/`. Text extractions used by the author agent live under `.../outputs/cop4600_extracted/`.

### 1.1 Course reference
- `cop4600-syllabus-spring2026.txt` — 14-week schedule. Week 14 caps out at FSCK + Flash SSDs; final is cumulative in Week 16. Grading: 5% attendance + 25% projects + 40% midterms + 30% final.
- `Operating Systems - Three Easy Pieces` (OSTEP) — full textbook dump; canonical source for virtualization, concurrency, persistence.

### 1.2 TA-authored (Zhang) chapter notes — the deep-concurrency bedrock
- `zhang/Chapter 26-27` — Concurrency intro, threads, race conditions, atomicity, critical sections.
- `zhang/Chapter 28 Locks v6` — Spin locks, TAS, CAS, LL/SC, ticket lock (FetchAndAdd), TTAS, two-phase locks.
- `zhang/Chapter 29 Lock-based Concurrent Data Structures v2` — Sloppy counter (threshold S), per-node linked-list lock, CAS-based lock-free insert, hand-over-hand locking.
- `zhang/Chapter 30 Condition Variables v2` — `thread_join` attempts 1/2/correct, producer/consumer progressions (single CV+if broken → single CV+while still broken → two CVs correct), covering conditions + `pthread_cond_broadcast`, Mesa vs Hoare semantics, 4 deadlock conditions.
- `zhang/Chapter 31 Semaphores v2` — sem_wait/post, binary semaphore as lock (init 1) vs ordering (init 0), producer/consumer with `empty(BSIZE) + full(0) + mutex`.
- `zhang/Chapter 32 Common Concurrency Problems v2` — Atomicity violation (`fputs proc_info`), order violation (`mThread` init before use), deadlock prevention by condition (circular wait → lock ordering by address; hold-and-wait → prevention lock; no preemption → trylock + backoff → livelock with random delay; mutual exclusion → lock-free `__sync_bool_compare_and_swap`), deadlock avoidance via scheduling, detect-and-recover.
- `zhang/Reader-Writer Problem with Condition Variables` — Reader-priority, writer-priority, dining philosophers odd/even ordering.

### 1.3 TA review decks
- `zhang/Concurrency Review S26` / `lectures/Concurrency Review S26` — thread vs process (shares addr space/heap/globals/FDs; owns PC/stack/registers), faster thread switch (no page table change), lock APIs, CV wait/signal pattern, 3 sync problems.
- `lectures/Persistence Review v2` — PIO vs DMA, `I/O time = T_seek + T_rotation + T_transfer`, file/inode/dir, FD table → open file table → in-memory inode cache, superblock/inode table/data blocks/bitmaps, hard vs symlinks, `dup()` shares file offset, `open("/foo/bar")` = 5 reads, `create` = 4R + 4W, each allocating write = 5 I/Os, `write()` vs `fsync()`, journaling (write-ahead log + commit record).
- `exams/exam_2_prep/Midterm 2 Review.txt` (42 pages) — the most comprehensive concurrency review: lock primitives, CV rules, producer/consumer, reader-writer (both preferences), deadlock 4 conditions, dining philosophers basic + odd/even + N-1 seat limit.

### 1.4 Live lecture decks (`lectures/Week*.pdf`) — primary source
These are what was actually shown in class. Mined in full. Every topic below must cite the relevant lecture file(s) in its `Sources:` section.

- **`OS_intro_Spring26.txt`** — Course admin only. Note: this deck lists grading as 25% projects / 20% × 2 midterms / 30% final / 5% quizzes, which differs from the published syllabus (40% midterms + 30% final + 25% projects + 5% attendance). Treat the syllabus as authoritative; flag the discrepancy in `07-exam-prep`.
- **`Week1.txt`** (Foundations) — OS role, `cpu.c` / `mem.c` / `thread.c` live-code demos. Specific runs: `mem.c` prints same `0x00200000` across two processes; `thread.c` with `loops=100000` prints 143012 and 137298 instead of 200000.
- **`Week2_1.txt`** (Processes) — xv6 `struct proc` and `struct context`; live `fork` demo with PIDs 29146 → 29147; `wait` blocking parent; `exec` with `wc`; redirection via `open` + `close(STDOUT)`; process state diagram Running / Ready / Blocked; 0-16 KB text → data → heap → stack layout.
- **`Week2_2.txt`** (LDE) — Full xv6 `swtch()` assembly (save eax/ebx/ecx/edx/esi/edi/ebp/esp, switch stack, restore), trap table init, LDE protocol timeline, timer interrupts + disabling interrupts during handling.
- **`Week3_1.txt`** (Scheduling I) — Metrics, FIFO / SJF / STCF / RR. Signature examples: all-10s convoy → avg TAT 20s; late-arrival SJF (A=100s at t=0, B/C=10s at t=10) → 110s avg TAT if FIFO. MLFQ with 8 queues; Solaris with 60 queues (top = 20ms slice, bottom ≈ 1s, boost ≈ 1s). Mentions Solaris-style CFS: `sched_latency=48ms`, `min_granularity=6ms`, nice=-5 → weight=3121, nice=0 → weight=1024.
- **`Week3_2.txt`** (Scheduling II — proportional share) — Lottery (100 tickets, A=0-74, B=75-99), ticket transfer / inflation, stride = 10000 / tickets, example strides 100 / 200 / 40, unfairness `U = t1_finish / t2_finish`. Linux CFS red-black tree, 5% CPU overhead claim, example n=4 with nice=-5 → 36ms, nice=0 → 12ms out of 48ms `sched_latency`.
- **`Week4_1.txt`** (Memory I) — Address space layout on 64-bit Linux: code `0x400000`, data `0x401000`, heap `0xcf2000-0xd13000`, stack `0x7fff9ca28000-0x7fff9ca49000`. Malloc API errors: leak, dangling pointer, double-free, uninitialized read. `sizeof(int*) = 4`, `sizeof(int[10]) = 40`. Base-and-bounds with base=32 KB, bounds=48 KB.
- **`Week4_2.txt`** (Memory II) — Segmentation 128-byte physical / 64-byte virtual / 16-byte segments. Paging: 64-byte VAS, 16-byte pages → 4 VPNs; 32-bit VAS with 4 KB pages → 2²⁰ PTEs × 4 B = 4 MB linear PT. PTE fields: valid, protection, present, dirty, accessed. TLB hit/miss animation over a 10-element array access pattern. LRU and clock for replacement; thrashing.
- **`Week6_1.txt`** (Threads I) — Thread vs process address space (shared code/heap/globals; separate stacks). Counter race with default=50, two threads increment once each, expected 52 but 51 on lost update. Load / add / store decomposition.
- **`Week6_2.txt`** (Threads II — API) — `pthread_create`, `pthread_join`, `pthread_attr_init` (stack size, sched params, priority=10 example). LeetCode **print-in-order** problem introduced here.
- **`Week7_1.txt`** (Locks) — TAS, CAS, LL/SC, FetchAndAdd; ticket lock struct (`ticket` + `turn`); yield-on-held spinlock; queue-based / park-based locks. **Linux `futex`** introduced here (bit-31 flag for held, guard lock protecting queue, two-phase spin-then-sleep). This is a unique lecture-deck-only topic.
- **`Week7_2.txt`** (CVs) — Parent-child join via CV; producer / consumer bounded buffer with single CV trace (Tp, Tc1, Tc2) showing the broken case; then two-CV fix. **Allocate / free covering condition** worked example with `pthread_cond_broadcast`. Mesa vs Hoare explicit.
- **`Week8_1.txt`** (Semaphores) — sem_wait / sem_post table trace; parent-child semaphore patterns for both "parent waits before child" and "parent waits after child"; producer/consumer with `empty`, `full`, `mutex`; **reader-writer with `writelock`** (first reader acquires, last reader releases); reader starvation discussion; dining philosophers; **Zemaphore** (semaphore built from CV + mutex + count) — unique to this deck.
- **`Week9_1.txt`** (Deadlock) — MySQL/Apache/Mozilla/OpenOffice concurrency-bug study: 74 non-deadlock vs 31 deadlock. Atomicity violation (`proc_info`), order violation (`mThread` before init). Four conditions + prevention per condition. `trylock` + goto → **livelock** → fix with random delay. CAS-based lock-free atomic increment; CAS-based list insert: `do { n->next = head; } while(!CAS(&head, n->next, n))`. Deadlock avoidance with T1-T4 scheduling on CPU1/CPU2.
- **`Week11_1.txt`** (I/O devices) — Canonical device (status / command / data registers). IDE: I/O ports `0x1F0` (data), `0x1F1` (error), `0x1F2` (sector count), `0x1F3-0x1F5` (LBA), `0x1F6` (drive select), `0x1F7` (cmd/status), `0x3F6` (control). Status bits: BUSY, READY, FAULT, SEEK, DRQ, CORR, INDEX, ERROR. Polling (fast device) vs interrupts (slow device) vs DMA decision tree. Memory-mapped I/O vs dedicated I/O instructions.
- **`Week11_2.txt`** (HDDs) — Geometry (platters, spindle, tracks, heads, sectors), track skew. `T_I/O = T_seek + T_rotation + T_transfer`. **Cheetah 15K.5**: 4 ms seek, 2 ms rotation, 125 MB/s transfer. **Barracuda**: 9 ms seek, 4.2 ms rotation, 105 MB/s transfer. Random vs sequential gap: 0.66 MB/s vs 125 MB/s on Cheetah. SSTF / SPTF trade-off; track skew reasoning.
- **`Week12_1.txt`** (RAID) — Full performance table for RAID 0 / 1 / 4 / 5 across capacity, reliability, single-request latency, sequential / random read / write steady-state throughput. RAID-0 chunk size (2 blocks = 8 KB example). XOR parity. RAID-4 small-write problem → RAID-5 rotating parity.
- **`Week12_2.txt`** (Files & Directories) — Directory hierarchy, `stat` struct fields (mode / inode / nlink / size / timestamps), hard link ref-count trace (inode 67158084, nlink=1 → 2 → 3 → 1 after `unlink`), symlinks as separate file type, `mount`. 4 KB common block size referenced.
- **`Week13_1.txt`** (FS Implementation — OSTEP Ch. 40) — On-disk structures: superblock, inode + data bitmaps, inode table (256-byte inodes, 16 per 4-KB block), data blocks. **Multi-level index** in the inode: 12 direct pointers + 1 single indirect + 1 double indirect → max file size math. Directories as `(inode, name)` pairs. I/O timeline for `open("/foo/bar/baz")`, `read`, `write` with explicit per-step bitmap / inode / data reads and writes. Measurements: most-common file size 2 KB, avg ≈ 200 KB, ~100K files per FS, ~50% fullness, dirs usually < 20 entries.
- **`Week13_2.txt`** (FFS — OSTEP Ch. 41) — Cylinder groups (block groups) with per-group superblock / bitmaps / inode table. Placement policy: directories → groups with low dir count + high free inodes; files → same group as parent inode; large-file exception (chunked across groups to preserve locality for small files). Access-distance distribution from SEER trace: 7% same file, 40% same directory, 25% two-hop, 80% within distance 2. **Amortization calculation**: 40 MB/s bandwidth, 10 ms positioning → 409.6 KB optimal chunk; 3.69 MB chunk → 99% of peak. Sub-blocks for small files and symlinks.
- **`Week14_1.txt`** (Crash consistency — FSCK + Journaling, OSTEP Ch. 42) — Six crash scenarios (single / double / triple write failures on inode + bitmap + data) showing leaked block, orphaned inode, corrupted file, garbage read. FSCK scans superblock, free blocks, inodes, links, duplicates, bad pointers, directories → rebuilds consistency but requires full-disk scan. Journaling via write-ahead log: transaction = `TxB` (begin, TID) + data/metadata blocks + `TxE` (commit). Three modes: **data journaling** (all blocks to log, then checkpoint), **metadata journaling** (metadata to log, data straight to FS), **ordered journaling** (data first, then metadata via journal). Circular log with journal superblock tracking oldest / newest, 5-second batching. **Revoke records** handle the block-reuse edge case on replay. Ext2 vs Ext3 layout comparison. `sizeof(sector) = 512` atomicity assumption for TxE.

### 1.5 Lecture C source files (`lectures/*.c`)
Real code the class ran. Use as canonical pseudocode references (and lift verbatim into topic "Pseudocode" sections where they already match the OSTEP shape).
- `lecture9_1.c` — `pthread_create` / `pthread_join` with struct pointer return; child returns malloc'd struct with `val+1`.
- `lecture9_2.c` — Multi-threaded counter increment with `pthread_mutex_lock/unlock` — the canonical fix to the race from Week 1 and Week 6_1.
- `lecture11_a.c` — Single-slot producer-consumer without synchronization; `put` asserts `count==0`, `get` asserts `count==1` (unsafe).
- `lecture11_b.c` — Producer + two consumers bounded buffer with `pthread_mutex` and two CVs (`cond1` = empty, `cond2` = full), `while`-loop recheck. Canonical Mesa-style producer/consumer.
- `print_in_order.c` — LeetCode-style ordering: three threads first → second → third using two CVs + ready flags. The canonical CV-ordering example referenced in Week 6_2 and Week 7_2.

### 1.6 Past exams (with keys when available)
- `exams/exam_1_prep/` — S25 MT1 versions A/B/C with answer keys, S24 MT1 v2, Midterm 1 Practice + Answers. Shapes: T/F, MCQ, base-and-bounds, MLFQ rules 4/5, CFS weighted slice + vruntime, FIFO/SJF/STCF Gantt + TAT/RT, paging math.
- `exams/exam_2_prep/` — MT2 Practice + Solution, Midterm 2 Review. Shapes: race decomposition, broken flag lock, TAS lock, spurious-wakeup fix, 3-binary-semaphore ordering enumeration, `vector_add` deadlock.
- `exams/exam_1.txt` (S25 MT1 Makeup, handwritten OCR) — 40 T/F + 5 short answer: Gantt for SJF/STCF/RR(q=2), MLFQ with Q1 RR=8, Q2 RR=12, Q3 FCFS event-by-event trace, 2-level PT with 38-bit VA, 16 KiB pages, 4-byte PDE/PTE, TLB + 5-level PT access counts (1, 3, 5, 7, 9, 11), page replacement on 18-access sequence (Optimal / FIFO / LRU).
- `exams/exam_2.txt` (S26 MT2 Makeup, handwritten OCR) — 5 select-all (thread ctx switch, not-shared fields, atomic primitives, mutex properties, deadlock/livelock/starvation) + 7 short answer (CV signal with mutex, spurious wakeups, single-core spinlock vs blocking, 2-semaphore ordering outputs A1/A2/B1/B2, `arr[idx++]` race, alternative TAS spinlock correctness, `thread_join` lost wakeup, trylock livelock vs deadlock, producer/consumer with mutex outside sem → deadlock fix).

### 1.7 Attendance quizzes (S26)
- **Quiz 1, 4 keys** — Image-only PDFs; no extractable text. Ignore for content mining.
- **Quiz 2 (Scheduling)** — A=0/3, B=1/6, C=4/4, D=6/2 across FCFS/SJF/STCF/RR(q=2). Tiebreak: "new job enqueued first, then preempted job goes to tail."
- **Quiz 3 (Scheduling T/F + select-all)** — Preemptive = {C, D, E}; gaming MLFQ = yielding just before time slice; CFS deterministic, Lottery probabilistic.
- **Quiz 5 (TLB + paging)** — TLB Miss ≠ Page Fault; ASID tag; huge pages → TLB coverage↑; 16-bit VA, 256 B page, 2 B PTE → VPN = `0x4F`, offset = `0x3A`, PTE @ `0x209E`. Memory accesses per instruction with TLB + 2-level PT: non-memory {1, 3}; memory {2, 4, 6}.
- **Quiz 6 (Locks + CDS)** — Cache traffic from TAS writes, TTAS reads-before-write, LL/SC, CAS pattern `while (CAS(&top, n->next, n) != n->next)`, CV enqueue bug via `if` not `while`.
- **Quiz 7 (CV + RW writer-priority)** — Why `if` can cause buffer-negative bug; full 11-part RW writer-priority walkthrough with `readTry`, `rmutex`, `wmutex`, `resource` semaphore purposes, first/last reader and writer roles, reader starvation conditions, arrival scenarios.

### 1.8 Other
- `COP 4600 Accomm_Template` — Administrative; ignore for content.
- Evan's handwritten study notes — No extractable text; ignore.

---

## 2. Recurring exam-question shapes

These are the atomic "question shapes" the final will sample from. Each topic markdown needs MCQ / short-answer items that exercise at least the shapes listed under its unit.

1. **Gantt-chart scheduling** (FIFO / SJF / STCF / RR with quantum + tiebreak) → compute turnaround / response / wait times per process + averages.
2. **MLFQ event-by-event trace** with per-queue allotments, demotions on allotment exhaustion, preemption on higher-queue arrival, periodic priority boost (rule 5).
3. **Paging math** — VA / PM / page-size → VPN bits, entries, PTE size, page-table size (linear and multi-level).
4. **CFS slice + vruntime** — nice-to-weight table, `time_slice_i = (weight_i / Σweight) × sched_latency`, `vruntime_new = vruntime_old + (1024 / weight_i) × time_slice_i`, order of next 3 runs.
5. **Race-condition decomposition** — break `x++` into load / add / store, show a bad interleaving, predict the final value.
6. **Lock correctness analysis** — flag-based (broken), TAS (ok, unfair), CAS, LL/SC, ticket / FetchAndAdd (fair), TTAS (less bus traffic).
7. **CV lost-wakeup timeline** — draw the thread interleaving, explain why `if` is broken, give the `while` fix; also cover spurious wakeups.
8. **Semaphore ordering enumeration** — given initial values and a sequence of `sem_wait` / `sem_post` across N threads, enumerate all possible output orderings.
9. **Deadlock via `vector_add`** — identify the cycle, apply lock-address ordering as the fix.
10. **Dining philosophers** — show deadlock in the naive solution; fix via (a) odd/even ordering or (b) N-1 seat limit.
11. **Reader-Writer preference** — reader-priority vs writer-priority logic; when readers can starve, when writers can starve; arrival scenarios.
12. **Disk I/O math** — `T_seek + T_rotation + T_transfer`; random vs sequential throughput.
13. **RAID levels** — capacity, reliability, sequential / random read / write for RAID 0 / 1 / 4 / 5.
14. **File system I/O counting** — `open("/foo/bar")` = 5 reads, `create` = 4 R + 4 W, each allocating `write` = 5 I/Os.
15. **Hard vs symbolic links** — inode reuse, ref count, cross-fs, dangling links.
16. **Journaling crash scenarios** — crash before commit → rollback; crash after commit, before checkpoint → replay; data journaling vs metadata journaling vs ordered journaling.
17. **Page replacement on access trace** — Optimal / FIFO / LRU hit-miss trace for a given sequence and frame count.
18. **TLB + multi-level PT access counts** — per-level memory accesses for TLB hit / miss across fetch + execute, distinguishing memory vs non-memory instructions.
19. **Lottery / stride fairness computation** — given tickets and stride, enumerate the next k runs; unfairness metric `U = t1_finish / t2_finish`.
20. **Print-in-order / thread-ordering** — given two or three threads, write CV + flag code (or trace a given one) to force a sequence.
21. **Disk I/O plug-in-the-numbers** — given RPM, seek, transfer rate (e.g., Cheetah vs Barracuda), compute random vs sequential throughput and single-I/O latency.
22. **Memory-API error classification** — given a C snippet, identify leak / dangling pointer / double-free / uninitialized-read.
23. **Inode max-file-size math** — given pointer counts and block size, compute `12 × BS + P × BS + P² × BS` (where `P = BS / sizeof(ptr)`).
24. **FFS chunk-size amortization** — given disk bandwidth and positioning cost, compute chunk size for X% of peak throughput.
25. **Journaling mode comparison** — given a crash timeline, predict FS state under data vs metadata vs ordered journaling; place `TxB` / `TxE` / checkpoint markers.
26. **Revoke-record necessity** — given a block-reuse scenario (free a directory block, reallocate as user data, crash, replay), show how replaying stale metadata corrupts data and how revoke prevents it.

---

## 3. Proposed unit structure (8 units)

Aligned to syllabus weeks 1-14. Post-MT2 content (persistence) is weighted heaviest for the cumulative final; concurrency remains comprehensive.

### `00-foundations`  (Week 1)
OS role, virtualization abstraction, protection (user vs kernel mode), trap vs interrupt, system call invocation, limited direct execution (LDE), mechanism vs policy.

**Topics (proposed):**
- `what-is-an-os`
- `virtualization-overview`
- `user-vs-kernel-mode`
- `traps-interrupts-syscalls`
- `limited-direct-execution`

### `01-processes`  (Week 2)
Process abstraction, PCB, address space layout (text / data / heap / stack), `fork` / `exec` / `wait` / `exit`, zombies, shell redirection (`dup2`), context switch cost.

**Topics:**
- `process-abstraction`
- `address-space-layout`
- `fork-exec-wait`
- `zombies-orphans`
- `context-switch`
- `shell-redirection`

### `02-scheduling`  (Week 3)
Metrics (turnaround, response, wait time), FIFO, SJF, STCF, RR, MLFQ (5 rules), Lottery, Stride, CFS (weights, `min_vruntime`, `sched_latency`, `min_granularity`).

**Topics:**
- `scheduling-metrics`
- `fifo`
- `sjf`
- `stcf`
- `round-robin`
- `mlfq`
- `lottery-stride`
- `cfs`

### `03-memory`  (Weeks 4-5)
`malloc`/`free` API, base-and-bounds, segmentation (internal + external fragmentation), paging, TLB, multi-level page tables, inverted page tables, swapping, page-replacement policies, thrashing.

**Topics:**
- `malloc-free-api`
- `memory-api-errors`
- `base-and-bounds`
- `segmentation`
- `paging-basics`
- `paging-math`
- `tlb`
- `multi-level-page-tables`
- `inverted-page-tables`
- `swap-and-page-fault`
- `page-replacement-policies`
- `thrashing`

### `04-concurrency`  (Weeks 6-8) — post-MT1 start of deep content
Threads vs processes, race conditions, critical sections, mutual exclusion, hardware lock primitives, lock performance, concurrent data structures, condition variables, semaphores, reader-writer locks.

**Topics:**
- `threads-vs-processes`
- `race-conditions`
- `critical-section-requirements`
- `tas-cas-llsc-primitives`
- `spinlocks-and-ticket-locks`
- `ttas-and-backoff`
- `two-phase-lock`
- `futex-and-park-based-locks`
- `sloppy-counter`
- `concurrent-linked-list`
- `concurrent-queue`
- `condition-variables`
- `producer-consumer-cv`
- `covering-conditions`
- `thread-ordering-with-cvs`
- `semaphores`
- `producer-consumer-semaphores`
- `zemaphore-cv-backed-semaphore`
- `reader-writer-locks`
- `reader-writer-preference`

### `05-deadlock`  (Week 9)
4 necessary conditions, prevention strategies per condition, avoidance (Banker's style), detection + recovery, dining philosophers (naive, odd/even ordering, N-1 seats), atomicity violations, order violations, livelock.

**Topics:**
- `deadlock-four-conditions`
- `prevent-mutual-exclusion`
- `prevent-hold-and-wait`
- `prevent-no-preemption`
- `prevent-circular-wait`
- `deadlock-avoidance`
- `deadlock-detection-recovery`
- `dining-philosophers`
- `atomicity-violations`
- `order-violations`
- `livelock`

### `06-persistence`  (Weeks 11-14) — heaviest weight for cumulative final
I/O devices (PIO / DMA), HDD mechanics, disk scheduling (FCFS / SSTF / SCAN / C-SCAN), RAID 0/1/4/5, files & directories, inodes, hard vs symbolic links, FS implementation (superblock / bitmaps / inode table / data blocks), open/read/write/create I/O counts, `fsync`, crash consistency, FSCK, journaling (data / metadata / ordered), SSDs (NAND, FTL, wear leveling, TRIM).

**Topics:**
- `io-devices-pio-dma`
- `ide-driver-register-protocol`
- `hdd-mechanics-io-time`
- `disk-scheduling`
- `raid-levels`
- `files-and-directories`
- `fd-openfile-inode-tables`
- `inodes`
- `hard-vs-symbolic-links`
- `filesystem-implementation`
- `inode-multi-level-index`
- `ffs-cylinder-groups`
- `file-operations-io-counts`
- `write-vs-fsync`
- `crash-consistency`
- `fsck`
- `journaling-modes`
- `journal-transactions-and-recovery`
- `revoke-records-and-block-reuse`
- `ssds-and-ftl`

### `07-exam-prep`  (Weeks 15-16)
Cumulative problem sets modeled on past-exam shapes listed in §2. Each rubric has a "traces" section (step-by-step walkthroughs) consumed by the trace viewer.

**Topics:**
- `cumulative-problems-scheduling`
- `cumulative-problems-paging`
- `cumulative-problems-concurrency`
- `cumulative-problems-persistence`
- `mixed-mock-final-a`
- `mixed-mock-final-b`

---

## 4. Post-MT2 emphasis plan

For a **cumulative final with post-MT2 emphasis**, I propose authoring depth as follows. Numbers are target MCQ+short items per unit. Concurrency stays comprehensive; persistence gets the largest share.

| Unit | Target MCQs | Short / Scenario | Notes |
|---|---|---|---|
| `00-foundations` | 8 | 2 | Light review only. |
| `01-processes` | 10 | 3 | Fork / zombies are classic. |
| `02-scheduling` | 18 | 6 | At least one Gantt scenario per algorithm + MLFQ trace + CFS compute. |
| `03-memory` | 22 | 6 | Paging math + TLB + multi-level PT + page replacement. |
| `04-concurrency` | 30 | 10 | Full CV, semaphores, RW, sloppy counter, lock primitives. |
| `05-deadlock` | 14 | 4 | Four-conditions + dining philosophers + `vector_add`. |
| `06-persistence` | 32 | 10 | Heaviest weight — RAID, disk math, FS I/O counts, journaling, SSDs. |
| `07-exam-prep` | — | 8 full mixed sets | Trace-heavy cumulative review. |

---

## 5. Prereq graph — first cut

Will be finalized in `MEMORY.md` during Phase 1.3. First pass:

```
foundations/* → processes/*
processes/context-switch → scheduling/*
scheduling/mlfq → scheduling/cfs  (history → weighted fair)
memory/paging-basics → memory/paging-math → memory/tlb → memory/multi-level-page-tables
memory/multi-level-page-tables → memory/swap-and-page-fault → memory/page-replacement-policies → memory/thrashing
processes/address-space-layout → memory/malloc-free-api
concurrency/race-conditions → concurrency/critical-section-requirements → concurrency/tas-cas-llsc-primitives
concurrency/tas-cas-llsc-primitives → concurrency/spinlocks-and-ticket-locks → concurrency/ttas-and-backoff → concurrency/two-phase-lock
concurrency/spinlocks-and-ticket-locks → concurrency/sloppy-counter → concurrency/concurrent-linked-list → concurrency/concurrent-queue
concurrency/spinlocks-and-ticket-locks → concurrency/condition-variables → concurrency/producer-consumer-cv → concurrency/covering-conditions
concurrency/condition-variables → concurrency/semaphores → concurrency/producer-consumer-semaphores
concurrency/semaphores → concurrency/reader-writer-locks → concurrency/reader-writer-preference
concurrency/producer-consumer-cv → deadlock/deadlock-four-conditions
deadlock/deadlock-four-conditions → deadlock/prevent-*
deadlock/prevent-* → deadlock/dining-philosophers
memory/paging-basics → persistence/io-devices-pio-dma  (hardware path)
persistence/io-devices-pio-dma → persistence/hdd-mechanics-io-time → persistence/disk-scheduling → persistence/raid-levels
persistence/files-and-directories → persistence/fd-openfile-inode-tables → persistence/inodes → persistence/hard-vs-symbolic-links
persistence/inodes → persistence/filesystem-implementation → persistence/file-operations-io-counts → persistence/write-vs-fsync
persistence/write-vs-fsync → persistence/crash-consistency → persistence/fsck → persistence/journaling
persistence/filesystem-implementation → persistence/ssds-and-ftl
```

---

## 6. Known gaps / watch-outs

- **OCR quality** on handwritten makeup exams (`exam_1.txt`, `exam_2.txt`) is poor. Reconstructed shapes in §2 are from surrounding structural cues; actual numerical keys may need me to re-visit the PDFs directly if a topic leans on exact values.
- **Attendance Quiz 1 + 4** are image-only; nothing to mine.
- **Banker's algorithm** (deadlock avoidance) is called out in Midterm 2 Review but was light in the S26 attendance quizzes; I'll include it but keep to one representative problem.
- **SSDs / FTL / TRIM** appear in Week 14 of the syllabus but do not appear in any past exam I have. Will cover per OSTEP + syllabus only.
- The AOA reference hub's `graph-walk` / `pseudocode-ollama` / `runtime` quiz kinds are algorithm-specific; OS-side I'll substitute with a `trace-walk` kind (Gantt / MLFQ / page-replacement / journaling timeline) and keep `mcq` / `short` / `scenario` unchanged.
- **Grading discrepancy** — `OS_intro_Spring26.pdf` lists 25% projects / 20% × 2 midterms / 30% final / 5% quizzes. Syllabus file lists 5% attendance + 25% projects + 40% midterms + 30% final. This is not KB content, but worth a single flashcard under `07-exam-prep` so Trev doesn't guess wrong on "how much is the final worth."
- **Week 5, Week 10, Week 14_2, Week 15 lecture PDFs** are not in the `lectures/` folder. Weeks 5 & 10 are likely midterm / break weeks. Week 14_2 (SSDs / FTL / TRIM) and Week 15 are not yet uploaded; SSD content will be sourced from OSTEP Ch. 44 + syllabus descriptions until those decks arrive.
- **Weeks 13_1, 13_2, 14_1 now merged into inventory** (FS implementation, FFS cylinder groups, FSCK + journaling).

---

## 7. Checkpoint — status

**User approved advancing to Phase 1.2 automatically** after Weeks 13_1 / 13_2 / 14_1 were folded in (this message). Proceeding to topic-markdown authoring unit-by-unit. Will pause again at the end of Phase 1.3 for the MEMORY.md checkpoint.

Once you sign off, I'll author topic markdown unit-by-unit and write `kb/MEMORY.md` at the end of Phase 1.3 for a second checkpoint.
