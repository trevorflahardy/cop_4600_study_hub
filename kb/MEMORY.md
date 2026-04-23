# COP 4600 Operating Systems — Master Memory

## Purpose

This hub consolidates all 82 core OS topics (plus 6 exam-prep problem sets) spanning virtualization, concurrency, and persistence into a learner-friendly knowledge base seeded by a prerequisite DAG. It supports self-directed study for USF's cumulative final exam, with emphasis on post-midterm-2 material (persistence and advanced concurrency).

## Scope of the final exam

The cumulative final covers:
- Unit 0 (Foundations): OS roles, virtualization, privilege levels, trap mechanics, limited direct execution.
- Unit 1 (Processes): Process abstraction, address space, fork/exec/wait, context switches.
- Unit 2 (Scheduling): Metrics, FIFO/SJF/STCF/RR, MLFQ, lottery/stride, CFS.
- Unit 3 (Memory): malloc/free, base-and-bounds, segmentation, paging, TLB, page tables, swapping, page replacement, thrashing.
- Unit 4 (Concurrency): Threads, race conditions, locks (TAS/CAS/ticket/two-phase/futex), concurrent data structures, condition variables, semaphores, reader-writer locks.
- Unit 5 (Deadlock): Four conditions, prevention strategies, avoidance, detection, dining philosophers, atomicity/order violations, livelock.
- Unit 6 (Persistence): I/O devices (PIO/DMA), HDDs, disk scheduling, RAID, files/directories, filesystems, FFS, crash consistency, FSCK, journaling, SSDs.

Grading: 30% final, 40% midterms (20% × 2), 25% projects, 5% attendance.

## Unit map: ordering and dependencies

**Unit 00 — Foundations (5 topics)**
Establishes the OS's three core responsibilities (virtualization, concurrency, persistence) and the mechanisms underlying all subsequent units: user/kernel privilege, traps/interrupts, and limited direct execution. Entry points; no prerequisites. Required before any other unit.

**Unit 01 — Processes (6 topics)**
Defines the process abstraction (address space, registers, isolation) and the APIs for creating/managing processes (fork, exec, wait). Context switching bridges to scheduling. Depends on Unit 0 (LDE, virtualization).

**Unit 02 — Scheduling (8 topics)**
Scheduling policies (FIFO, SJF, STCF, RR, MLFQ, CFS) and metrics. Forms the decision-making backbone for CPU multiplexing. Depends on Unit 1 (context switch); feeds into memory unit (thrashing discussion) and concurrency (starvation, fairness, livelock).

**Unit 03 — Memory (12 topics)**
Memory management techniques: malloc/free, base-and-bounds, segmentation, paging, TLB, multi-level page tables, page replacement, thrashing. Incremental complexity: paging-math requires paging-basics; multi-level-page-tables requires both paging-math and TLB; page replacement requires swap-and-page-fault. Depends on Unit 1 (address space); heavily intersects Unit 2 (thrashing, fairness in page replacement).

**Unit 04 — Concurrency (20 topics)**
Synchronization primitives (locks, condition variables, semaphores), concurrent data structures, and synchronization patterns. Linear progression: race conditions → critical-section-requirements → hardware primitives → spinlocks → higher-level structures (CVs, semaphores, reader-writer locks). Spans coverage of lock-based concurrency (Weeks 6–8 lectures). Depends on Unit 1 (threads vs processes).

**Unit 05 — Deadlock (11 topics)**
Four necessary conditions for deadlock, strategies to prevent each, avoidance and detection, and classic problems (dining philosophers, atomicity/order violations, livelock). Consumes concurrency units (spinlocks, semaphores, CVs) and contributes patterns for isolation and fairness in Units 2 and 4. Depends on Unit 4 (locks, semaphores).

**Unit 06 — Persistence (20 topics)**
Disk I/O (PIO/DMA), disk mechanics, disk scheduling, RAID, files/directories, filesystem layout, file operation costs, crash consistency, FSCK, journaling (data/metadata/ordered), SSDs. Heaviest unit (40% of core topics); heaviest exam weight post-MT2. Linear progression: I/O → HDD mechanics → disk scheduling → RAID → files → filesystem implementation → crash consistency → journaling. Mostly independent of Concurrency/Deadlock but intersects Memory (paging, swapping, TLB locality) and Scheduling (throughput, fairness in disk access).

**Unit 07 — Exam Prep (9 topics)**
Cumulative problem sets (scheduling, paging, concurrency, persistence), two full mock finals, and three final-exam hint-driven drill files: fork-output enumeration (the confirmed 10-pt item), concurrency final drills (CV while-vs-if, spin/ticket locks, semaphore patterns — the 75-pt block), and persistence final drills (Ch 41–42 FS implementation + crash consistency — the 48-pt block including 16 pts on inconsistency/recovery). Not nodes in the prereq graph; treated as study guides. Depend on all prior units.

## Topic index

### 00-Foundations
- `what-is-an-os` — OS abstracts complexity (CPU virtualization, memory virtualization, persistence), enforces isolation, and manages resource contention via the system-call API.
- `virtualization-overview` — Time-sharing of CPU, address translation for memory, and filesystem abstraction create the illusion that each process has its own dedicated hardware.
- `user-vs-kernel-mode` — Privilege level bit controls which instructions execute; user mode blocks privileged operations; kernel mode allows all; transitions via trap/return-from-trap.
- `traps-interrupts-syscalls` — Traps are synchronous (system calls, page faults); interrupts are asynchronous (timer, I/O); both vector through the trap table to kernel handlers.
- `limited-direct-execution` — OS strategy: let user code run directly for speed, but arm timer interrupts and trap handlers to ensure OS regains control periodically.

### 01-Processes
- `process-abstraction` — Running program with isolated address space, registers, and stack; OS multiplexes CPU via time-sharing to give each process its own virtual CPU.
- `address-space-layout` — Virtual address space on x86-64: code (low), data, heap (growing up), stack (growing down); base-and-bounds and paging enforce isolation.
- `fork-exec-wait` — fork() clones a process, exec() loads a new program, wait() blocks parent until child exits; together they implement process creation, replacement, and synchronization.
- `zombies-orphans` — Zombie: child exited but parent never called wait(), holding entry in process table. Orphan: parent exited before child; OS reparents to init. Reaping prevents zombie leaks.
- `context-switch` — OS saves current process's registers/PC to PCB, loads next process's saved state, resumes; enables CPU sharing and response to timer interrupts.
- `shell-redirection` — dup2() redirects file descriptors to redirect stdio; open() + close() + dup2() pattern implements shell redirection (>, >>, <).

### 02-Scheduling
- `scheduling-metrics` — Turnaround time (arrival → completion), response time (arrival → first run), wait time (total in ready queue); good schedulers minimize turnaround or response.
- `fifo` — First In, First Out; simple but poor response time on mixed workloads (convoy effect); always computes lower bound for turnaround.
- `sjf` — Shortest Job First (non-preemptive); optimal for turnaround but terrible response time and requires knowing job length in advance.
- `stcf` — Shortest Time-to-Completion First (preemptive SJF); optimal for turnaround and response but still requires knowing remaining time; convoy of short jobs can starve long jobs at launch.
- `round-robin` — Preemptive FIFO with time quantum; fair response time, but turnaround degrades if quantum too small (context switch overhead) or too large (degrades to FIFO).
- `mlfq` — Multi-Level Feedback Queue with 5 rules: demote on allotment exhaustion, boost on periodic reset, avoid starvation, learn job behavior. Near-optimal for mixed workloads.
- `lottery-stride` — Probabilistic (lottery) or deterministic (stride) allocation of CPU time proportional to ticket counts; fairness metric unfairness U = t1_finish / t2_finish.
- `cfs` — Completely Fair Scheduler: red-black tree of ready tasks sorted by vruntime, weight per nice level, sched_latency divided among tasks, min_granularity floor; O(log n) complexity.

### 03-Memory
- `malloc-free-api` — malloc() allocates memory from heap; free() deallocates; fragmentation (internal/external) and bookkeeping trade off space vs. allocation time.
- `memory-api-errors` — Leak (never freed), dangling pointer (use-after-free), double-free (free twice), uninitialized read; detection via static analysis or runtime tools.
- `base-and-bounds` — Simplest memory protection: MMU checks that virtual address < bounds register and translates as physical = base + virtual; fragmentation and space overhead limit use.
- `segmentation` — Multiple independent base-and-bounds ranges per process (code, heap, stack) reduce fragmentation; external fragmentation compaction problem remains.
- `paging-basics` — Fixed-size pages (virtual) map to frames (physical) via page table; PTE holds PFN and metadata (valid, protection, present, dirty, accessed); solves fragmentation.
- `paging-math` — VA = VPN || offset; VPN bits = log2(VAS / page_size); PTE array size = 2^VPN_bits × PTE_size; multi-level PTs reduce size from O(VAS) to O(VAS / page_size).
- `tlb` — Hardware cache of recent VPN→PFN translations; TLB hit avoids page table walk; TLB miss costs 1–2 extra memory accesses per instruction; LRU and clock replacement policies.
- `multi-level-page-tables` — Hierarchical PT (e.g., 2-level on 32-bit x86: PD + PT) reduces memory footprint from 4 MB linear to ~12 KB typical; 3–5 levels on 64-bit; TLB critical for amortizing walk cost.
- `inverted-page-tables` — Single table indexed by physical frame, storing (process_id, VPN); saves memory for large VA spaces but complicates TLB miss handling and sharing.
- `swap-and-page-fault` — Present bit = 0 in PTE triggers page fault; OS loads page from swap/disk, updates PTE, resumes; enables memory overcommit but at severe performance cost if thrashing.
- `page-replacement-policies` — Optimal (remove farthest future use, unachievable), FIFO (remove oldest, belady anomaly), LRU (remove least-recently-used, O(n) to track), Clock (approximate LRU with accessed bit).
- `thrashing` — Working set of process > physical memory; frequent page faults, context switches, disk I/O; throughput collapses; working-set model and load control address.

### 04-Concurrency
- `threads-vs-processes` — Thread shares address space (code, data, heap, FDs) with siblings; owns PC, registers, stack; cheaper context switch than process (no TLB flush); races easier but isolation harder.
- `race-conditions` — Final result depends on thread schedule; load/add/store decomposition reveals interleaving vulnerabilities; atomicity violation if shared data not protected.
- `critical-section-requirements` — Mutual exclusion (at most one thread in CS at a time), progress (non-blocked threads make progress), bounded waiting (no starvation); required for correctness.
- `tas-cas-llsc-primitives` — TAS (test-and-set): atomic swap, simple but slow. CAS (compare-and-swap): atomic conditional swap, more flexible, loop-based. LL/SC (load-linked/store-conditional): load, execute, store only if not modified; detects conflicts.
- `spinlocks-and-ticket-locks` — Spinlock: busy-wait on atomic flag; unfair, cache-coherent traffic. Ticket lock: FetchAndAdd to allocate ticket; fair FIFO order; prevents starvation.
- `ttas-and-backoff` — Test-and-Test-And-Set reduces cache traffic vs. raw TAS; exponential backoff allows spin time to adapt; trade latency vs. bandwidth.
- `two-phase-lock` — Spin briefly, then block on futex or semaphore; reduces CPU waste vs. pure spinlock; critical for high-contention locks.
- `futex-and-park-based-locks` — Futex: bit-31 = held, guard lock protects queue, spin first then sleep; park/unpark system calls; Linux fast path / slow path. Park = block in kernel.
- `sloppy-counter` — Thread-local counters + global lock for threshold; reduces contention vs. single lock; threshold trades accuracy for throughput.
- `concurrent-linked-list` — Per-node lock (hand-over-hand) or coarse lock; balance node lock overhead vs. contention; CAS-based lock-free insert uses LL/SC or CAS loop.
- `concurrent-queue` — Head/tail pointers; enqueue locks tail, dequeue locks head; empty/full conditions signal waiters; balance fairness, contention, and NUMA locality.
- `condition-variables` — Sleep until condition true; always paired with mutex; wait() atomically releases mutex, sleeps, reacquires on wakeup; signal() wakes one, broadcast() wakes all.
- `producer-consumer-cv` — Producer checks buffer-full, adds item, signals waiting consumer; consumer checks buffer-empty, removes, signals waiting producer; if/while distinction critical.
- `covering-conditions` — Multiple producers/consumers can be woken by one signal; broadcast() ensures any thread waiting for its condition sees the change.
- `thread-ordering-with-cvs` — Use flags + CVs to enforce thread order (e.g., print-in-order: first sets flag, second waits on flag, first signals after print).
- `semaphores` — Integer value + sem_wait() (decrement, sleep if < 0) / sem_post() (increment, wake one); generalizes locks (binary sem, init 1) and signaling (init 0); deadlock-prone if ordering not careful.
- `producer-consumer-semaphores` — empty(BSIZE), full(0), mutex(1); producer sem_wait(empty), insert, sem_post(full); consumer reverse; clean separation of concerns.
- `zemaphore-cv-backed-semaphore` — Implement semaphore using CV + mutex + counter; wait() decrements (sleep if negative), post() increments and broadcasts; learning tool.
- `reader-writer-locks` — Multiple readers allowed, but writers exclusive; reader-priority (readers starve writers) or writer-priority (writers starve readers); use semaphores or CVs.
- `reader-writer-preference` — Reader-priority: first reader acquires writelock (blocks writers), last reader releases. Writer-priority: writers queue, block new readers, then execute. Starvation scenarios.

### 05-Deadlock
- `deadlock-four-conditions` — Mutual exclusion, hold-and-wait, no preemption, circular wait; all four must hold; remove any one and deadlock impossible.
- `prevent-mutual-exclusion` — Lock-free using CAS/LL-SC; hard to apply universally; practical only for specific data structures (stacks, queues, sets).
- `prevent-hold-and-wait` — Acquire all locks at once (lock ordering) before proceeding; reduces concurrency but prevents deadlock.
- `prevent-no-preemption` — Use trylock with abort/retry on failure; can cause livelock if threads always back off and retry in sync; add random delay to break symmetry.
- `prevent-circular-wait` — Globally order locks by address or ID; all code acquires in ascending order; prevents cycles. Trade: serialization, no cycle-breaker needed.
- `deadlock-avoidance` — Banker's algorithm: grant resources only if remaining request sequence is safe; requires knowing max resource demand in advance; rarely used in practice.
- `deadlock-detection-recovery` — Build resource allocation graph, detect cycles (unsafe state); on deadlock, kill processes or preempt transactions; undo side effects via journaling.
- `dining-philosophers` — N processes, N chopsticks arranged in circle; each picks left, then right (deadlock). Fix: odd processes pick right first (breaks symmetry), or allow N-1 seated (resource limit), or use arbiter.
- `atomicity-violations` — Expected sequence of operations (e.g., flag set → use) breaks if interleaved with another thread; fix via locks or CVs to enforce order.
- `order-violations` — Thread B tries to use resource before thread A initializes it; fix via semaphores (init 0, A posts, B waits) or CVs.
- `livelock` — Threads not blocked but making no progress; typically trylock-backoff loop; fix with random exponential backoff or blocking lock.

### 06-Persistence
- `01-io-devices-pio-dma` — Programmed I/O (CPU writes/reads ports), DMA (device writes directly to memory); interrupt-driven I/O on completion; device register model (status, command, data).
- `02-ide-driver-register-protocol` — IDE disk uses I/O ports (0x1F0 data, 0x1F1 error, 0x1F2 sector count, 0x1F3-5 LBA, 0x1F6 drive, 0x1F7 command). Status bits: BUSY, READY, DRQ, ERROR, etc.
- `03-hdd-mechanics-io-time` — I/O time = seek + rotation + transfer; typical: seek 5–10 ms, rotation 2–4 ms, transfer 0.1 ms per sector. Sequential >> random throughput (125 MB/s vs. 0.66 MB/s on Cheetah).
- `04-disk-scheduling` — FCFS (simple), SSTF (nearest, starvation), SCAN (elevator, seeks in one direction), C-SCAN (circular SCAN); balance seek time vs. fairness.
- `05-raid-levels` — RAID-0 (striping, no fault tolerance), RAID-1 (mirroring, 2×space), RAID-4 (striping + parity, small-write problem), RAID-5 (distributed parity); XOR recovery.
- `06-files-and-directories` — Files are arrays of blocks; directories are (inode, name) maps; stat struct (mode, inode, nlink, size, timestamps); hard link = shared inode, symlink = separate file.
- `07-fd-openfile-inode-tables` — FD table (process, points to open file table), open file table (offset, inode, ref count), inode cache (in-memory inodes). dup2() shares offset.
- `08-inodes` — On-disk: 12 direct pointers, 1 single indirect, 1 double indirect. In-memory: cached with ref count, dirty flag, lock. Multi-level index → max file size math.
- `09-inode-multi-level-index` — 12 direct + 1 single (B = block_size / sizeof(ptr) ~ 1024 on 4 KB blocks) + 1 double → max = 12 × B + B × B + B^2 × B = 12 K + 1 M + 1 G blocks.
- `10-hard-vs-symbolic-links` — Hard: shared inode, ref count, nlink; cross-fs impossible. Symlink: separate file storing path string; cross-fs ok, dangling if target removed.
- `11-filesystem-implementation` — Superblock (metadata), inode/data bitmaps, inode table, data blocks. open("/foo/bar") = 5 reads (superblock, inode-bitmap, dir, inode, data); write() = 5 I/Os (all + bitmap).
- `12-ffs-cylinder-groups` — Block group per physical region (cylinder); per-group superblock, bitmaps, inode table, data blocks. Policy: dirs → low-dir-count + high-free-inodes group; files → same group as parent.
- `13-file-operations-io-counts` — open("path/file") = 1 (superblock, implicit) + N (inodes along path) + 1 (final inode) reads (N ≥ 3 for typical path). create() = reads + inode-bitmap + inode-table writes. write() allocates block (bitmap write).
- `14-write-vs-fsync` — write() is buffered (returns immediately, kernel caches); fsync() blocks until on-disk. Crash between write() and fsync() → data loss.
- `15-crash-consistency` — Single/double/triple write crashes corrupt filesystem: leaked blocks, orphaned inodes, garbage reads. FSCK scans and rebuilds, journaling ensures atomic transactions.
- `16-fsck` — Scans superblock, allocated blocks, inodes, links, duplicates; rebuilds bitmaps and inode counts; slow (O(n) full scan) but guarantees consistency.
- `17-journaling-modes` — Data journaling: all blocks to log, then checkpoint (slow, safe). Metadata journaling: metadata to log, data to FS (fast, partial safety). Ordered journaling: data first, metadata in log (balance).
- `18-journal-transactions-recovery` — Transaction = TxBegin + blocks + TxEnd (commit). Write-ahead log ensures atomic: crash before commit → replay skip; after commit → replay.
- `19-revoke-records-and-block-reuse` — If block freed, reallocated, and crash during replay, old metadata corrupts new data. Revoke records prevent replay of stale journal entries on freed blocks.
- `20-ssds-and-ftl` — NAND flash: erase before write, high latency, wear leveling. FTL maps logical block to physical page/block, manages erase cycles, TRIM discards unused space.

### 07-Exam Prep (study guides, not algorithm entries)
- `cumulative-problems-scheduling` — Mixed Gantt-chart, MLFQ, CFS problems.
- `cumulative-problems-paging` — Paging-math, TLB, multi-level, page replacement problems.
- `cumulative-problems-concurrency` — Race decomposition, CV, semaphore, deadlock problems.
- `cumulative-problems-persistence` — HDD I/O time, RAID, journaling, FSCK problems.
- `mixed-mock-final-a` — Full 75-min mock final across all units.
- `mixed-mock-final-b` — Alternative full mock final.
- `final-exam-hints` — Professor's weightings (10+25+75+48), study order per block, cross-references to topic pages.
- `fork-output-enumeration` — Ten "list all possible outputs" drills for the confirmed 10-pt fork/exec/wait problem, plus the systematic happens-before method.
- `concurrency-final-drills` — Twenty drills targeting the 75-pt concurrency block: CV correctness (while vs. if, broadcast vs. signal), spin/ticket/TAS/CAS, semaphore patterns, deadlock fixes.
- `persistence-final-drills` — Fourteen drills targeting the 48-pt persistence block: HDD I/O time, disk scheduling, path-walk I/O counts, inode math, crash consistency, journaling modes, revoke records, FSCK, short-answer checklist.

## Critical paths through the material

**Path to scheduling mastery (5 core topics, 30 min):**
scheduling-metrics → fifo → sjf → stcf → mlfq. Build intuition: metrics define quality, FIFO shows problem, SJF optimal but unfair, STCF adds preemption, MLFQ adapts at runtime. Add lottery-stride for fairness flavor, cfs for modern Linux.

**Path to paging understanding (6 topics, 40 min):**
paging-basics → paging-math → tlb → multi-level-page-tables. Core: VPN translation, PTE structure, multi-level reduces space, TLB amortizes walk. Optionally add inverted-page-tables for contrast.

**Path to crash consistency (5 core topics, 50 min):**
filesystem-implementation → crash-consistency → fsck → journaling-modes → journal-transactions-recovery. Shows problem (what breaks on crash), recovery tool (FSCK), prevention (journaling), and edge case (revoke).

**Path to concurrency mastery (8 core topics, 60 min):**
race-conditions → critical-section-requirements → tas-cas-llsc-primitives → spinlocks-and-ticket-locks → condition-variables → producer-consumer-cv → semaphores → reader-writer-locks. Linear: each layer builds on prior synchronization mechanism. Include dining-philosophers and atomicity/order-violations for problem recognition.

**Final-exam express path (per professor's 2026-04-23 review):**
Start with `07-exam-prep/final-exam-hints` to see the weighted breakdown. Then, in order of exam value: (1) `07-exam-prep/concurrency-final-drills` (75 pts), (2) `07-exam-prep/persistence-final-drills` (48 pts, including the 16 pts on inconsistency/recovery), (3) `07-exam-prep/fork-output-enumeration` (10 pts, confirmed exact question shape), (4) quick sweep of the scheduling and memory-virtualization tracks for the 25-pt CPU-virt block and the 1–2 memory-virt select questions. Re-solve midterm 2 practice and exam problems cold before the final — the professor emphasized this explicitly for the concurrency block.

## Common exam patterns and what triggers them

1. **Gantt-chart scheduling (FIFO, SJF, STCF, RR with tiebreak):** Multiple jobs, compute turnaround / response / wait time per job + average. Classic time-slicing and convoy scenarios.

2. **MLFQ event-by-event trace:** Jobs arrive, allotments consume, rules 4 & 5 interact (boost, demotion). Requires careful step-by-step tracking.

3. **Paging math:** Given VA size, page size, PTE size, compute VPN bits, PT size, multi-level structure counts, cache behavior. Plug-and-chug arithmetic.

4. **CFS vruntime computation:** Nice-to-weight lookup, slice per task, vruntime increment formula, predict next 3 scheduled tasks by min(vruntime).

5. **Race-condition decomposition:** Load / add / store; bad interleaving; predict final value. Train ability to spot atomicity violations in code.

6. **Lock correctness (flag vs TAS vs CAS vs LL/SC vs ticket):** Identify fairness (unfair, fair), starvation (no, yes), performance (slow, ok, good). Use each pattern appropriately.

7. **Condition-variable lost-wakeup timeline:** Thread A signals, B wakes; if A exits critical section before B acquires lock, B hangs (lost wakeup). Fix: while-loop recheck. Also cover spurious wakeup (OS wakes without signal) and broadcast semantics.

8. **Semaphore ordering enumeration:** N threads, sequence of sem_wait/post, output all valid orderings (all-wait happens, then all-post, or interleaved if guards allow).

9. **Deadlock via vector_add:** Two threads lock wrong order (T1: A→B, T2: B→A) → cycle. Fix: lock address ordering (all lock min(A,B) first).

10. **Dining philosophers starvation/deadlock:** Naive: all pick left → deadlock. Fix: odd pick right first (breaks symmetry), or N-1 can sit (resource limit).

11. **Reader-Writer preferences:** Reader-priority: writers starve if readers keep arriving. Writer-priority: readers starve. Recognize starvation condition per scenario.

12. **Disk I/O math:** T_seek + T_rotation + T_transfer given RPM, seek time, transfer rate. Random vs sequential throughput. SSTF vs SCAN tradeoff.

13. **RAID capacity/reliability/throughput:** RAID-0 (no fault), RAID-1 (1 failure ok), RAID-4 (1 failure ok, small-write penalty), RAID-5 (1 failure, no small-write penalty). Enumerate per workload.

14. **File operation I/O counts:** open("/foo/bar/baz") = path walk (3 inodes) + superblock implicit; create() adds bitmap + inode writes; each allocating write = 5 I/Os (bitmap + inode + data + indirect + bitmap again).

15. **Hard vs symlinks:** Inode nlink ref-count trace; symlink dangling edge case; cross-fs constraints.

16. **Journaling modes:** Crash timeline; trace TxBegin / TxEnd / checkpoint placement; predict FS state under data vs metadata vs ordered journaling.

17. **Page replacement trace (Optimal, FIFO, LRU):** Given sequence and frame count, compute hit/miss for each algorithm; Belady anomaly motivation.

18. **TLB + multi-level PT access counts:** Per memory access in instruction fetch + execute; distinguish TLB hit / miss, PT walk levels; cumulative per instruction.

19. **Lottery / stride fairness:** Enumerate next k runs given tickets/strides; compute unfairness U = t1_finish / t2_finish.

20. **Print-in-order / thread-ordering:** Code or trace three threads enforcing an order via CVs + flags; recognize when if-pattern fails (missing while recheck).

21. **Revoke-record necessity:** Block freed → reallocated → crash during replay. Show stale metadata corrupts new data. Revoke prevents.

## Gotchas cheat sheet

- **Virtual ≠ physical addresses.** VA private per process; PA actual RAM. Page tables are hierarchical, not flat O(VAS) arrays.

- **TLB ≠ page fault.** TLB miss (entry evicted, walk page table) ≠ page fault (present bit 0, load from disk). Both are latency, but only page fault blocks.

- **Context switch is expensive.** Saves/restores all registers, flushes TLB, incurs cache misses. Frequent switching hurts throughput.

- **Interrupts ≠ traps.** Interrupt = async (timer, I/O). Trap = sync (syscall, page fault, privilege exception). Both vector through trap table.

- **Spinlock / semaphore fairness.** Pure spinlock unfair (new thread can steal lock). Ticket lock fair (FIFO). Semaphore can starve if post() order not tied to release order.

- **Condition-variable if vs while.** if () breaks on spurious wakeup (OS wakes without signal) or lost wakeup (signal between check and wait). while () always rechecks condition.

- **Hold-and-wait deadlock fix via lock ordering.** Threads must acquire locks in same address order; no cycles. But can serialize code and lose parallelism.

- **Page replacement: Belady anomaly.** FIFO can have more page faults with larger frame pool (e.g., 3 frames: 3 faults; 4 frames: 4 faults on reference string 1 2 3 4 1 2 5 1 2 3 4 5). LRU / Optimal don't exhibit.

- **FFS cylinder groups are not "cylinders" anymore.** Modern disks have complex geometries; "cylinder group" = block group, one per physical region for locality.

- **Journaling doesn't prevent data loss between write() and fsync().** Journal ensures metadata consistency; application must call fsync() for durability.

- **Small-write problem in RAID-4.** Each write to a data block requires read + parity write (2 I/Os per logical write). RAID-5 distributes parity to avoid one busy parity disk.

- **SSD wear leveling != partitioning.** FTL maps logical LBA to physical page, moves data to balance erase cycles. Wear leveling does not prevent premature failure if cells already damaged.

- **Lock-free ≠ wait-free.** Lock-free: some thread makes progress. Wait-free: all threads make progress in bounded steps. Wait-free much harder; lock-free often sufficient.

- **Mutex must protect condition variable.** wait() on CV without locked mutex is a race (lose signal between check and sleep). Mutex ensures atomicity.

## Source materials

- Arpaci-Dusseau *Operating Systems: Three Easy Pieces* (OSTEP) — primary textbook.
- TA lecture decks (Zhang): concurrency (Ch. 26–32, reader-writer), persistence (review decks).
- USF lecture decks (Weeks 1–14): live code, Gantt examples, xv6 context switch, CFS, FSCK/journaling, SSDs.
- Past exams (S25, S26): MT1/MT2 shape reference, exam-2 trace patterns.

## How to use this hub

1. **Entry point:** Start with Unit 0 (foundations) if new to OS. If midterm-ready, jump to Unit 2 or 3.
2. **Prereq graph:** Each topic's `prereqs.json` entry lists hard dependencies. Follow the DAG if stuck.
3. **Detailed reads:** Click into each topic .md file for full definition, key ideas, hand-traces, exam questions, gotchas, and sources.
4. **Practice:** Use exam-prep unit (07) for cumulative problem sets; trace-walk examples cement understanding.
5. **Review:** MEMORY.md (this file) = master index. Flashcards + quizzes in downstream React app.
6. **Exam:**
   - Scheduling: expect 1–2 Gantt or MLFQ traces, CFS vruntime computation.
   - Memory: 1–2 paging-math problems, 1 page-replacement trace.
   - Concurrency: 1 race decomposition, 1 CV lost-wakeup timeline, 1 deadlock cycle.
   - Persistence: 1–2 disk I/O counts, 1 crash consistency / journaling trace.
