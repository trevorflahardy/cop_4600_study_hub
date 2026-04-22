# Multi-Level Feedback Queue (MLFQ)

## Definition

MLFQ is a preemptive scheduler with multiple queues, each assigned a different priority level. Jobs are assigned to queues dynamically based on observed behavior (CPU vs. I/O usage), allowing the scheduler to approximate SJF without prior knowledge of job lengths.

## When to use

- Time-sharing systems with mixed workloads (interactive and batch processes).
- Systems where job lengths are unknown in advance.
- When both turnaround time and response time are important goals.

## Key ideas

MLFQ solves the "no oracle" problem: we cannot know a job's length in advance, so we learn from its behavior. Jobs that frequently yield the CPU (interactive, I/O-bound) stay at high priority; jobs that use full time slices (CPU-bound) are demoted to lower priorities, where they eventually run to completion.

The five MLFQ rules (verbatim from lecture):
1. **Rule 1**: If Priority(A) > Priority(B), A runs (B doesn't).
2. **Rule 2**: If Priority(A) = Priority(B), A and B run in round-robin with the time quantum of that queue.
3. **Rule 3**: When a job enters the system, it is placed at the highest priority queue.
4. **Rule 4**: Once a job uses up its allotment (total time allowed at that level, regardless of how many times it yields), its priority is reduced (it moves down one queue).
5. **Rule 5**: After some time period S, move all jobs in the system to the topmost queue.

**Gaming and fixes:**
- **Gaming**: A job can yield the CPU just before its time slice expires to stay at high priority.
- **Rule 4 fix** (revised): Count total CPU time used at a level, not just consecutive slices. This prevents a job from yielding just before slice expiration and staying high-priority.

**Priority boost (Rule 5):**
- Prevents starvation of lower-priority jobs.
- Allows jobs to change behavior (I/O-bound → CPU-bound) and get re-evaluated.
- Resets the system periodically, typically every 1 second (Solaris uses ~1 second).

Higher-priority queues typically use smaller time slices (e.g., 10ms); lower-priority queues use longer slices (e.g., 100ms) to amortize context-switch overhead.

## Pseudocode

```
queue_0 = (highest priority, round-robin with quantum q0)
queue_1 = (medium priority, round-robin with quantum q1)
queue_2 = (lowest priority, FCFS)
allotment_used = [0, 0, 0]  // per process, per queue

while (true):
    if (job arrives):
        place job at queue_0
        allotment_used[job] = 0
    
    // Rule 5: periodic priority boost
    if (time_since_last_boost > S):
        move all jobs to queue_0
        reset allotments
        last_boost = current_time
    
    // Rules 1, 2: pick highest priority job
    for i in 0..2:
        if (queue_i not empty):
            current_job = queue_i.dequeue()  // or next in RR
            run_current_job_for_quantum(queue_level=i)
            
            if (current_job finished):
                continue
            
            // Rule 4: check allotment
            allotment_used[current_job] += time_slice_used
            if (allotment_used[current_job] >= allotment[i]):
                // demote job
                queue_{i+1}.enqueue(current_job)
                allotment_used[current_job] = 0
            else:
                // job yielded early; stays at same priority
                queue_i.enqueue(current_job)
```

## Hand-trace example

**MLFQ with 3 queues (Quiz 2-style setup):**

| Queue | Scheduling | Time Slice | Allotment |
|-------|------------|-----------|-----------|
| Q1    | RR         | 8         | 8         |
| Q2    | RR         | 12        | 12        |
| Q3    | FCFS       | -         | -         |

**Process set (simplified exam example):**

| Process | Arrival | Burst |
|---------|---------|-------|
| A       | 0       | 12    |
| B       | 5       | 45    |
| C       | 24      | 3     |
| D       | 30      | 22    |

**Scheduling trace:**

| Time | Event                      | Queue Status (Q1 / Q2 / Q3) | Scheduled? |
|------|------|------|------|
| 0    | A arrives (12ms burst)     | Q1: A(12) / Q2: / Q3:       | A runs     |
| 8    | A yields after 8ms (allotment exhausted) | Q1: / Q2: A(4) / Q3: | A demoted to Q2 |
| 5    | B arrives (45ms burst)     | Q1: B(45) / Q2: A(4) / Q3:  | B runs (higher priority than A in Q2) |
| 13   | B yields after 8ms (allotment exhausted) | Q1: / Q2: A(4), B(37) / Q3: | B demoted to Q2 |
| 20   | A (from Q2) continues      | Q1: / Q2: A(4), B(37) / Q3: | A runs from Q2 |
| 24   | A finishes, C arrives (3ms) | Q1: C(3) / Q2: B(37) / Q3:  | C runs (higher priority) |
| 27   | C finishes, B continues (from Q2) | Q1: / Q2: B(37) / Q3: | B runs from Q2 |
| 32   | B yields (allotment exhausted) | Q1: / Q2: / Q3: B(21) | B demoted to Q3 |
| 30   | D arrives (22ms) during B's run | (insert before demotion) | ... |

(This trace is simplified; the exact timeline depends on demotion timing and the order of enqueues.)

**Key observations:**
- A (long job) stays at Q1 briefly, then demotes to Q2, then Q3, giving interactive jobs (C) high priority when they arrive.
- B (long job) similarly demotes.
- C (short, interactive) gets Q1 priority and runs quickly.
- D runs at lower priority but eventually finishes.

## Complexity

O(n) per scheduling decision in the worst case (depends on queue implementation).

## Common exam questions

- Explain Rules 1-5 in MLFQ and their purposes.
- What problem does Rule 4 fix (gaming prevention)?
- Why is Rule 5 (priority boost) necessary?
- Given a process set, trace MLFQ execution and show queue transitions.
- How does MLFQ approximate SJF without prior knowledge of job lengths?

## Gotchas

- **Allotment ≠ time slice**: A job demotes after using its total allotment at a level, which may span multiple time slices and yields.
- **Gaming**: A job can yield just before its time slice expires (e.g., on I/O) to reset its allotment and stay high-priority; Rule 4 (revised) prevents this by counting total CPU time, not consecutive slices.
- **Starvation without Rule 5**: Many interactive jobs can starve batch jobs indefinitely; Rule 5 boosts all jobs periodically.
- **Tuning is complex**: Queue count, time slices per queue, allotments, and boost period all need tuning. Solaris uses 60 queues with boosting every ~1 second.

## Sources

- lectures__Week3_1.txt (pages 18-31): MLFQ rules 1-5, gaming prevention, priority boost, Solaris implementation (60 queues).
- zhang__quizzes__Attendance Quiz 3 S26 Key.txt: MLFQ T/F questions and rule clarifications (Rule 4 tracks allotment, Rule 5 prevents starvation).
- exams__exam_1.txt: MLFQ trace problem with 3 queues (Q1: RR=8, Q2: RR=12, Q3: FCFS).
