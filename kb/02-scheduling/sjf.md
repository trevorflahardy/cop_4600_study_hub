# Shortest Job First (SJF)

## Definition

SJF is a non-preemptive scheduler that always runs the job with the shortest remaining CPU burst time. If all jobs are known in advance and arrive together, SJF minimizes average turnaround time optimally.

## When to use

- Batch systems where job lengths are known or predictable.
- When minimizing average turnaround time is the primary goal.
- Not suitable for interactive systems (poor response time) or unknown job lengths.

## Key ideas

SJF prioritizes short jobs over long ones. Because context switch overhead is avoided (non-preemptive), and short jobs complete quickly and free up the CPU, SJF achieves better average turnaround than FIFO when all jobs arrive simultaneously.

**Optimal property**: When all jobs arrive at time t=0 and burst times are known, SJF minimizes average turnaround time (proof: shorter jobs move to the front, so the weighted wait time decreases).

**Late arrivals problem**: SJF loses its advantage if jobs arrive at different times. A long job that arrives first will still run to completion, blocking short jobs that arrive later. This is why preemption (STCF) is needed for true shortest-remaining-time scheduling.

Example: A=100s (arrives at t=0), B=10s and C=10s (arrive at t=10). SJF still runs A first (it's already started), so avg TAT ≈ 103.3s—almost as bad as FIFO.

## Pseudocode

```
while (true):
    if (any jobs ready):
        job = job_with_shortest_burst_among_ready()
        run_job(job)  // runs to completion
        job completes
    else:
        wait for arrival
```

## Hand-trace example

**Process set (Quiz 2):**

| Process | Arrival Time | CPU Burst |
|---------|--------------|-----------|
| A       | 0            | 3         |
| B       | 1            | 6         |
| C       | 4            | 4         |
| D       | 6            | 2         |

**Scheduling order (at each decision point, pick the shortest job ready):**
- t=0: A ready (burst=3), run A → completes at t=3.
- t=3: B ready (burst=6), C not yet arrived, D not yet arrived → run B → completes at t=9.
- t=9: C ready (burst=4), D ready (burst=2) → pick D (shorter) → completes at t=11.
- t=11: C ready (burst=4) → run C → completes at t=15.

**Gantt chart:**

```
A       B                 D    C
|-------|-------|-------|-------|---------|
0       3       9       11      15
```

**Metrics table:**

| Process | Response Time | Turnaround Time | Wait Time |
|---------|---------------|-----------------|-----------|
| A       | 0 (arrives at 0, runs at 0) | 3 (completes at 3, arrived at 0 → 3-0=3) | 0 |
| B       | 2 (arrives at 1, runs at 3 → 3-1=2) | 8 (completes at 9, arrived at 1 → 9-1=8) | 2 |
| C       | 7 (arrives at 4, runs at 11 → 11-4=7) | 11 (completes at 15, arrived at 4 → 15-4=11) | 7 |
| D       | 5 (arrives at 6, runs at 9 → 9-6=3... wait, D runs at 9, arrives at 6 → 9-6=3) | 9 (completes at 11, arrived at 6 → 11-6=5) | 3 |
| **Average** | **(0+2+7+3)/4 = 3** | **(3+8+11+5)/4 = 6.75** | **(0+2+7+3)/4 = 3** |

**Note on response time for D:** D arrives at t=6, runs at t=9 → response = 9-6=3. Turnaround = completion time - arrival = 11-6=5.

## Complexity

O(n) to find the shortest job each scheduling decision.

## Common exam questions

- **MCQ:** Under what condition does SJF minimize average turnaround time optimally?
  - [x] All jobs arrive at t=0 and burst times are known in advance
  - [ ] Jobs arrive at arbitrary times and bursts are known
  - [ ] All jobs have equal burst times
  - [ ] The quantum is set to the shortest burst
  - why: SJF is optimal only with simultaneous arrivals; staggered arrivals re-introduce convoy-style waits.

- **MCQ:** With process set A:0/3, B:1/6, C:4/4, D:6/2, what is the SJF scheduling order?
  - [x] A, B, D, C
  - [ ] A, D, C, B
  - [ ] A, B, C, D
  - [ ] B, A, D, C
  - why: A runs at t=0, then B (only ready at t=3), then at t=9 D (burst 2) is shorter than C (burst 4), so D then C.

- **MCQ:** For that same set under SJF, what is the average turnaround time?
  - [x] 6.75
  - [ ] 7.25
  - [ ] 8
  - [ ] 6.25
  - why: Turnarounds are A=3, B=8, C=11, D=5, averaging (3+8+11+5)/4 = 6.75.

- **MCQ:** Why does SJF lose optimality with late-arriving jobs?
  - [x] It is non-preemptive, so a long job already running blocks shorter late arrivals
  - [ ] The ready queue must be sorted, which costs O(n log n) per tick
  - [ ] It cannot compare floating-point burst estimates
  - [ ] It requires tickets like lottery scheduling
  - why: A 100s job that started at t=0 still runs to completion even if shorter jobs arrive at t=10; STCF fixes this with preemption.

- **MCQ:** Which scheduling issue is SJF most susceptible to when short jobs keep arriving?
  - [x] Starvation of long jobs
  - [ ] Priority inversion
  - [ ] Gaming of time slices
  - [ ] Convoy effect
  - why: A steady stream of short jobs keeps the scheduler picking them over any long pending job, so long jobs never run.

- **MCQ:** What is the primary practical obstacle to using SJF in a general-purpose OS?
  - [x] The OS usually does not know each job's burst time in advance
  - [ ] It requires hardware timers faster than 1ms
  - [ ] It cannot run on multicore CPUs
  - [ ] It produces worse turnaround than FIFO
  - why: Real systems lack an oracle for burst length; MLFQ and similar schedulers approximate SJF by learning from observed behavior.

## Gotchas

- **SJF is non-preemptive**: Once a job runs, it cannot be interrupted (unlike STCF).
- **Starvation possible**: Long jobs can be starved if short jobs keep arriving.
- **Assumes known burst times**: In practice, the OS cannot know job lengths in advance; this is why MLFQ and other adaptive schedulers exist.
- **Late-arrival problem**: SJF does not offer optimal turnaround for staggered arrivals; it requires all jobs to be present at t=0.

## Sources

- lectures__Week3_1.txt (pages 5-7): SJF definition, example, and late-arrival issue.
- zhang__quizzes__Attendance Quiz 2 S26 Key.txt: SJF trace with Quiz 2 process set.
- exams__exam_1_prep__midterm1A_S25_answers.txt: SJF average TAT = 12.5, response time = 7.
