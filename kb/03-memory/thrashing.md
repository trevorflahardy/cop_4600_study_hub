# Thrashing

## Definition

Thrashing occurs when the working set of active pages exceeds physical memory, causing continuous page evictions and page faults. The OS spends more time moving pages in and out of memory than executing user instructions, reducing throughput to near zero. Solutions include reducing concurrency, adding physical RAM, or adjusting workload.

## When to use

- Recognize thrashing symptoms (high page fault rate, low CPU utilization).
- Understand why adding swap space alone does not solve thrashing.
- Learn strategies to prevent or recover from thrashing.
- See the fundamental limitation: physical memory cannot be infinite.

## Key ideas

### Working Set

The **working set** of a process is the set of pages it actively uses over a time interval. For example, a loop iterating through an array uses only the pages containing that array.

- **Working set size** (WSS) = number of distinct pages in the working set.
- If WSS fits in physical memory, the process runs efficiently (few page faults).
- If WSS > physical memory, pages are constantly evicted and refetched—thrashing begins.

### The Thrashing Cycle

1. Process A is running and faults on a page.
2. OS evicts a page (from A or another process).
3. OS loads the faulted page from disk.
4. Process A runs briefly and faults again (on a different page, already evicted).
5. Steps 2–4 repeat infinitely; CPU does no useful work.

Each fault takes milliseconds (disk I/O), during which CPU is idle. With many processes thrashing, system throughput approaches 0%.

### Why Swap Space Doesn't Solve Thrashing

From Quiz 5 (zhang__quizzes__Attendance Quiz 5 S26 Key.txt, page 1):
"Increasing the size of the Swap Space will always resolve system 'Thrashing.' False. Thrashing occurs when the working set of memory exceeds physical RAM. Adding Swap Space just gives the OS more room to 'trash' the disk; only adding more Physical RAM or reducing the workload stops it."

Swap space allows the OS to evict more pages, but if the problem is insufficient physical memory, larger swap space just amplifies the eviction/fetch cycle on disk, making things worse (disk I/O becomes the bottleneck).

### Prevention and Recovery

**Prevention**:
- Avoid overcommitting: Keep total working set across all processes <= physical memory.
- Monitor page fault rate; if it spikes, reduce concurrency.
- Use job scheduling to prevent too many memory-intensive jobs running simultaneously.

**Recovery** (if thrashing starts):
- Reduce concurrency: Suspend or kill low-priority processes to free up memory.
- Add more RAM: The most effective solution.
- Optimize workload: Improve cache locality or reduce working set size.

### Detecting Thrashing

**Indicators**:
- High page fault rate (>100 faults/sec typically indicates trouble).
- Low CPU utilization (<10%) despite runnable processes.
- High disk I/O activity (constant page swaps).
- Responsiveness drops dramatically (interactive lag).

The OS can monitor these metrics and trigger recovery actions (suspend processes, adjust scheduling).

## Pseudocode

```
estimate_working_set(process_id, time_window):
  // Sample page accesses over a time window
  pages_accessed = set()
  
  for each page_fault in time_window:
    if fault.process_id == process_id:
      pages_accessed.add(fault.vpn)
  
  wss = |pages_accessed|  // Working set size
  return wss

detect_thrashing(all_processes, physical_memory_size):
  total_wss = 0
  
  for each process:
    wss = estimate_working_set(process)
    total_wss += wss
  
  if total_wss > physical_memory_size:
    // Thrashing likely
    return true
  else:
    return false

recover_from_thrashing(processes):
  // Suspend low-priority processes until WSS <= memory
  priority_sorted = sort(processes, by_priority)
  
  while detect_thrashing(priority_sorted, physical_memory):
    suspended_process = priority_sorted.pop_lowest_priority()
    suspend(suspended_process)
    deallocate_pages(suspended_process)
  
  // System should recover
```

## Hand-trace example

**Scenario**: Physical memory = 100 MB (25 frames at 4 MB each). Two processes with working sets.

| Process | Pages in WSS | WSS Size | State |
|---------|--------------|----------|-------|
| A | {1, 2, 3, 4, 5, 6, 7, 8} | 8 frames = 32 MB | Active |
| B | {10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20} | 11 frames = 44 MB | Active |

Total WSS = 32 + 44 = 76 MB < 100 MB → **No thrashing**. Both processes fit; page faults are rare.

Now increase B's working set:

| Process | Pages in WSS | WSS Size | State |
|---------|--------------|----------|-------|
| A | {1–8} | 32 MB | Active |
| B | {10–30} | 84 MB | Active |

Total WSS = 32 + 84 = 116 MB > 100 MB → **Thrashing begins**!

Clock:

| Time | Event | CPU Util | Page Faults/sec | Action |
|------|-------|----------|-----------------|--------|
| T0 | Both running, WSS = 116 MB | 85% | 2 | Normal operation |
| T1 | Increase load | 60% | 15 | Page faults increase |
| T2 | Increase more | 20% | 150 | Thrashing; mostly I/O |
| T3 | OS detects thrashing | 5% | 500 | System nearly dead |
| T4 | OS suspends process B | 90% | 5 | Recovery; B swapped out entirely |
| T5 | System stable | 85% | 2 | Process A runs smoothly |

At T3, physical memory sees: evict a page from B, load a page for B, evict a page from A, load a page for A, repeat. Disk I/O dominates; CPU is idle waiting for I/O.

## Common exam questions

- **MCQ:** Which best describes thrashing?
  - [x] Total working-set size exceeds physical RAM, so the CPU spends most of its time swapping pages instead of executing code.
  - [ ] A deadlock on the page table lock that halts memory allocation.
  - [ ] TLB misses dominate the critical path of every instruction.
  - [ ] Too many context switches between I/O-bound processes.
  - why: Thrashing is fundamentally a memory pressure problem: page fault rate saturates disk I/O and CPU utilization collapses.
- **MCQ:** True or False: "Increasing the size of the swap space will always resolve thrashing."
  - [x] False: more swap only lets the OS evict more; only more physical RAM or reducing workload fixes it.
  - [ ] True: larger swap proportionally reduces page-fault latency.
  - [ ] True: thrashing is caused by running out of swap space.
  - [ ] False: increasing swap has no effect at all on paging behavior.
  - why: Per Quiz 5, swap just gives the OS more room to thrash the disk. The root cause is insufficient RAM for the active working set.
- **MCQ:** Process A has WSS 64 MB, process B has WSS 80 MB, and physical memory is 128 MB. Do they thrash?
  - [x] Yes: combined WSS = 144 MB > 128 MB, forcing continuous evictions.
  - [ ] No: each process individually fits in 128 MB.
  - [ ] No: swap space prevents thrashing entirely.
  - [ ] Yes, but only if they share pages.
  - why: Thrashing depends on total active working-set size. 64 + 80 = 144 > 128, so physical memory cannot hold both working sets concurrently.
- **MCQ:** Which combination of system metrics most clearly indicates thrashing?
  - [x] High page-fault rate with low CPU utilization and high disk I/O.
  - [ ] Low page-fault rate with high CPU utilization.
  - [ ] High CPU utilization with low disk I/O.
  - [ ] High TLB hit rate with high CPU utilization.
  - why: Thrashing's signature is CPU stalled on I/O: many faults per second, disk busy, CPU idle despite ready processes.
- **MCQ:** Which recovery action most directly relieves thrashing?
  - [x] Suspend or kill low-priority processes to shrink total working-set demand.
  - [ ] Increase swap space.
  - [ ] Increase the page size uniformly for all processes.
  - [ ] Increase TLB associativity.
  - why: Reducing concurrency brings total WSS back under physical memory. Adding RAM is the other effective fix; none of the distractors solve the underlying memory-demand mismatch.
- **MCQ:** Which statement about the working set is correct?
  - [x] It is the set of distinct pages a process actively uses over a recent time interval.
  - [ ] It is the total number of pages the process has ever touched.
  - [ ] It is the physical frames reserved for the process at startup.
  - [ ] It is the pages currently resident in the TLB.
  - why: Working set is a time-bounded notion of "currently hot" pages. If the WSS fits in RAM, faults are rare; if not, thrashing begins.

## Gotchas

- **Swap space amplifies thrashing**: Large swap allows the OS to page out more, but disk I/O becomes the bottleneck. The problem isn't storage; it's that disk is orders of magnitude slower than RAM.
- **Thrashing is hard to predict**: Working set size depends on phase of execution. A process might thrash in one phase and not in another.
- **Recovery is not automatic**: The OS must detect thrashing (via metrics like page fault rate) and take action. If the OS doesn't suspend processes, thrashing persists.
- **Context switching overhead**: When thrashing, not only page faults slow things down, but also frequent context switches (waiting for I/O) add overhead.
- **Not always the OS's fault**: If user runs too many memory-intensive jobs concurrently, thrashing is inevitable. The solution is at the user/administrator level (run fewer jobs, buy more RAM).

## Sources

- zhang__quizzes__Attendance Quiz 5 S26 Key.txt (page 1): Thrashing definition, swap space ineffectiveness, working set exceeds RAM
- lectures/Week4_2.pdf: Page replacement, memory full, swap space concepts
