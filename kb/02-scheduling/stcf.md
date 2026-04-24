# Shortest Time-to-Completion First (STCF)

## Definition

STCF (also called Preemptive SJF or PSJF) is a preemptive scheduler that runs the job with the shortest remaining time. When a new job arrives, the scheduler compares its remaining burst time to the running job's remaining time; if the new job is strictly shorter, the running job is preempted.

## When to use

- Systems where minimizing average turnaround time is critical and jobs can be interrupted.
- When staggered arrivals are expected, STCF offers better turnaround than non-preemptive SJF.
- Still not ideal for interactive systems (response time may not be great).

## Key ideas

STCF fixes SJF's late-arrival problem by allowing preemption. The key rule: **STCF only preempts when a strictly shorter job arrives.** If the current job ties for shortest remaining time, it continues running (tiebreak rule from Quiz 2).

By preempting long jobs as soon as shorter jobs arrive, STCF keeps short jobs from waiting behind long ones. This gives both good turnaround time and better response time for short jobs compared to SJF.

Trade-off: More preemption means more context switches. The scheduler must decide on each arrival whether preemption is beneficial.

## Pseudocode

```
while (true):
    if (new job arrives):
        if (remaining_time(new_job) < remaining_time(current_job)):
            preempt current_job and put it back in ready queue
            current_job = new_job
        else:
            add new_job to ready queue
    if (current_job finishes or was preempted):
        job = job_with_shortest_remaining_time_in_ready_queue()
        current_job = job
```

## Hand-trace example

**Process set (Quiz 2):**

| Process | Arrival Time | CPU Burst |
|---------|--------------|-----------|
| A       | 0            | 3         |
| B       | 1            | 6         |
| C       | 4            | 4         |
| D       | 6            | 2         |

**Scheduling trace (at each event, determine remaining times and preemption):**
- t=0: A arrives, remaining(A)=3. No job running → run A.
- t=1: B arrives, remaining(B)=6, remaining(A)=2. B not shorter → B waits.
- t=3: A finishes. Ready: B (rem=6), C not yet, D not yet → run B.
- t=4: C arrives, remaining(C)=4, remaining(B)=5. C is strictly shorter → preempt B, run C. (B has rem=5 > C's rem=4.)
- t=6: D arrives, remaining(D)=2, remaining(C)=2. Tie for shortest → C continues (tiebreak: no preemption on tie).
- t=8: C finishes. Ready: B (rem=5), D (rem=2) → run D.
- t=10: D finishes. Ready: B (rem=5) → run B.
- t=15: B finishes.

**Gantt chart:**

```
A   B   C       D   B
|---|--|----|---|---|-----------|
0   3 4 8   10  15
```

Wait, let me recalculate more carefully:
- t=0-3: A runs (burst 3).
- t=3: B ready (burst 6), no C or D yet → run B.
- t=4: C arrives (burst 4). B has rem=5 (3 seconds elapsed from t=3), C has burst=4. 4 < 5, so preempt B.
- t=4-6: C runs (burst 4, but 2 seconds elapsed), remaining(C)=2.
- t=6: D arrives (burst 2). C has rem=2, D has burst=2. Tie → C continues.
- t=8: C finishes. D ready with burst=2 → run D.
- t=10: D finishes. B ready with rem=(6-3)=3... wait, B ran from t=3-4, so rem=5.
- t=10-15: B runs (rem=5).

Let me recompute systematically:
- t=0: A arrives, burst=3 → run A.
- t=1: B arrives, burst=6. A running, rem(A)=2. No preemption.
- t=3: A finishes. Ready: B (burst=6). Run B.
- t=4: C arrives, burst=4. B running from t=3, elapsed=1, rem(B)=5. C (burst=4) < B (rem=5) → preempt B, run C.
- t=6: D arrives, burst=2. C running from t=4, elapsed=2, rem(C)=2. D (burst=2) = C (rem=2) → tie, continue C.
- t=8: C finishes. Ready: B (rem=5), D (burst=2). D shorter → run D.
- t=10: D finishes. Ready: B (rem=5) → run B.
- t=15: B finishes.

**Gantt chart:**

```
A   B   C       D   B
|---|--|----|---|---|-----------|
0   3 4 8   10  15
```

**Metrics table:**

| Process | Response Time | Turnaround Time | Wait Time |
|---------|---------------|-----------------|-----------|
| A       | 0 (arrives at 0, runs at 0) | 3 (completes at 3, arrived at 0) | 0 |
| B       | 2 (arrives at 1, first runs at 3 → 3-1=2) | 14 (completes at 15, arrived at 1 → 15-1=14) | 2+5=7 (waits 1-3 and 4-10) |
| C       | 0 (arrives at 4, runs at 4) | 4 (completes at 8, arrived at 4 → 8-4=4) | 0 |
| D       | 2 (arrives at 6, runs at 8 → 8-6=2) | 4 (completes at 10, arrived at 6 → 10-6=4) | 2 |
| **Average** | **(0+2+0+2)/4 = 1** | **(3+14+4+4)/4 = 6.25** | **(0+7+0+2)/4 = 2.25** |

## Complexity

O(n) per scheduling decision (finding shortest remaining time).

## Common exam questions

- **MCQ:** What is the key difference between SJF and STCF?
  - [x] STCF is preemptive; SJF is non-preemptive
  - [ ] STCF needs ticket counts; SJF does not
  - [ ] SJF uses remaining time; STCF uses total burst time
  - [ ] STCF requires round-robin within each priority level
  - why: STCF preempts a running job when a strictly shorter job arrives, while SJF always runs the current job to completion.

- **MCQ:** Per the Quiz 2 tiebreak rule, when should STCF preempt a running job?
  - [x] Only when the new job's remaining time is strictly less
  - [ ] Whenever any new job arrives
  - [ ] When the new job's remaining time is less than or equal
  - [ ] Only at quantum boundaries
  - why: On ties, the current job continues — avoiding needless context switches when preemption would not help turnaround.

- **MCQ:** With process set A:0/3, B:1/6, C:4/4, D:6/2, what is the STCF scheduling order?
  - [x] A, B, C, D, B
  - [ ] A, B, D, C
  - [ ] A, C, D, B
  - [ ] A, B, C, B, D
  - why: A runs 0-3, B runs 3-4, C preempts B at t=4 (C=4 < B rem=5), C runs 4-8 (D ties at t=6 so C continues), D runs 8-10, B resumes 10-15.

- **MCQ:** For that same set, what is the average response time under STCF?
  - [x] 1
  - [ ] 1.25
  - [ ] 2.25
  - [ ] 3.5
  - why: Response times are A=0, B=2, C=0, D=2, averaging (0+2+0+2)/4 = 1.

- **MCQ:** For that same set, what is the average turnaround time under STCF?
  - [x] 6.25
  - [ ] 6.75
  - [ ] 8
  - [ ] 7.25
  - why: Turnarounds are A=3, B=14, C=4, D=4, averaging (3+14+4+4)/4 = 6.25.

- **MCQ:** What is the main cost of STCF relative to SJF?
  - [x] More context switches due to preemption
  - [ ] Higher average turnaround time
  - [ ] Requires random number generation
  - [ ] Needs a red-black tree to function
  - why: Each preemption pays a context-switch cost; STCF's aggressive preemption trades that cost for lower waiting for short jobs.

## Gotchas

- **Tiebreak rule**: If two jobs have the same remaining time, the current job continues; no preemption on ties.
- **Turnaround ≠ response**: STCF is great for turnaround but not necessarily for response time (C and D have 0 response but B is delayed).
- **Context switch overhead**: Each preemption incurs a context-switch cost; STCF maximizes switches compared to SJF.

## Sources

- lectures__Week3_1.txt (pages 7-9): STCF definition, preemption concept, and example.
- zhang__quizzes__Attendance Quiz 2 S26 Key.txt: STCF trace with tiebreak rule "STCF only preempts when a strictly shorter job arrives."
- exams__exam_1_prep__midterm1A_S25_answers.txt: STCF average TAT = 10, response time = 1.25.
