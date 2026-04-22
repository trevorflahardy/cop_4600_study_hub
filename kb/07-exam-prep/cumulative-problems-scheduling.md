# Cumulative Scheduling Problems

## Overview

This problem set covers CPU scheduling algorithms across the semester: FIFO, Shortest Job First (SJF), Shortest Time-to-Completion First (STCF), Round Robin (RR), Multilevel Feedback Queue (MLFQ), Lottery scheduling, and Completely Fair Scheduler (CFS). Each problem asks you to compute metrics like average turnaround time, average response time, or schedule trace diagrams. Use these to practice algorithm mechanics, understand trade-offs between fairness and responsiveness, and identify scheduling pathologies like starvation and gaming.

## Problem 1: FIFO vs SJF vs STCF

**Setup:**
Four processes arrive and have these properties:
- Process A: arrival 0, burst 3
- Process B: arrival 1, burst 6
- Process C: arrival 4, burst 4
- Process D: arrival 6, burst 2

Tiebreaker rules: (1) if multiple processes are ready, shorter remaining job wins; (2) if remaining bursts are equal, process that arrived earlier wins.

**Task:**
Compute for each scheduler:
1. Process execution order (trace)
2. Average turnaround time (completion time − arrival time, averaged)
3. Average response time (first-run time − arrival time, averaged)

Schedulers to evaluate: FIFO, SJF (non-preemptive), STCF (preemptive).

**Solution:**

**FIFO (First In, First Out):**
Execution order: A → B → C → D
- A: runs 0–3 (turnaround = 3 − 0 = 3, response = 0 − 0 = 0)
- B: runs 3–9 (turnaround = 9 − 1 = 8, response = 3 − 1 = 2)
- C: runs 9–13 (turnaround = 13 − 4 = 9, response = 9 − 4 = 5)
- D: runs 13–15 (turnaround = 15 − 6 = 9, response = 13 − 6 = 7)

Average turnaround: (3 + 8 + 9 + 9) / 4 = 7.25
Average response: (0 + 2 + 5 + 7) / 4 = 3.5

**SJF (Shortest Job First, non-preemptive):**
When B runs at t=3, D (burst 2) has arrived. Choose B (shorter at 6 vs D at 2? No, D is shorter). Execution: A → D → C → B
- A: runs 0–3 (turnaround = 3, response = 0)
- D: runs 3–5 (turnaround = 5 − 6 = −1 invalid). Wait: D arrives at 6, so at t=3 only A, B ready. B (burst 6) vs waiting for D? SJF is non-preemptive, so once A finishes, B starts.
  
Let me recalculate: at t=0 only A is ready. At t=3, A finishes; B and D not yet ready. At t=3 B arrives (arrival 1, already ready since t=1). At t=4 C arrives. At t=6 D arrives.
At t=3: ready={B(burst 6)}. Run B.
At t=9: ready={C(burst 4), D(burst 2)}. D is shorter, run D.
At t=11: ready={C(burst 4)}. Run C.
At t=15: done.

Order: A → B → D → C
- A: turnaround = 3, response = 0
- B: turnaround = 9 − 1 = 8, response = 3 − 1 = 2
- D: turnaround = 11 − 6 = 5, response = 9 − 6 = 3
- C: turnaround = 15 − 4 = 11, response = 9 − 4 = 5

Average turnaround: (3 + 8 + 5 + 11) / 4 = 6.75
Average response: (0 + 2 + 3 + 5) / 4 = 2.5

**STCF (Shortest Time-to-Completion First, preemptive):**
At each time step, run the process with the shortest remaining time. Preemption allowed.

- t=0: A ready (remaining=3). Run A.
- t=1: A ready (remaining=2), B ready (remaining=6). Run A (shorter).
- t=3: A done. B ready (remaining=6), C arrives (remaining=4). Run C (shorter).
- t=4: C (remaining=3), B (remaining=6). Run C.
- t=6: C (remaining=1), D arrives (remaining=2), B (remaining=6). Run C (shorter).
- t=7: C done. D ready (remaining=2), B ready (remaining=6). Run D.
- t=9: D done. B ready (remaining=6). Run B.
- t=15: B done.

Order (trace): A → B → C → A → D → B
Completion times: A=7, B=15, C=7, D=9. Wait, that's wrong; let me re-trace:

Actually let me be more careful. Remaining times evolve:
- t=0–1: A runs. At t=1, A has remaining=2, B arrives with remaining=6, C not yet. A has less, continue A.
- t=1–3: A runs. At t=3, A finishes. B (remaining=6) and C (remaining=4, arrived at t=4, not yet). Run B.
- t=3–4: B runs. At t=4, C arrives (remaining=4), B has remaining=5. C is shorter, switch to C.
- t=4–6: C runs. At t=6, D arrives (remaining=2), C has remaining=2, B has remaining=5. D is equal to C; by tiebreaker (earlier arrival), C continues. Or, tie in remaining time: process that arrived earlier. C arrived at t=4, D at t=6, so C wins.
- t=6–7: C runs, finishes. D (remaining=2), B (remaining=5). Run D.
- t=7–9: D runs, finishes. B (remaining=5). Run B.
- t=9–15: B runs, finishes.

Turnaround times: A=3−0=3, B=15−1=14, C=7−4=3, D=9−6=3
Average turnaround: (3 + 14 + 3 + 3) / 4 = 5.75

Response times: A=0−0=0, B=3−1=2, C=4−4=0, D=7−6=1
Average response: (0 + 2 + 0 + 1) / 4 = 0.75

**Why it matters:**
FIFO is simple but poor at responsiveness and punishes short jobs. SJF is better at turnaround time but can starve long jobs and is not preemptive. STCF is optimal for turnaround time among non-preemptive schedulers, but high context-switch overhead and poor interactivity (long jobs must finish, blocking I/O). In practice, STCF is rarely used; MLFQ and CFS better balance turnaround and responsiveness.

---

## Problem 2: MLFQ Gaming and Rule 4

**Setup:**
An MLFQ with 3 queues (priority 0 highest, 2 lowest):
- Queue 0: time slice 8ms, allotment 32ms
- Queue 1: time slice 16ms, allotment 64ms
- Queue 2: time slice 32ms, allotment infinite (FIFO)

MLFQ Rules 1–5:
1. If A.priority > B.priority, A runs.
2. If A.priority == B.priority, A and B run in RR.
3. When a job enters, it starts in Queue 0.
4. If a job uses its allotment, demote to next queue.
5. After period S, move all jobs to Queue 0 (priority boost).

**Task:**
A CPU-bound job X and an I/O-bound job Y (yields before allotment) both arrive at t=0.
- X: 100ms CPU burst, never yields.
- Y: 2ms CPU, yield, 2ms CPU, yield, ... (repeats).

**Questions:**
1. Without Rule 4, what could X do to game the scheduler?
2. With Rule 4 in place, trace the first 100ms of execution assuming S=50ms (boost period).
3. Why is Rule 5 necessary?

**Solution:**

1. **Gaming without Rule 4:** X could repeatedly yield to the CPU just before exhausting its allotment. Each yield resets the allotment counter, so X stays in Queue 0 indefinitely, starving Y. X gets high priority despite being CPU-bound.

2. **Execution trace with Rule 4 (S=50ms):**

| Time | Job X remaining | Job Y remaining | Queue 0 | Queue 1 | Queue 2 | CPU | Notes |
|------|---|---|---|---|---|---|---|
| 0    | 100 | 0 (yielding)   | X (alloc 32), Y (alloc 32) | | | X runs 8ms | Y idle, waiting for I/O |
| 8    | 92  | 0 (yielding)   | X, Y | | | Y yields, runs 2ms | |
| 10   | 92  | 0 (yielding)   | X, Y | | | X runs 8ms | Y still I/O |
| 18   | 84  | 0 (yielding)   | X, Y | | | Y yields, 2ms | |
| 20   | 84  | 0 (yielding)   | X, Y | | | X runs 8ms | Continues... |
| 32   | 72  | (Y alloc used)   | X (alloc 16ms left) | Y (Queue 1, alloc 64ms) | | Y → Queue 1 | X remains Q0 |
| 32   | 72  | | X (alloc 16) | Y (alloc 64) | | X runs 8ms | |
| 40   | 64  | | X (alloc 8) | Y | | Y runs 2ms | |
| 42   | 64  | | X (alloc 8) | Y | | X runs 8ms | |
| 50   | 56  | | **BOOST: all to Q0** | (empty) | (empty) | X runs 8ms | S=50ms boost |
| 50–100 | ... | ... | X (new alloc 32) | ... | ... | Repeat Q0 RR with Y | Y stays Q0 (I/O bound re-enters Q0) |

By t=100, X runs most of the CPU because Y yields frequently. Y stays in Q0 after each boost (Rule 5 prevents starvation).

3. **Why Rule 5 is necessary:** Without periodic boost, jobs that become interactive later (initially CPU-bound but then yield more) remain demoted forever. Rule 5 ensures fairness: after S time, all jobs get a chance to prove they are now interactive.

**Why it matters:**
MLFQ must balance responsiveness (prioritize I/O-bound jobs) with preventing gaming and starvation. Rules 4 and 5 are crucial defenses. Understanding these rules prepares you for real schedulers like Linux CFS, which use virtual runtime instead of explicit queues but solve the same problems.

---

## Problem 3: CFS Virtual Runtime and Scheduling

**Setup:**
Completely Fair Scheduler (CFS) parameters:
- sched_latency (L) = 48ms (target period for all runnable tasks to run)
- min_granularity (g) = 6ms (minimum time slice)
- Three tasks arrive at t=0: A (nice=0, weight=1024), B (nice=0, weight=1024), C (nice=-5, weight=3121)

Nice-to-weight mapping: nice=0 → 1024, nice=-5 → 3121 (from Linux kernel).

**Task:**
1. Compute each task's time slice for the first scheduling round.
2. After the first 12ms of wall-clock time (let's say all tasks run sequentially in order A, B, C), compute each task's vruntime.
3. Which task runs first in the second round?

**Solution:**

1. **Time slices:**
Total weight = 1024 + 1024 + 3121 = 5169

Time slice for task i = (weight_i / total_weight) × L, but minimum g:
- A: (1024 / 5169) × 48 = 9.56ms
- B: (1024 / 5169) × 48 = 9.56ms
- C: (3121 / 5169) × 48 = 28.88ms

All exceed g=6ms, so no adjustment needed.

2. **Virtual runtimes after first 12ms of wall-clock time:**
vruntime updates as: vruntime_new = vruntime_old + (1024 / weight) × wall_time_ran

Assuming A runs 0–9.56ms, B runs 9.56–9.56+9.56=19.12ms (but only 12−9.56=2.44ms available), C gets the rest.

Actually, let's say for simplicity: A runs 4ms, B runs 4ms, C runs 4ms (hypothetical distribution):
- A: vruntime = 0 + (1024 / 1024) × 4 = 4
- B: vruntime = 0 + (1024 / 1024) × 4 = 4
- C: vruntime = 0 + (1024 / 3121) × 4 = 1.31

If instead A runs its full slice 9.56ms:
- A: vruntime = 0 + (1024 / 1024) × 9.56 = 9.56
- After A, B runs 2.44ms (to reach 12ms total):
- B: vruntime = 0 + (1024 / 1024) × 2.44 = 2.44
- C hasn't run yet: vruntime = 0

3. **Next task to run:** The task with minimum vruntime (C at 0) runs next.

**Why it matters:**
CFS uses virtual runtime to achieve fairness across nice levels without explicit queues. The weight-based slice ensures high-priority tasks (nice < 0) get more wall-clock time while maintaining proportional fairness. This is used in modern Linux kernels.

---

## Problem 4: Lottery Scheduling Fairness

**Setup:**
Lottery scheduler with three tasks: A (50 tickets), B (25 tickets), C (25 tickets).
Total tickets = 100.

Assume we run 100 ticks (time units) and observe:
- A runs 48 ticks
- B runs 27 ticks
- C runs 25 ticks

**Task:**
1. What is the expected allocation (in ticks) for each task?
2. What is the observed unfairness metric U = max_time / min_time?
3. Why is C's actual allocation close to expected but B's is not?

**Solution:**

1. **Expected allocation:**
- A: (50/100) × 100 = 50 ticks
- B: (25/100) × 100 = 25 ticks
- C: (25/100) × 100 = 25 ticks

2. **Observed unfairness:**
U = max_time / min_time = 48 / 25 = 1.92

(Note: Expected U for lottery is O(log N) with high probability over many rounds, but short runs see statistical variance.)

3. **Why the variance?**
Lottery is probabilistic. Over 100 ticks:
- A (50% chance each tick) sees binomial variance: σ = sqrt(100 × 0.5 × 0.5) ≈ 5. Expected ±2σ ≈ ±10 ticks → range [40, 60]. A at 48 is within 1σ.
- B (25% chance) has σ = sqrt(100 × 0.25 × 0.75) ≈ 4.3. Expected ±2σ ≈ ±8.6 → range [16.4, 33.6]. B at 27 is within 1σ.
- C at 25 is exactly expected (lucky).

Short runs have high variance. Over longer periods (e.g., 10,000 ticks), all tasks converge toward expected.

**Why it matters:**
Lottery scheduling is simple, proportionally fair, and avoids starvation (every ticket holder eventually runs). However, interactive response is poor due to variance. It's rarely used in practice but illustrates randomized scheduling concepts.

---

## Problem 5: Stride Scheduling

**Setup:**
Stride scheduler with three tasks:
- A: 20 tickets, stride = BIG / 20 = 1000 / 20 = 50
- B: 10 tickets, stride = BIG / 10 = 1000 / 10 = 100
- C: 10 tickets, stride = BIG / 10 = 1000 / 10 = 100

Constant BIG = 1000. Initial pass values: all 0.

**Task:**
Trace the first 6 scheduler invocations. Show which task runs at each step and update its pass value.

**Solution:**

| Step | A pass | B pass | C pass | Min task | Task runs | Update pass |
|------|--------|--------|--------|----------|-----------|-------------|
| 1    | 0      | 0      | 0      | A, B, C (tie) | A (first in tie) | A: 0+50=50 |
| 2    | 50     | 0      | 0      | B, C (tie) | B (first) | B: 0+100=100 |
| 3    | 50     | 100    | 0      | C | C | C: 0+100=100 |
| 4    | 50     | 100    | 100    | A | A | A: 50+50=100 |
| 5    | 100    | 100    | 100    | A, B, C (tie) | A | A: 100+50=150 |
| 6    | 150    | 100    | 100    | B, C (tie) | B | B: 100+100=200 |

Order: A, B, C, A, A, B

A runs 3 out of 6 times (50% match), B and C run 1.5 out of 6 each (25% each). Over longer runs, proportions match ticket ratios exactly.

**Why it matters:**
Stride scheduling achieves proportional fairness deterministically (no variance like lottery). Each task's pass value ensures it doesn't fall too far behind its allocated share. Stride is used in some kernel schedulers and illustrates how to track fairness without randomness.

