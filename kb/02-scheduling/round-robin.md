# Round Robin (RR)

## Definition

Round Robin is a preemptive scheduler that allocates a fixed time slice (or quantum) to each job in turn. When a job's time slice expires, it is preempted and moved to the back of the ready queue, and the next job runs. If a job finishes before its time slice expires, the next job starts immediately.

## When to use

- Time-sharing systems where response time is critical.
- Interactive workloads where responsiveness is more important than throughput.
- Provides fairness in CPU allocation among processes of similar priority.

## Key ideas

RR balances between batch efficiency (FIFO/SJF) and interactivity. By ensuring every job gets a chance to run regularly, RR keeps response times low. However, the time slice is a critical tuning parameter:

- **Small time slice** (e.g., 1ms): Good response time, but frequent context switches hurt performance (5% of CPU time spent scheduling, per CFS notes).
- **Large time slice** (e.g., 100ms): Amortizes context-switch overhead, but response time suffers; approximates FIFO.

RR with very large slices is essentially FIFO; RR with very small slices gives interactive responsiveness at a cost.

Tiebreak rule (from Quiz 2): "At the end of a time slice, if a new job arrives, the new job is enqueued first, then the preempted job goes to the tail of the ready queue." This ensures arriving jobs get a chance to run before continuing jobs.

## Pseudocode

```
ready_queue = empty
while (true):
    if (job arrives):
        ready_queue.enqueue(job)
    if (CPU idle and ready_queue not empty):
        current_job = ready_queue.dequeue()
        run_job_for_time_slice(current_job, quantum)
        if (current_job not finished):
            ready_queue.enqueue(current_job)  // goes to tail
```

## Hand-trace example

**Process set (Quiz 2) with time slice = 2:**

| Process | Arrival Time | CPU Burst |
|---------|--------------|-----------|
| A       | 0            | 3         |
| B       | 1            | 6         |
| C       | 4            | 4         |
| D       | 6            | 2         |

**Scheduling trace:**
- t=0: A arrives → queue=[A], run A for 2 units.
- t=1: (A running) B arrives → queue=[A, B] (A inserted first at t=0, B enqueued).
- t=2: A's slice ends (ran 2/3), remains 1 → queue=[B, A]. Run B for 2 units.
- t=3: A finishes during B's run → queue=[B]. (A finishes at t=3.)
- t=4: C arrives → queue=[B, C]. Run B (still running, slice restarted at t=2, runs until t=4, so 2 units consumed, rem=4). Run B from t=4 for 2 units.
- t=6: D arrives (B slice ends at t=4+2=6) → queue=[C, D, B]. Run C for 2 units.
- t=8: C's slice ends, rem=2 → queue=[D, B, C]. Run D for 2 units.
- t=10: D finishes (burst=2). Run B for 2 units.
- t=12: B's slice ends, rem=2 → queue=[C, B]. Run C for 2 units.
- t=14: C's slice ends, rem=0 → C finishes. queue=[B]. Run B for 2 units.
- t=16: B finishes (rem=0).

**Gantt chart:**

```
A   B   C   D   B   C   B
|---|---|---|---|---|---|---|
0   2   4   6   8  10  12  14 16
```

**Metrics table:**

| Process | Response Time | Turnaround Time | Wait Time |
|---------|---------------|-----------------|-----------|
| A       | 0 (arrives at 0, runs at 0) | 3 (finishes at 3, arrived at 0) | 0 |
| B       | 1 (arrives at 1, runs at 2 → 2-1=1) | 15 (finishes at 16, arrived at 1 → 16-1=15) | 1+(4-2)+(10-8)+(12-10)=1+2+2+2=7 |
| C       | 2 (arrives at 4, runs at 6 → 6-4=2) | 10 (finishes at 14, arrived at 4 → 14-4=10) | 2+(10-8)=2+2=4 |
| D       | 2 (arrives at 6, runs at 8 → 8-6=2) | 4 (finishes at 10, arrived at 6 → 10-6=4) | 2 |
| **Average** | **(0+1+2+2)/4 = 1.25** | **(3+15+10+4)/4 = 8** | **(0+7+4+2)/4 = 3.25** |

## Complexity

O(1) per scheduling decision (dequeue and enqueue).

## Common exam questions

- How does time slice size affect response time and throughput?
- Given a process set and time slice, draw the RR Gantt chart and compute turnaround/response times.
- Explain the tiebreak rule: "at end of slice, new job enqueued first, preempted job to tail."
- When does RR behave like FIFO?

## Gotchas

- **Time slice must be tuned carefully**: Too small → overhead; too large → poor response.
- **Tiebreak rule matters**: On arrival during slice expiration, the arriving job gets priority in the queue, improving its response time.
- **Turnaround time is typically worse than SJF**: RR treats all jobs equally, so long jobs don't get run to completion quickly.
- **Context switch overhead is high**: Every slice expiration incurs a context switch; large workloads with small slices can bottleneck on scheduling.

## Sources

- lectures__Week3_1.txt (pages 11-16): Round Robin definition, example, time slice trade-off analysis, and context switching overhead.
- zhang__quizzes__Attendance Quiz 2 S26 Key.txt: Round Robin trace with Quiz 2 process set and tiebreak rule "new job enqueued first, preempted job goes to tail."
