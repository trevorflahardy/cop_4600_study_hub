# Mock Final Exam B

## Instructions

**Format:** Closed-book, closed-notes. Calculator permitted.
**Time limit:** 75 minutes
**Difficulty:** Advanced. Combines multiple concepts per problem.

**Topics covered:** All units (processes/scheduling, memory/paging, concurrency, persistence). This exam emphasizes deep understanding and integration across topics.

---

## Problem 1 — Scheduling and MLFQ (18 points)

An MLFQ with 3 queues and these parameters:
- Queue 0 (priority 0): time slice 8 ms, allotment 16 ms
- Queue 1 (priority 1): time slice 16 ms, allotment 32 ms
- Queue 2 (priority 2): time slice 32 ms (FIFO after allotment)
- Periodic boost (Rule 5): every 50 ms

Three jobs:
- Job A (CPU-bound): 100 ms total, never yields
- Job B (I/O-bound): yields after 4 ms of CPU, I/O takes 10 ms
- Job C (Mixed): 6 ms CPU, then yields, I/O takes 5 ms, repeats

All jobs arrive at t=0.

**Task (a):** (8 pts) Trace the first 30 ms of execution. Show the state (queue, remaining time) after each scheduling decision. Indicate when context switches occur.

**Task (b):** (5 pts) At t=30 ms, which queue is each job in? Explain your reasoning.

**Task (c):** (5 pts) Between t=0 and t=50 ms, how much actual CPU time does Job C receive? Could Job C starve under this scheduling policy? Explain.

---

## Problem 2 — Multi-Level Page Tables and TLB (16 points)

A 48-bit virtual address space with 4 KB pages and 2-level page tables:
- Level 1 (outer directory): 2^9 entries (512 entries)
- Level 2 (inner tables): 2^9 entries each
- Each PTE: 8 bytes
- TLB: 16 entries, fully associative

A process has 2 GB of allocated virtual memory (non-contiguous: code, heap, stack).

**Task (a):** (4 pts) How many bits are used for the offset? For the Level 1 index? For the Level 2 index?

**Task (b):** (4 pts) How much memory is needed for the page table (assume only allocated regions have inner tables)? Estimate the number of inner tables needed.

**Task (c):** (4 pts) A streaming workload accesses 16 MB of data sequentially. Estimate the TLB hit rate (percentage of memory accesses that hit the TLB).

**Task (d):** (4 pts) If this process also runs a loop that repeatedly accesses the same 8 pages, what is the effective TLB hit rate over time?

---

## Problem 3 — Concurrency: Reader-Writer Lock (20 points)

Implement a reader-writer lock with writer preference using mutexes and condition variables.

**Setup:**
- Multiple readers should run concurrently.
- Writers require exclusive access.
- Writers have priority: if any writer is waiting, new readers must wait.

**Task (a):** (5 pts) Declare all necessary shared variables and synchronization primitives.

**Task (b):** (8 pts) Write the `rdlock_acquire()` and `rdlock_release()` functions for readers.

**Task (c):** (7 pts) Write the `wrlock_acquire()` and `wrlock_release()` functions for writers. Explain how writer preference is enforced.

---

## Problem 4 — Deadlock Detection and Avoidance (16 points)

Three processes (P1, P2, P3) and three resources (R1, R2, R3). Current allocation:

| Process | Holds  | Wants |
|---------|--------|-------|
| P1      | R1, R2 | R3    |
| P2      | R2     | R1    |
| P3      | R3     | R2    |

**Task (a):** (5 pts) Draw the resource allocation graph. Circle any cycle(s).

**Task (b):** (5 pts) Is the system in deadlock? Justify using the four Coffman conditions.

**Task (c):** (3 pts) Can a deadlock be resolved by preempting one resource from one process? If so, which?

**Task (d):** (3 pts) Propose a resource-ordering scheme (total order) that prevents deadlock. Show the order.

---

## Problem 5 — Paging and Working Set (15 points)

A system with 4 GB of physical memory. Two processes:
- Process A: working set size 200 MB, frequently accesses 50 MB sub-working-set
- Process B: working set size 300 MB, frequently accesses 100 MB sub-working-set

Both processes run simultaneously.

**Task (a):** (4 pts) If the system allocates memory naively (A gets 200 MB, B gets 300 MB), what is the total utilization? What happens if a third process arrives?

**Task (b):** (5 pts) Compute the minimum memory needed to avoid thrashing for both A and B.

**Task (c):** (6 pts) If physical memory drops to 800 MB, can both processes run without thrashing? What actions would the OS take (admission control, page replacement, process suspension)?

---

## Problem 6 — Filesystem I/O and Persistence (18 points)

A filesystem with:
- Block size: 4 KB
- Inode: 12 direct pointers, 1 single-indirect, 1 double-indirect
- Double-indirect block pointer width: 4 bytes

Consider this operation sequence:

```
1. create("/project/file.txt")
2. write(fd, buffer, 16 KB)  // Write 16 KB to file
3. fsync(fd)                 // Force all data to disk
4. unlink("/project/file.txt") // Delete the file
```

**Task (a):** (5 pts) For the `write(fd, buffer, 16 KB)` operation, how many disk blocks will be allocated? Which inode pointers will be used (direct vs. indirect)?

**Task (b):** (6 pts) Estimate the total number of disk I/O operations (reads and writes) for all 4 operations. Include inode, bitmap, and data block I/Os, but assume inode and bitmap blocks are cached after the create().

**Task (c):** (4 pts) If the system crashes after write() but before fsync(), what data is lost? What if it crashes after fsync()?

**Task (d):** (3 pts) How does journaling (ordered mode) reduce the risk of data loss in scenario (c)?

---

## Problem 7 — Memory Protection and Translation (16 points)

A system with 16-bit virtual addresses and 14-bit physical addresses. Page size: 256 bytes.

The page table has protection bits (3 bits): R (read), W (write), X (execute).

VA 0x4D3E is accessed with a write operation.

Compute:
- VPN from VA 0x4D3E
- Offset from VA 0x4D3E
- If PFN at this VPN is 0x2B with protection bits RWX (all set), compute PA.

**Task (a):** (4 pts) Extract VPN and offset. Explain your bit widths.

**Task (b):** (4 pts) Compute PA.

**Task (c):** (4 pts) If protection bits were RX (no W), what exception would be raised and what would the OS do?

**Task (d):** (4 pts) Explain how a two-level page table would reduce memory overhead for this system compared to a single-level table.

---

## Problem 8 — Scheduling: Context-Switch Overhead (14 points)

A system with 3 CPU-bound processes, each 10 ms CPU burst. Context switch overhead: 0.5 ms.

**Task (a):** (4 pts) With FIFO scheduling (no preemption), what is the average response time and average turnaround time?

**Task (b):** (5 pts) With Round Robin (time slice 1 ms), compute average response time and average turnaround time, accounting for context-switch overhead.

**Task (c):** (5 pts) What is the CPU utilization in each case? Which scheduler is more efficient for interactive workloads?

---

## Answer Key

### Problem 1 — MLFQ Scheduling

**(a) Execution trace (0–30 ms):**

| Time | Job A | Job B | Job C | CPU runs | Queue state |
|------|-------|-------|-------|----------|-------------|
| 0    | 100   | 0 CPU | 0 CPU | A (8ms)  | A: Q0[8ms], B: Q0, C: Q0 |
| 8    | 92    | 0 CPU | 0 CPU | B (4ms)  | A: Q0[8ms], B: Q0, C: Q0 |
| 12   | 92    | I/O (10ms) | 0 CPU | C (6ms)  | A: Q0[8ms], B: waiting I/O, C: Q0 |
| 18   | 92    | I/O   | yields after 6ms | A (8ms) | A: Q0[8ms], B: waiting I/O, C: yields |
| 22   | 84    | I/O (remaining) | I/O (5ms) | B arrives | B: Q0[4ms left alloc], back in Q0 |
| 26   | 84    | 0 CPU (I/O done) | I/O | B runs (2ms, finishes alloc) | A: Q0[6ms left alloc], B: Q0 (alloc used) → Q1 |
| 28   | 84    | 0 CPU | I/O | C (I/O finishes) → CPU | A: Q0, B: Q1, C: Q0 |
| 30   | 84    | 0 CPU | 4 ms CPU | A (8ms)  | ... |

**(b)** At t=30 ms:
- Job A: Queue 0 (used 8+8=16 ms of 16 ms allotment but not yet demoted)
- Job B: Queue 1 (used up allotment in Q0, demoted to Q1 after 4 ms)
- Job C: Queue 0 (resets on return from I/O, periodic boost at t=50 will move all to Q0)

**(c)** Job C receives:
- t=12–18: 6 ms (CPU before I/O)
- t=28–?: 4 ms and more in future cycles

By t=50 ms, Job C likely runs ~20 ms (I/O bound, frequently yields, stays in Q0).

Starvation risk: No, Rule 5 boost at t=50 ensures all jobs return to Q0 and get fair access. However, if A is heavily CPU-bound and never yields, C might see reduced CPU share due to priority, but not starvation (boost prevents indefinite demotion).

---

### Problem 2 — Multi-Level Page Tables and TLB

**(a)** Offset bits: log2(4 KB) = 12 bits
Level 1 index: 9 bits
Level 2 index: 9 bits
(Check: 12 + 9 + 9 = 30 bits, leaving 48 - 30 = 18 bits for... this doesn't add up. Let me recalculate.)

48-bit VA with 2^9 outer and 2^9 inner and 4KB pages:
- Offset: 12 bits
- Level 2 index: 9 bits
- Level 1 index: 9 bits
- Total: 12 + 9 + 9 = 30 bits (used out of 48)

The upper 48 - 30 = 18 bits are sign-extended (canonical form in x86-64) or unused.

**(b)** 2 GB of allocated memory / 4 KB per page = 2 * 2^30 / 2^12 = 2^19 = 524,288 pages.
Each inner table covers 2^9 = 512 pages. Number of inner tables: 2^19 / 2^9 = 2^10 = 1024 inner tables.

Memory for page table:
- Outer table: 512 entries * 8 bytes = 4 KB
- Inner tables: 1024 * 512 entries * 8 bytes = 1024 * 4 KB = 4 MB

Total: 4 KB + 4 MB ≈ **4 MB** (negligible overhead of outer table).

**(c)** 16 MB of streaming access:
- 16 MB = 16 * 2^20 bytes = 4096 pages (at 4 KB/page)
- TLB capacity: 16 entries

Each TLB entry covers 1 page. Streaming access:
- First access to each of 16 pages: 16 TLB misses (first 16 pages fill TLB)
- Page 17 onward: TLB full, so every new page is a miss (no hits after initial fill)

Total accesses: 16 MB / 4 KB = 4096 accesses
TLB misses: 16 (fill) + (4096 - 16) = 4096 (essentially all misses after the TLB is full)

Wait, that's wrong. Let me reconsider. In streaming, after the TLB fills (first 16 misses), every page access within a page is a hit. Only when moving to a new page do we incur a miss.

Streaming 16 MB:
- Access pattern: page 0 (1024 ints, assuming 4 bytes/int), page 1, ..., page 4095
- First 16 pages: 16 misses (TLB fills)
- Pages 17–4095: each is a miss (TLB evicts the oldest, brings in new)

Total misses: 16 (fill) + (4096 - 16) = 4096
Total accesses: 4 MB / 4 KB * (4096 / 4) = 4096 pages * (1024 ints/page) = 4 * 10^6 ints
Wait, let me re-calculate.

16 MB of data, 4 KB pages: 16 * 2^20 / 2^12 = 4096 pages.
If streaming sequentially, each page accessed once. Total page accesses: 4096.
TLB hit rate: (4096 - 16) / 4096 ≈ 99.6% (after initial fill, nearly all hits).

But if the working set is larger than TLB (4096 pages >> 16 TLB entries), the hit rate drops dramatically:
TLB hit rate ≈ 1/4096 = 0.024% or nearly 0% for streaming beyond TLB capacity.

Actually, the more accurate model: streaming 16 MB with a 16-entry TLB and 4 KB pages means after the TLB fills, every 16 pages we get 1 hit (the oldest page in the TLB might be re-accessed if we loop back) and 15 misses. But streaming doesn't loop back; it just goes forward.

More simply: TLB misses on every new page. Total misses ≈ 4096. TLB hit rate ≈ 0%.

But that's also too pessimistic. Within a page, multiple accesses are hits (assuming 4-byte words, 1024 words per 4KB page):
- Each page accessed: 1 miss on first access, then 1023 hits on subsequent accesses within the page.
- TLB hit rate ≈ 1023 / 1024 ≈ 99.9%

Correct answer: **~99.9% TLB hit rate** (one miss per page, many accesses per page).

**(d)** Loop repeatedly accessing 8 pages (fitting in TLB):
- After initial fill (8 misses), all subsequent accesses to the 8 pages are hits (8-entry loop in TLB).
- TLB hit rate ≈ 100% (after warm-up).

---

### Problem 3 — Reader-Writer Lock

**(a)** Declarations:

```c
int readers = 0;
int writers_waiting = 0;
pthread_mutex_t rmutex = PTHREAD_MUTEX_INITIALIZER;
pthread_mutex_t wmutex = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t cond = PTHREAD_COND_INITIALIZER;
```

**(b)** Reader lock:

```c
void rdlock_acquire() {
    pthread_mutex_lock(&rmutex);
    while (writers_waiting > 0) {
        pthread_cond_wait(&cond, &rmutex);
    }
    readers++;
    if (readers == 1) {
        pthread_mutex_lock(&wmutex);
    }
    pthread_mutex_unlock(&rmutex);
}

void rdlock_release() {
    pthread_mutex_lock(&rmutex);
    readers--;
    if (readers == 0) {
        pthread_mutex_unlock(&wmutex);
    }
    pthread_cond_broadcast(&cond);
    pthread_mutex_unlock(&rmutex);
}
```

**(c)** Writer lock:

```c
void wrlock_acquire() {
    pthread_mutex_lock(&rmutex);
    writers_waiting++;
    pthread_mutex_unlock(&rmutex);
    pthread_mutex_lock(&wmutex);
}

void wrlock_release() {
    pthread_mutex_unlock(&wmutex);
    pthread_mutex_lock(&rmutex);
    writers_waiting--;
    pthread_cond_broadcast(&cond);
    pthread_mutex_unlock(&rmutex);
}
```

**Writer preference enforcement:** When a writer arrives, `writers_waiting` is incremented. Readers check `writers_waiting > 0` before entering; if true, they wait on `cond`. The writer acquires `wmutex` (blocking all readers). When the writer finishes, `writers_waiting` is decremented, and readers are signaled (via broadcast). This ensures writers are prioritized: new readers wait until `writers_waiting` drops to zero.

---

### Problem 4 — Deadlock Detection

**(a) Resource allocation graph:**

```
P1 ---> R3
^       |
|       v
R1      P2 ---> R1
^       ^       |
|       |       v
+-------R2------+
  |
  P3
```

Cycle: P1 → R3 → P2 → R1 → (held by P1) [no, let me re-draw]

Actually:
- P1 holds R1, R2; wants R3
- P2 holds R2; wants R1
- P3 holds R3; wants R2

Edges:
- P1 → R3 (P1 wants R3)
- P2 → R1 (P2 wants R1)
- P3 → R2 (P3 wants R2)
- R3 → P3 (R3 held by P3)
- R1 → P1 (R1 held by P1)
- R2 → P2 (R2 held by P2)

Cycle: P1 → R3 → P3 → R2 → P2 → R1 → P1 (yes, cycle exists).

**(b)** Yes, deadlock exists. All four Coffman conditions are met:
- Mutual exclusion: resources are exclusive.
- Hold-and-wait: each process holds at least one resource and waits for another.
- No preemption: resources cannot be forcibly taken.
- Circular wait: P1 → P3 → P2 → P1 (via resource dependencies).

**(c)** Preempting R2 from P2 breaks the cycle. If R2 is given to P3, then P3 has R2 and R3, can run and release both. Then P2 can acquire R1, run, and release it. Then P1 can acquire R3 and run.

**(d)** Total order: R1 < R2 < R3. Each process must request resources in increasing order:
- P1: request R1 (has it), R2 (has it), R3 ✓
- P2: request R1, R2 (has it). Waiting for R1 (held by P1), but P1 is waiting for R3 (held by P3), and P3 is waiting for R2 (held by P2). Cycle still exists!

Let me revise: Resource order should break the current cycle. The cycle is P1 → P3 → P2 → P1 (via R3, R2, R1). If P2 acquires in order R1, then R2 (not R2 then R1), the cycle is broken. Assign: R1 < R2 < R3, and each process requests in order: P1 (R1 before R2 before R3), P2 (R1 before R2), P3 (R2 before R3). Now P2 won't hold R2 while waiting for R1 (it requests R1 first). Cycle broken.

---

### Problem 5 — Paging and Working Set

**(a)** Naive allocation: A gets 200 MB, B gets 300 MB. Total: 500 MB used out of 4 GB. Utilization: 500 / 4000 = 12.5%. If a third process arrives (requiring, say, 250 MB), the system is forced to swap out one process or allow paging overhead to increase (thrashing risk).

**(b)** Minimum memory to avoid thrashing:
- A: 200 MB (full working set)
- B: 300 MB (full working set)
- Total: 500 MB

**(c)** With 800 MB available:
- Can both run? 200 + 300 = 500 MB < 800 MB. Yes, both can fit with 300 MB spare.
- If additional overhead or fragmentation occurs, both can still run without thrashing (500 < 800).
- OS actions: allocate 200 to A, 300 to B. Monitor page-fault rate. If thrashing is detected (high fault rate, low CPU utilization), the OS might suspend one process or deny new process admits.

---

### Problem 6 — Filesystem I/O

**(a)** 16 KB write requires 16 KB / 4 KB = 4 blocks.
- Blocks 0–2: direct pointers (first 3 blocks)
- Block 3: single-indirect pointer (4th block)

Inode pointers used: 3 direct + 1 single-indirect (the indirect block itself, not the pointer).

**(b)** Estimated I/O operations:

1. **create()**: path walk (root → project dir), allocate inode, update directory
   - ~10 I/Os (cached bitmaps and inodes after initial setup)

2. **write(16 KB)**:
   - Allocate 4 data blocks: 4 * (read bitmap + write bitmap + write data) = 4 * 3 = 12 I/Os
   - Allocate 1 indirect block: read bitmap, write bitmap, write indirect = 3 I/Os
   - Update inode: 1 I/O
   - Total: 16 I/Os

3. **fsync()**: Force data and metadata to disk. Already counted above (no additional I/Os if buffered cache is flushed).

4. **unlink()**: Remove directory entry, deallocate inode, deallocate 4 data blocks and indirect block.
   - Update directory: 1 I/O
   - Update inode bitmap: 1 I/O
   - Update block bitmaps: 5 I/Os (4 data + 1 indirect)
   - Write inode: 1 I/O (clearing it)
   - Total: 8 I/Os

**Total: ~10 + 16 + 8 = 34 I/Os** (with caching optimizations, fewer).

**(c)** Crash after write() but before fsync(): Data written to disk via buffered cache (likely flushed), but inode metadata (pointers to the 4 blocks) might not be persisted if not yet written. On recovery, the inode shows fewer or no blocks assigned, and the 4 data blocks are orphaned (lost data).

Crash after fsync(): All data and metadata flushed to disk. On recovery, the file is intact.

**(d)** Journaling (ordered mode) requires:
- Write data blocks to disk (or to journal).
- Write metadata (inode pointers) to journal.
- Write Transaction End (TxE) to journal.
- On crash before TxE, the transaction is discarded on recovery.
- On crash after TxE, the transaction is replayed (inode and data updated).

This ensures atomicity: either the full write is recovered, or none of it. Orphaned blocks are avoided because the inode update is atomic with respect to the journal.

---

### Problem 7 — Memory Protection and Translation

**(a)** VPN bits: log2(2^16 / 256) = log2(2^16 / 2^8) = log2(2^8) = 8 bits
Offset bits: log2(256) = 8 bits

VA 0x4D3E:
- VPN (top 8 bits): 0x4D >> 8 = 0x4D (wait, 0x4D = 0100 1101 is only 8 bits, and 0x3E = 0011 1110 is 8 bits, so 0x4D3E is the full 16-bit VA)
- Actually, 0x4D3E in 16-bit is [0100 1101][0011 1110]
- VPN (top 8 bits): 0100 1101 = 0x4D
- Offset (bottom 8 bits): 0011 1110 = 0x3E

**(b)** PFN from PTE: 0x2B. PA = (PFN << 8) | offset = (0x2B << 8) | 0x3E = 0x2B3E

**(c)** Protection bits RX (no write): The write operation would trigger a protection fault. The OS would:
- Generate a segmentation fault (SIGSEGV on Unix).
- Terminate the process (or allow the process to handle the signal if a signal handler is registered).

**(d)** Single-level page table: 2^8 entries * 8 bytes = 2 KB per process (fixed, allocated for all processes).

Two-level page table (4-bit L1, 4-bit L2):
- L1 table: 2^4 = 16 entries * 8 bytes = 128 bytes
- L2 tables: allocated only when needed (e.g., 4–8 tables for sparse address space), each 128 bytes.

For sparse usage (e.g., code segment and data segment separate), two-level saves memory (only 128 bytes L1 + N*128 bytes L2, where N << 16).

---

### Problem 8 — Context-Switch Overhead

**(a) FIFO (no preemption):**
Execution order: P1 (10 ms) → P2 (10 ms) → P3 (10 ms).
Total time: 30 ms.

Response times: P1 = 0, P2 = 10, P3 = 20. Average response: 10 ms.
Turnaround times: P1 = 10, P2 = 20, P3 = 30. Average turnaround: 20 ms.

**(b) RR with 1 ms time slice:**
Execution:
- P1 runs 1 ms, context switch 0.5 ms, total 1.5 ms
- P2 runs 1 ms, context switch 0.5 ms, total 1.5 ms
- P3 runs 1 ms, context switch 0.5 ms, total 1.5 ms
- ... repeat until all done.

Each process needs 10 "slices" (10 ms / 1 ms). Total context switches: 30 - 1 = 29 (last slice no switch).
Total time: 10 ms (actual CPU) + 29 * 0.5 ms (switches) = 10 + 14.5 = 24.5 ms.

Rounds: 10 rounds of 3 processes each.
Response times: P1 = 0, P2 = 1.5, P3 = 3. Average response: 1.5 ms.
Turnaround times: P1 = 24.5, P2 = 24.5, P3 = 24.5. Average turnaround: 24.5 ms.

**(c) CPU utilization:**
- FIFO: 30 ms useful CPU / 30 ms total = 100%
- RR: 30 ms useful CPU / 24.5 ms total = 122%? No, wait. Let me recalculate.

Total useful work: 10 + 10 + 10 = 30 ms.
Total time in RR: 24.5 ms (including context-switch overhead).
Utilization: 30 / 24.5 ≈ 122%? That's impossible.

Let me recalculate RR. Each process needs 10 ms of CPU. Time slices are 1 ms each.
- Round 1: P1 (1 ms) + switch (0.5 ms) + P2 (1 ms) + switch (0.5 ms) + P3 (1 ms) + switch (0.5 ms) = 4.5 ms (0.5 ms wasted on first 2 switches)
- After 10 rounds: 10 * 4.5 = 45 ms total.

Utilization: 30 / 45 = 66.7%.

Or, more simply: Overhead = 29 switches * 0.5 ms = 14.5 ms. Useful time = 30 ms. Total time = 30 + 14.5 = 44.5 ms. Utilization = 30 / 44.5 ≈ 67.4%.

Interactive workloads: RR is more efficient (better responsiveness, response time = 1.5 ms vs. 10 ms for FIFO). CPU utilization is lower due to context-switch overhead, but user experience is better.

