# Page Replacement Policies

## Definition

Page replacement policies determine which page to evict when physical memory is full and a new page must be loaded. Policies include optimal (Belady's algorithm), FIFO, LRU, and clock. Optimal minimizes misses but requires future knowledge; LRU and clock are practical approximations. Choice of policy significantly impacts system performance.

## When to use

- Analyze page replacement on memory traces to compute hit/miss rates.
- Understand the trade-off between optimality and implementation cost.
- Compare FIFO's simplicity vs. LRU's better hit rate.
- Implement clock algorithm as a low-cost LRU approximation.

## Key ideas

### Optimal (Belady's Algorithm)

Evict the page that will be accessed furthest in the future (or never again). This minimizes misses but requires knowledge of future accesses—impractical.

**Example**: Pages in memory: [2, 3, 5]. Future accesses: [7, 5, 6, 2, 7, 3, ...]. If 7 arrives and memory is full:
- Page 2 accessed in 3 steps (at time 4).
- Page 3 accessed in 5 steps (at time 6).
- Page 5 accessed in 1 step (at time 2).

Evict page 3 (furthest access). Optimal is used as a benchmark for other policies.

### FIFO (First-In-First-Out)

Evict the oldest page (the one loaded first). Simple to implement with a queue but ignores access patterns. A frequently-used old page might be evicted just because it arrived early.

**Example**: Pages loaded in order [8, 7, 4, 2]. If 5 arrives:
- FIFO evicts 8 (oldest).
- Remaining: [7, 4, 2, 5].

**Anomaly (Belady's Anomaly)**: Increasing memory size can increase misses for FIFO! This is counter-intuitive but happens because FIFO ignores recency.

### LRU (Least-Recently-Used)

Evict the page not accessed for the longest time. Approximates optimal better than FIFO by respecting temporal locality. Requires per-page timestamps or linked list maintenance.

**Example**: Pages in memory: [2, 3, 5]. Last access times: [3, 1, 5] (5 is most recent). If 7 arrives:
- LRU evicts page 3 (access time 1, oldest).
- Remaining: [2, 5, 7].

### Clock Algorithm

A practical approximation of LRU using a "use bit" and circular buffer:

1. Maintain a circular list of frames and a hand pointer.
2. Each frame has a use bit (1 = recently used, 0 = not used).
3. On eviction: scan frames, clearing use bits. Evict the first frame with use bit = 0.
4. On access: set use bit = 1.

**Advantage**: Simpler and faster than LRU (no per-page timestamp), nearly as good on real workloads.

## Pseudocode

```
optimal_replacement(pages_in_memory, future_accesses):
  furthest_distance = -1
  victim = NULL
  
  for each page in pages_in_memory:
    distance = find_next_access(page, future_accesses)
    if distance > furthest_distance or distance == NOT_FOUND:
      furthest_distance = distance
      victim = page
  
  return victim

fifo_replacement(queue):
  victim = queue.dequeue_front()
  return victim

lru_replacement(pages_with_timestamps):
  oldest_time = INFINITY
  victim = NULL
  
  for each page in pages_with_timestamps:
    if page.timestamp < oldest_time:
      oldest_time = page.timestamp
      victim = page
  
  return victim

clock_replacement(frames, hand):
  while true:
    frame = frames[hand]
    if frame.use_bit == 0:
      // Evict this frame
      return frame
    else:
      // Clear use bit and move hand
      frame.use_bit = 0
      hand = (hand + 1) % frames.length
```

## Hand-trace example

**Scenario**: 4-frame memory, page access sequence: 8, 7, 4, 2, 5, 4, 7, 3, 4, 5, 9, 5, 2, 7, 6, 2, 9, 9 (from exam_1.txt, question 5).

### FIFO Trace

| Access | Hit/Miss | Evict | Frames | Justification |
|--------|----------|-------|--------|---------------|
| 8 | Miss | — | [8] | Load 8 |
| 7 | Miss | — | [8, 7] | Load 7 |
| 4 | Miss | — | [8, 7, 4] | Load 4 |
| 2 | Miss | — | [8, 7, 4, 2] | Load 2 (memory full) |
| 5 | Miss | 8 | [7, 4, 2, 5] | FIFO evicts oldest (8) |
| 4 | Hit | — | [7, 4, 2, 5] | 4 already in memory |
| 7 | Hit | — | [7, 4, 2, 5] | 7 already in memory |
| 3 | Miss | 7 | [4, 2, 5, 3] | FIFO evicts oldest (7) |
| 4 | Hit | — | [4, 2, 5, 3] | 4 in memory |
| 5 | Hit | — | [4, 2, 5, 3] | 5 in memory |
| 9 | Miss | 4 | [2, 5, 3, 9] | FIFO evicts oldest (4) |
| 5 | Hit | — | [2, 5, 3, 9] | 5 in memory |
| 2 | Hit | — | [2, 5, 3, 9] | 2 in memory |
| 7 | Miss | 2 | [5, 3, 9, 7] | FIFO evicts oldest (2) |
| 6 | Miss | 5 | [3, 9, 7, 6] | FIFO evicts oldest (5) |
| 2 | Miss | 3 | [9, 7, 6, 2] | FIFO evicts oldest (3) |
| 9 | Hit | — | [9, 7, 6, 2] | 9 in memory |
| 9 | Hit | — | [9, 7, 6, 2] | 9 in memory |

**Total misses**: 10 (accesses 1–4 initialize, then 5, 8, 11, 14, 15, 16).

### LRU Trace

| Access | Hit/Miss | Evict | Frames | Justification |
|--------|----------|-------|--------|---------------|
| 8 | Miss | — | [8] | Load 8 |
| 7 | Miss | — | [8, 7] | Load 7 |
| 4 | Miss | — | [8, 7, 4] | Load 4 |
| 2 | Miss | — | [8, 7, 4, 2] | Load 2 (full) |
| 5 | Miss | 8 | [7, 4, 2, 5] | LRU: 8 least recent |
| 4 | Hit | — | [7, 4, 2, 5] | 4 accessed; update recency |
| 7 | Hit | — | [7, 4, 2, 5] | 7 accessed; update recency |
| 3 | Miss | 2 | [7, 4, 5, 3] | LRU: 2 least recent (never after initial) |
| 4 | Hit | — | [7, 4, 5, 3] | 4 accessed |
| 5 | Hit | — | [7, 4, 5, 3] | 5 accessed |
| 9 | Miss | 7 | [4, 5, 3, 9] | LRU: 7 least recent |
| 5 | Hit | — | [4, 5, 3, 9] | 5 accessed |
| 2 | Miss | 4 | [5, 3, 9, 2] | LRU: 4 least recent |
| 7 | Miss | 3 | [5, 9, 2, 7] | LRU: 3 least recent |
| 6 | Miss | 5 | [9, 2, 7, 6] | LRU: 5 least recent |
| 2 | Hit | — | [9, 2, 7, 6] | 2 accessed; update recency |
| 9 | Hit | — | [9, 2, 7, 6] | 9 accessed |
| 9 | Hit | — | [9, 2, 7, 6] | 9 accessed |

**Total misses**: 10 (same sequence; LRU doesn't improve here).

## Common exam questions

- **MCQ:** For the 18-access trace 8,7,4,2,5,4,7,3,4,5,9,5,2,7,6,2,9,9 with 4 frames, how many FIFO misses occur (per the exam_1 answer key)?
  - [x] 10
  - [ ] 9
  - [ ] 11
  - [ ] 12
  - why: The FIFO trace in the hand-trace counts 4 compulsory misses plus 6 replacement misses = 10, matching the exam_1 answer key.
- **MCQ:** For the same 18-access trace with 4 frames, how many Optimal (Belady) misses occur?
  - [x] 9
  - [ ] 10
  - [ ] 11
  - [ ] 8
  - why: Per the exam_1 answer key: optimal = 9, FIFO = 10, LRU = 11. Optimal always evicts the page used furthest in the future.
- **MCQ:** Why is Belady's optimal page replacement impractical in a real OS?
  - [x] It requires knowledge of future page references.
  - [ ] It requires hardware support that does not exist.
  - [ ] Its per-reference cost is O(n^2) in page count.
  - [ ] It performs worse than FIFO in practice.
  - why: Optimal picks the page used furthest in the future; the OS cannot see the future, so it is used only as a benchmark.
- **MCQ:** What is Belady's Anomaly, and which policies suffer from it?
  - [x] Adding frames can increase faults under FIFO; LRU and Optimal are immune because they are stack algorithms.
  - [ ] Adding frames always reduces faults; the anomaly is theoretical only.
  - [ ] Any replacement policy can show more faults with more frames.
  - [ ] It affects LRU but not FIFO.
  - why: FIFO is not a stack algorithm, so enlarging memory can counter-intuitively increase faults. LRU and Optimal maintain the stack property and never exhibit the anomaly.
- **MCQ:** Why is the Clock algorithm faster than true LRU while approximating it?
  - [x] It uses a single use-bit per frame plus a rotating hand, avoiding per-access timestamp or list updates.
  - [ ] It flushes the TLB less often than LRU.
  - [ ] It evicts pages in FIFO order without any recency tracking.
  - [ ] It requires no hardware support at all.
  - why: True LRU needs to update a timestamp or move a list node on every memory access; Clock only sets the use bit on access and sweeps lazily at eviction time.
- **MCQ:** Clock has swept all frames once and all use bits were initially 1. What is the state after the first full sweep, before any eviction?
  - [x] All use bits are cleared to 0; the next frame with use=0 is evicted.
  - [ ] The frame with the oldest load time is evicted.
  - [ ] The hand wraps and a page fault is raised.
  - [ ] All frames are evicted because they all had use=1.
  - why: The sweep clears use bits as it passes. After one full revolution, all are 0 and the hand can pick a victim on the next step; this is why Clock degenerates toward FIFO when everything is hot.

## Gotchas

- **LRU requires bookkeeping**: Maintaining timestamps or a linked list for every page access has overhead. Hardware support (timestamp registers, linked lists) is often necessary.
- **Clock isn't perfect LRU**: Clock is a two-approximation (sweeps twice before evicting), but can evict a page that will be used again soon, unlike optimal.
- **Belady's Anomaly for FIFO**: FIFO can perform worse with more memory. This doesn't happen with LRU or optimal.
- **Use bit must be cleared**: In clock, after a full sweep, all use bits are cleared. If not, the algorithm behaves like FIFO.
- **Access patterns matter**: LRU assumes temporal locality (recently used pages are reused soon). On random access patterns, LRU and FIFO converge.

## Sources

- exams__exam_1.txt (page 10): Page replacement on 18-access sequence; optimal, FIFO, LRU traces with 4-frame memory (misses: 9 optimal, 10 FIFO, 11 LRU per answer key)
- lectures/Week4_2.pdf: LRU and clock replacement policies, page replacement trade-offs
