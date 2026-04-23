# Final Exam Hints — Professor's Weightings

> Source: professor's final review session (2026-04-23). Point totals
> explicit. Everything on this page is what the professor said *will* be
> tested, word-for-word paraphrased. If a topic is on this page, it is on
> the exam.

## Confirmed point breakdown

| Block | Points | Shape of the questions |
|-------|-------:|------------------------|
| Fork / exec / wait — list all possible outputs | 10 | One C snippet, enumerate outputs. See [Fork Output Enumeration](./fork-output-enumeration.md) for ten worked drills. |
| CPU virtualization (plus a slice of memory virtualization) | 25 | Time-sharing, context switch, scheduling policy, syscalls, process waiting, fork. |
| Memory virtualization | 1-2 select questions | Address space, VA → PA translation, TLB → page table, per-process page table, hybrid (segment + PT), multilevel PT. |
| Concurrency | 75 | Review midterm 2 practice and exam. Lock implementation, condition variable usage (*while* not *if*), spin lock, mutual exclusion, semaphore correctness. |
| Persistence | 48 | Review entire unit. Select or short-answer. Traversal, FFS fairness, I/O time = seek + rotation + transfer, sequential workload. FD table, open syscall, open file table, inode cache, on-disk inode table, inode bitmap. Chapters 41, 42. |
| Inconsistency and recovery | 16 (subset of persistence) | At least 2 questions. A write to disk is not a single write. Understand crash points and journaling recovery. |

The 10 + 25 + 75 + 48 numbers add up to 158; there's extra room for a
syscall MCQ, memory-virtualization quick questions, and the inconsistency
sub-block (16) is folded inside the 48-point persistence total.

## Block 1 — Fork / exec / wait (10 points)

**Prompt shape:** "List all possible outputs."

**What to memorize:**

1. The three-step happens-before method ([fork-output-enumeration.md](./fork-output-enumeration.md#how-to-solve-list-all-possible-outputs-in-three-steps)).
2. wait(NULL) reaps one child, not all.
3. exec wipes post-exec code.
4. printf without `\n` can be duplicated across fork.

**Drill count to reach mastery:** 5-10. The guide has 10.

## Block 2 — CPU virtualization (25 points)

**What the professor listed:**

- Time sharing of one physical processor across processes.
- Context switch between processes (xv6 mechanics, saved state).
- CPU scheduling algorithms (FIFO, SJF, STCF, RR, MLFQ, CFS).
- CPU syscall API for process waiting, fork.

**Study order:**

1. [Process abstraction](../01-processes/process-abstraction.md) → [context switch](../01-processes/context-switch.md).
2. [Limited direct execution](../00-foundations/limited-direct-execution.md): timer interrupt guarantees OS regains control.
3. [Fork / exec / wait](../01-processes/fork-exec-wait.md) and [fork-output-enumeration.md](./fork-output-enumeration.md).
4. Scheduling policies — focus on FIFO, SJF, STCF, RR, MLFQ per the
   [scheduling cumulative problems](./cumulative-problems-scheduling.md).

**Likely question shapes:**

- Draw Gantt chart for given arrivals, compute avg turnaround / response.
- Trace MLFQ through a two-job workload; identify boost vs. demotion
  events.
- Identify which scheduler best serves a given workload (short
  interactive vs. long CPU-bound).
- Short answer: what is the difference between trap and interrupt?

## Block 3 — Memory virtualization (1-2 select questions)

**What the professor listed:**

- Each process has its own address space.
- Virtual address translates to physical address.
- TLB sits in front of page table.
- Each page table is per-process.
- Hybrid approach: segment + page table.
- Multilevel page table.

**Study order:**

1. [Paging basics](../03-memory/paging-basics.md) → [Paging math](../03-memory/paging-math.md).
2. [TLB](../03-memory/tlb.md): hit cost vs. miss cost, access count per
   instruction.
3. [Multi-level page tables](../03-memory/multi-level-page-tables.md):
   page directory + page table indices.
4. [Paging cumulative problems](./cumulative-problems-paging.md).

**Likely question shapes:**

- Select: which of the following is true about TLB miss vs. page fault?
- Short: for a 32-bit VA, 4 KB pages, compute VPN bits and PT size.
- Given VA = 0x00401AAF and a multi-level PT image, compute PA.

## Block 4 — Concurrency (75 points — the biggest block)

**What the professor listed:**

- Lock implementation.
- Condition variable usage: use `while`, not `if`. All the rules for using
  them properly.
- Spin lock.
- Mutual exclusion via correctly-used condition variables and semaphores.
- "Fully understand midterm 2 practice and exam."

**Study order (in order of exam value):**

1. [Race conditions](../04-concurrency/race-conditions.md) and
   [critical-section requirements](../04-concurrency/critical-section-requirements.md).
2. [TAS / CAS / LL-SC primitives](../04-concurrency/tas-cas-llsc-primitives.md)
   and [spinlocks and ticket locks](../04-concurrency/spinlocks-and-ticket-locks.md).
3. [Condition variables](../04-concurrency/condition-variables.md) — pay
   close attention to the while-loop pattern.
4. [Producer-consumer with CV](../04-concurrency/producer-consumer-cv.md)
   — the canonical "why while, not if" example.
5. [Covering conditions](../04-concurrency/covering-conditions.md): when
   to use `broadcast` instead of `signal`.
6. [Thread ordering with CVs](../04-concurrency/thread-ordering-with-cvs.md):
   print-in-order style problems.
7. [Semaphores](../04-concurrency/semaphores.md) and
   [producer-consumer with semaphores](../04-concurrency/producer-consumer-semaphores.md).
8. [Concurrency cumulative problems](./cumulative-problems-concurrency.md)
   — every drill in the file.

**Non-negotiable rules for CV correctness:**

1. Always hold the mutex when calling `wait` or `signal`.
2. Always wait inside a `while` loop over the predicate, never `if`.
   *Why:* spurious wakeups and "some-other-thread got there first"
   scenarios will let you run with a false predicate otherwise.
3. Use `broadcast` when multiple threads wait on the same CV for
   *different* predicates (covering conditions).
4. Signal *after* changing the predicate but *before* releasing the
   lock — or after the lock is released if your API allows
   (implementation dependent; in pthreads both work because wait
   re-acquires the mutex on wakeup).

**Likely question shapes:**

- Here is a lock implementation (TAS / ticket / two-phase). Is it
  correct? Fair? Starvation-free? What's its worst case?
- Given a producer-consumer snippet, identify the bug (e.g., `if`
  instead of `while`, missing broadcast, wrong sem order) and fix it.
- Write a small monitor with a CV that signals when a buffer has N
  items available.
- Semaphore init values: what should `empty` and `full` start at?
- Find the race: two threads increment a shared counter with only
  TAS — explain where the race lives and patch with CAS.

## Block 5 — Persistence (48 points, including 16 for recovery)

**What the professor listed:**

- "Review has all the content that is required."
- Select or short-answer only; no long coding.
- Traversal through directory structure (path walk).
- FFS fairness.
- I/O time = seek + rotation + transfer (be able to compute).
- Sequential vs. random workload.
- Memory structures: file descriptor, open syscall, what happens on disk.
- Open file table. Inode cache.
- On-disk structures: inode table, inode bitmap.
- Chapters 41 and 42.
- At least 2 questions on inconsistency and recovery (16 points subset).
- "A write to disk is not a single write" — crash consistency framing.

**Study order:**

1. [HDD mechanics](../06-persistence/03-hdd-mechanics-io-time.md): be
   able to compute I/O time for a given RPM, average seek, transfer rate.
2. [Disk scheduling](../06-persistence/04-disk-scheduling.md): FCFS,
   SSTF, SCAN, C-SCAN.
3. [Files and directories](../06-persistence/06-files-and-directories.md)
   and [FD / open-file / inode tables](../06-persistence/07-fd-openfile-inode-tables.md).
4. [Inodes](../06-persistence/08-inodes.md) and
   [multi-level index](../06-persistence/09-inode-multi-level-index.md):
   compute max file size.
5. [Filesystem implementation](../06-persistence/11-filesystem-implementation.md):
   open("/foo/bar") = 5 reads; write = 5 I/Os.
6. [FFS cylinder groups](../06-persistence/12-ffs-cylinder-groups.md)
   for fairness and locality policy.
7. [File operations I/O counts](../06-persistence/13-file-operations-io-counts.md).
8. [Write vs. fsync](../06-persistence/14-write-vs-fsync.md).
9. **Chapter 42 core:**
   [crash consistency](../06-persistence/15-crash-consistency.md),
   [FSCK](../06-persistence/16-fsck.md),
   [journaling modes](../06-persistence/17-journaling-modes.md),
   [journal transactions and recovery](../06-persistence/18-journal-transactions-recovery.md),
   [revoke records](../06-persistence/19-revoke-records-and-block-reuse.md).
10. [Persistence cumulative problems](./cumulative-problems-persistence.md)
    and [mock final B](./mixed-mock-final-b.md).

**Why "a write to disk is not a single write":**

To append a new block to a file, the filesystem must update:

1. The **data block** itself (write user data).
2. The **inode** (update block pointer and size).
3. The **data bitmap** (mark the allocated block as used).

If any one of those writes happens and the system crashes before the
others, the FS is inconsistent:

- Data written, inode not updated → orphaned data (leaked block).
- Inode updated, data bitmap not updated → inode points at a block the
  bitmap thinks is free; next allocation steps on it.
- Data bitmap updated, inode not updated → leaked block (allocated
  forever, pointed at by nothing).

Journaling wraps the three writes into a transaction (TxBegin + writes +
TxEnd) so the log records whether the transaction committed. Recovery
replays committed transactions and discards uncommitted ones.

**Likely question shapes:**

- Given RPM = 7200, avg seek = 4 ms, transfer = 100 MB/s, compute I/O
  time for one 4 KB random read.
- Compute the I/O count for `open("/a/b/c")` given an FFS with N
  directories on the path.
- Walk the state of disk (superblock, inode-bitmap, data-bitmap, inodes,
  data blocks) after a partial crash during a file append.
- Describe the three journaling modes (data, ordered, metadata) and
  explain when each is preferred.
- FSCK pass list: what does each pass check, and what does it fix?
- Why do revoke records exist? Give a scenario where replay without
  revoke corrupts user data.
- What sits in the file descriptor table vs. the open file table vs. the
  inode cache? What is shared between parent and child after fork?

## Cross-block warnings

- **Midterm 2 material returns in force.** The professor repeated this
  multiple times. Pull the MT2 practice and exam, rework every problem.
- **Persistence got the least lecture time but 48 points of exam.** The
  review deck is the primary source. Read it end to end before anything
  else.
- **Select questions in memory virt are 1-2 items, total.** Don't over-
  study paging math beyond one clean 3-bit VPN / 2-level walk example —
  the big points live in concurrency and persistence.

## Sources

- Professor's final-exam review session (voice notes, 2026-04-23).
- Image capture of review deck slide 8 (three fork / exec / wait
  enumeration problems).
- Course textbook OSTEP chapters 36-45 (I/O, HDD, RAID, files, FFS,
  crash consistency).
- Midterm 2 practice packet and midterm 2 exam (re-solve end-to-end).
