# Lottery and Stride Scheduling

## Definition

**Lottery scheduling** uses a probabilistic approach to proportional-share scheduling. Each job receives a number of "tickets"; the scheduler randomly selects a ticket, and the job holding it runs. Over long periods, jobs receive CPU time proportional to their ticket count.

**Stride scheduling** is a deterministic version of lottery scheduling. Each job has a "stride" (a large constant divided by its ticket count). Jobs are run in order of their "pass value"; each job increments its pass by its stride after running.

## When to use

- Systems requiring fair resource allocation without absolute guarantees.
- **Lottery**: When probabilistic fairness is acceptable (lottery is simpler, more flexible with dynamic ticket transfers).
- **Stride**: When deterministic, repeatable fairness is required (stride guarantees near-perfect proportional sharing over short periods).

## Key ideas

Both lottery and stride are **proportional-share schedulers**: they guarantee a job receives (tickets / total_tickets) of CPU time, not based on job length but on allocatable resources (tickets).

### Lottery Scheduling

- **Fairness metric**: Over time, long-running workloads achieve the desired ratio. Short-running jobs may have unfairness (one may finish before the other gets its share).
- **Probabilistic**: Each scheduling decision is independent; no guaranteed order, but statistical fairness over many draws.
- **Ticket mechanics**:
  - **Ticket transfer**: A process can lend its tickets to another process (e.g., a client process temporarily gives its tickets to a server).
  - **Ticket inflation**: A job can temporarily increase its own ticket count (risky in shared systems; can be abused).
  - **Ticket currency**: Users manage a private "currency" of tickets that the OS converts to global tickets (e.g., User A has 500 tokens → 50 global tickets for job A1, 50 for job A2).

Example: 100 total tickets. A has 75 (holds tickets 0-74), B has 25 (holds tickets 75-99). The scheduler picks random tickets; over 100 scheduling decisions, A runs ~75 times.

### Stride Scheduling

- **Deterministic**: No randomness; the same workload always produces the same schedule.
- **Pass value**: Each job tracks a running pass value, starting at 0 (or the minimum of existing jobs if arriving late).
- **Stride formula**: stride = large_constant / tickets. Example: constant = 10,000. If A has 100 tickets, stride_A = 100. If B has 50 tickets, stride_B = 200.
- **Scheduling**: Always run the job with the lowest pass value. After running, increment its pass by its stride.
- **New jobs**: A new job entering mid-schedule should start with pass = minimum pass of all existing jobs to avoid monopolizing the CPU.

Example: A (stride=100), B (stride=200), C (stride=40).
- Initially: pass_A=0, pass_B=0, pass_C=0 → run A (lowest, tie-break favors first).
- After A runs: pass_A=100. Next lowest: pass_B=0 → run B.
- After B runs: pass_B=200. Next lowest: pass_C=0 → run C.
- Continues: C three times (passes 40, 80, 120), then A (pass 200), then B (200), etc.
- **Unfairness**: If a new job enters at the start with pass=0 when existing jobs have pass > 0, it monopolizes CPU until others catch up. Solution: new jobs start at pass = min(existing passes).

## Pseudocode

**Lottery:**
```
while (true):
    winner = random(0, total_tickets)
    counter = 0
    for job in ready_queue:
        counter += job.tickets
        if (counter > winner):
            run_job(job)
            break
```

**Stride:**
```
while (true):
    job = job_with_minimum_pass_value()
    run_job(job)
    job.pass += job.stride
```

## Hand-trace example

**Stride scheduling with A (100 tix, stride=100), B (50 tix, stride=200), C (250 tix, stride=40):**

| Run # | Job | Pass Value | Next Pass | Note              |
|-------|-----|-----------|-----------|-------------------|
| 1     | A   | 0         | 100       | Min pass = 0 (A)   |
| 2     | B   | 0         | 200       | Min pass = 0 (B)   |
| 3     | C   | 0         | 40        | Min pass = 0 (C)   |
| 4     | C   | 40        | 80        | Min pass = 40 (C)  |
| 5     | C   | 80        | 120       | Min pass = 80 (C)  |
| 6     | A   | 100       | 200       | Min pass = 100 (A) |
| 7     | C   | 120       | 160       | Min pass = 120 (C) |
| 8     | C   | 160       | 200       | Min pass = 160 (C) |
| 9     | B   | 200       | 400       | Min pass = 200 (B) |
| 10    | C   | 200       | 240       | Min pass = 200 (C) |

Over the first 10 runs: A runs 2 times, B runs 2 times, C runs 6 times. Ratio = 2:2:6 ≈ 1:1:3, which matches 100:50:250 (proportional-share goal).

**Comparison to Lottery:** Over 10 decisions, lottery would randomly pick tickets. Expected runs: A ≈ 4, B ≈ 2, C ≈ 4 (if evenly distributed), but actual variance would be higher. Stride guarantees the exact proportional sharing.

## Complexity

- **Lottery**: O(n) per scheduling decision (walk ticket list).
- **Stride**: O(log n) if using a balanced tree (e.g., red-black); O(n) with a simple list.

## Common exam questions

- How do lottery and stride scheduling differ from time-based schedulers like FIFO/SJF?
- Explain the fairness metric "unfairness U = t1_finish / t2_finish."
- Given ticket counts, compute the expected CPU time for each job under lottery scheduling.
- Trace stride scheduling over several scheduling decisions; verify proportional-share property.
- What is the purpose of ticket transfer and ticket inflation?
- Why should new jobs in stride scheduling start with pass = min(existing passes)?

## Gotchas

- **Lottery fairness is probabilistic**: Two equal-ticket jobs may finish at very different times (unfairness metric quantifies this).
- **Stride determinism is an advantage but also a limitation**: Repeatable schedules can be a debugging tool, but lack of randomness may make patterns predictable.
- **Stride "new job" problem**: If a new job enters with pass=0 when others have pass > 0, it will dominate until others catch up.
- **Tickets must be managed**: Inflation and transfer are powerful but can be abused in unsecure systems; currency prevents privilege-escalation attacks.

## Sources

- lectures__Week3_2.txt (pages 1-11): Lottery and stride scheduling definitions, ticket mechanisms, unfairness metric, examples.
- zhang__quizzes__Attendance Quiz 3 S26 Key.txt: Lottery is probabilistic; stride is deterministic; both are proportional-share.
