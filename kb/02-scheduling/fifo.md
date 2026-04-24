# FIFO / First-Come-First-Served

## Definition

FIFO (First In, First Out), also called FCFS, is a non-preemptive scheduling algorithm that runs jobs in the order they arrive. Once a job starts, it runs to completion without interruption.

## When to use

- Simple systems where fairness means "serve in order."
- Batch systems where job arrivals are roughly uniform.
- Not recommended for interactive systems; suffers from poor response time.

## Key ideas

FIFO is the simplest scheduler to implement: maintain a queue, run the job at the head, move the next job in when it completes. It is non-preemptive—no timer interrupts or context switching based on fairness.

**Convoy effect**: When a short job arrives after a very long job, the short job must wait for the long job to complete. This can make average turnaround time much worse than with Shortest Job First. For example:
- A=100 seconds (arrives first), B=10 seconds, C=10 seconds
- FIFO: A runs 0-100, B runs 100-110, C runs 110-120 → avg TAT = (100 + 110 + 120) / 3 = 110 seconds
- But if B and C were prioritized: avg TAT drops to (10 + 20 + 120) / 3 = 50 seconds

This is the key limitation of FIFO.

## Pseudocode

```
queue = empty
while (true):
    if (job arrives):
        queue.enqueue(job)
    if (queue not empty and CPU idle):
        job = queue.dequeue()
        run_job(job)  // runs to completion
        job completes
```

## Hand-trace example

**Process set (Quiz 2):**

| Process | Arrival Time | CPU Burst |
|---------|--------------|-----------|
| A       | 0            | 3         |
| B       | 1            | 6         |
| C       | 4            | 4         |
| D       | 6            | 2         |

**Gantt chart:**

```
A             B                 C           D
|------|------|------|------|------|------|---------|
0      3      9      13     17     21     23        25
```

**Metrics table:**

| Process | Response Time | Turnaround Time | Wait Time |
|---------|---------------|-----------------|-----------|
| A       | 0             | 3               | 0         |
| B       | 8 (arrives at 1, first runs at 3-1=2... runs at 3, so response=3-1=2) | 12 (completes at 9, arrived at 1 → 9-1=8) | 2 |
| C       | 9 (arrives at 4, runs at 9 → 9-4=5) | 13 (completes at 13, arrived at 4 → 13-4=9) | 5 |
| D       | 15 (arrives at 6, runs at 13 → 13-6=7) | 17 (completes at 15, arrived at 6 → 15-6=9) | 7 |
| **Average** | **(0+2+5+7)/4 = 3.5** | **(3+8+9+9)/4 = 7.25** | **(0+2+5+7)/4 = 3.5** |

**Correctness notes:** A arrives first at t=0 and runs to t=3. B arrives at t=1 and waits until A finishes; FIFO runs B from t=3 to t=9. C arrives at t=4 and waits; it starts at t=9. D arrives at t=6 and waits; it starts at t=13.

## Complexity

O(1) for scheduling decision (dequeue front of queue).

## Common exam questions

- **MCQ:** Which property best characterizes FIFO (FCFS) scheduling?
  - [ ] Preemptive, shortest-job-first
  - [x] Non-preemptive, arrival-order
  - [ ] Preemptive, round-robin
  - [ ] Non-preemptive, priority-based
  - why: FCFS dispatches whichever job arrived first and runs it to completion without preemption.

- **MCQ:** Processes A, B, C arrive at time 0 in that order with CPU bursts 10, 1, 1. What is the average turnaround time under FIFO?
  - [ ] 4
  - [ ] 7
  - [x] 11
  - [ ] 12
  - why: A completes at 10, B at 11, C at 12. Average = (10 + 11 + 12) / 3 = 11. The short jobs wait behind the long one — the convoy effect.

- **MCQ:** Which scheduling problem is FIFO most vulnerable to?
  - [ ] Starvation of CPU-bound jobs
  - [x] Convoy effect: short jobs queued behind long ones
  - [ ] Excessive context-switch overhead
  - [ ] Priority inversion
  - why: Convoy effect is the signature failure mode of FIFO; starvation and context-switch overhead are not FIFO issues.

- **MCQ:** Why is FIFO poorly suited to interactive systems?
  - [ ] It uses too many system calls per tick.
  - [ ] It requires accurate burst-length estimation.
  - [x] Response time for short interactive jobs can be arbitrarily high when long jobs run first.
  - [ ] It cannot handle I/O-bound processes.
  - why: Interactive workloads need low response time; FIFO lets any long-running job block every later arrival until it finishes.

- Explain the convoy effect with a concrete example.
- Given a process set, draw the Gantt chart for FIFO and compute average turnaround time.

## Gotchas

- **Non-preemptive**: A running job cannot be interrupted. Even if a very short job arrives, it must wait.
- **Order dependency**: FIFO only guarantees fairness in the sense of "first come, first served"—not fairness in completion time.
- **Convoy effect occurs whenever job lengths are variable**, not just in the classic long-short-short example.

## Sources

- lectures__Week3_1.txt (pages 2-7): FIFO definition, example, and convoy effect.
- zhang__quizzes__Attendance Quiz 2 S26 Key.txt: FCFS trace problem with process set A=0/3, B=1/6, C=4/4, D=6/2.
