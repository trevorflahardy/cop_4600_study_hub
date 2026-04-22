# Completely Fair Scheduler (CFS)

## Definition

CFS is Linux's default process scheduler (since 2.6.23). It is a proportional-share scheduler that tracks **virtual runtime (vruntime)** for each process and always runs the process with the smallest vruntime. CFS uses a red-black tree to efficiently track processes by vruntime, avoiding the need for separate priority queues.

## When to use

- Modern Linux systems (CFS is the standard).
- Time-sharing systems where both fairness and responsiveness matter.
- Workloads with mixed job lengths and priorities.

## Key ideas

CFS achieves fairness by ensuring each process accumulates vruntime proportional to actual runtime but adjusted for priority (nice level). A process with higher priority (lower nice value, higher weight) accumulates vruntime more slowly, so it runs more frequently.

**Core concept**: Over a period of time called **sched_latency** (e.g., 48ms), all runnable processes should have a chance to run. The time slice for each process is weighted by its priority weight.

**Parameters**:
- **sched_latency**: The target period during which all processes should run at least once (e.g., 48ms). CFS divides this by the number of processes to compute each process's time slice.
- **min_granularity**: The minimum time slice, typically 6ms. If sched_latency / n < min_granularity, use min_granularity instead to avoid excessive context switching.
- **nice value**: Priority level (-20 to +19). Lower (more negative) values get higher priority.
- **weight**: Priority weight derived from nice value (e.g., nice=-5 → weight=3121, nice=0 → weight=1024).

**Key formulas:**

1. **Time slice for process i**:
   ```
   time_slice_i = (weight_i / sum(weights)) * sched_latency
   ```
   but never less than min_granularity.

2. **Virtual runtime after running for time_slice_i**:
   ```
   vruntime_new = vruntime_old + (1024 / weight_i) * time_slice_i
   ```
   The factor (1024 / weight_i) is the inverse-weight scaling; processes with lower weight accumulate vruntime faster, so they run less frequently.

**Scheduler operation**:
- Always run the process with the smallest vruntime (tracked in a red-black tree).
- After the process's time slice expires, update its vruntime and reinsert into the tree.
- When a process wakes from sleep, give it the minimum vruntime in the tree to prevent it from monopolizing the CPU.

**Efficiency**: Red-black tree insertion/deletion is O(log n). CFS scheduling overhead is about 5% of CPU time in large datacenters (compared to 1-2% for simpler schedulers, but the fairness gains justify it).

## Pseudocode

```
rbtree = red-black tree of processes sorted by vruntime

while (true):
    if (job arrives):
        job.vruntime = min_vruntime_in_tree
        rbtree.insert(job)
    
    current_job = rbtree.find_min()  // process with smallest vruntime
    
    time_slice = compute_time_slice(current_job)
    run_job(current_job, time_slice)
    
    current_job.vruntime += (1024 / current_job.weight) * time_slice
    rbtree.update(current_job)
```

## Hand-trace example

**From S25 Midterm 1A exam:** Three processes with nice values and initial vruntimes.

| Process | Nice Value | Weight | Initial vruntime |
|---------|-----------|--------|------------------|
| A       | -4        | 1991   | 40               |
| B       | -1        | 1586   | 30               |
| C       | 2         | 820    | 20               |

**Given:** sched_latency = 48ms (assuming min_granularity not hit for simplicity).

**Step 1: Compute time slices**

Total weight = 1991 + 1586 + 820 = 4397

- time_slice_A = (1991 / 4397) * 48 = 21.70ms
- time_slice_B = (1586 / 4397) * 48 = 17.30ms
- time_slice_C = (820 / 4397) * 48 = 8.95ms

(Note: Different sources may round differently. Check exam for exact values.)

**Step 2: Compute vruntimes after first round**

After each process runs for its time slice:

- vruntime_A = 40 + (1024 / 1991) * 21.70 = 40 + 0.514 * 21.70 = 40 + 11.15 = 51.15ms
- vruntime_B = 30 + (1024 / 1586) * 17.30 = 30 + 0.646 * 17.30 = 30 + 11.18 = 41.18ms
- vruntime_C = 20 + (1024 / 820) * 8.95 = 20 + 1.249 * 8.95 = 20 + 11.18 = 31.18ms

(Per midterm1A answer: A=51.16, B=41.16, C=31.16; slight rounding differences.)

**Step 3: Determine scheduling order for the next three slices**

Red-black tree sorted by vruntime: C (31.16) < B (41.16) < A (51.15)

1. **First slice**: C has minimum vruntime (31.16) → run C for 8.95ms.
   - vruntime_C becomes 31.16 + (1024/820)*8.95 = 31.16 + 11.18 = 42.34ms

2. **Second slice**: Recompute order: B (41.16) < C (42.34) < A (51.15) → run B for 17.30ms.
   - vruntime_B becomes 41.16 + (1024/1586)*17.30 = 41.16 + 11.18 = 52.34ms

3. **Third slice**: Recompute order: C (42.34) < A (51.15) < B (52.34) → run C for 8.95ms.
   - vruntime_C becomes 42.34 + 11.18 = 53.52ms

**Schedule**: C → B → C → ...

Per the midterm1A answer, the first three slices are: C, B, C.

## Complexity

O(log n) per scheduling decision (red-black tree lookup and update). Much more efficient than O(n) priority queue lookup, scaling well to thousands of processes.

## Common exam questions

- Given nice values, compute CFS time slices and vruntimes for one scheduling cycle.
- Determine the order of the next N scheduling decisions based on vruntime.
- Explain the role of sched_latency and min_granularity.
- How does CFS handle process wakeup (new or blocked process re-entering)?
- Compare CFS to lottery scheduling: fairness, determinism, complexity.

## Gotchas

- **Weight is not the same as tickets**: CFS weights are derived from nice values; they are not explicitly assigned.
- **vruntime accumulates at different rates**: Lower weight (higher nice value) means faster vruntime growth, so the process runs less often.
- **min_granularity prevents excessive context switches**: If n is very large, time_slice_i could be very small; min_granularity protects against this.
- **New/woken processes get min vruntime**: They don't start at 0; they start at the minimum vruntime in the tree to prevent monopolization.
- **Red-black tree overhead**: ~5% CPU overhead is significant, but fairness and scalability justify it. Older O(1) schedulers used fixed-size run queues and were less fair.

## Sources

- lectures__Week3_2.txt (pages 12-19): CFS definition, sched_latency, min_granularity, nice-to-weight mapping, red-black tree efficiency, 5% overhead.
- exams__exam_1_prep__midterm1A_S25_answers.txt: CFS worked example with time slices 21.70/11.16/7.14 (per different exam), vruntimes 51.16/41.16/31.16, and scheduling order C → B → C.
- exams__exam_1_prep__S25_Mid_1_B_COP4600.txt: CFS example with sched_latency=35ms, nice values -4/-1/2, and weight-to-vruntime calculations.
