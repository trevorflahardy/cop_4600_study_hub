# Scheduling Metrics: Turnaround, Response, Wait

## Definition

Scheduling metrics measure the quality of a scheduler's decisions. **Turnaround time** (T_turnaround) is the time from when a job arrives until it completes (completion time - arrival time). **Response time** (T_response) is the time from arrival until the job first runs (first-run time - arrival time). **Wait time** is the total time a process spends in the ready queue, not running.

## When to use

- Turnaround time measures **batch system efficiency**—optimized when prioritizing throughput and job completion latency.
- Response time measures **interactive system responsiveness**—prioritized in systems where users perceive delays.
- Wait time measures **fairness and queue contention**—useful for analyzing CPU availability.

## Key ideas

Performance and fairness often conflict in scheduling. A scheduler optimized for turnaround time (running longest jobs first, or SJF) may have terrible response times for short jobs. Conversely, a scheduler optimized for response time (Round Robin with tiny slices) may achieve poor turnaround time due to context-switch overhead.

- **Turnaround time** rewards batch throughput; penalizes short jobs arriving after long ones (convoy effect).
- **Response time** rewards interactivity; short time slices improve it but increase context-switch overhead.
- **Wait time** is the cumulative time a process is ready but not running. It includes both before and between time slices.

Trade-off example: With FIFO, if a 100-second job arrives before two 10-second jobs, the average turnaround is 110 seconds. With SJF on the same arrival order, it drops to 50 seconds. But RR with very small slices may have even better response times for the 10-second jobs at the cost of turnaround.

## Formulas

- T_turnaround = T_completion - T_arrival
- T_response = T_firstrun - T_arrival
- Total wait time = time waiting in ready queue (does not include I/O wait)
- Average metrics = (sum of individual metrics) / (number of jobs)

## Common exam questions

- **MCQ:** How is turnaround time defined?
  - [x] T_completion - T_arrival
  - [ ] T_firstrun - T_arrival
  - [ ] T_completion - T_firstrun
  - [ ] Total time spent in the ready queue
  - why: Turnaround measures end-to-end latency from arrival to completion; first-run-based formulas describe response time instead.

- **MCQ:** How is response time defined?
  - [x] T_firstrun - T_arrival
  - [ ] T_completion - T_arrival
  - [ ] T_completion - T_firstrun
  - [ ] Time spent executing on the CPU
  - why: Response time captures only the delay until a job first gets the CPU, which is what interactive users perceive.

- **MCQ:** A 100-second job arrives before two 10-second jobs, all at t=0 in FIFO order. What is the average turnaround time under FIFO?
  - [x] 110 seconds
  - [ ] 50 seconds
  - [ ] 100 seconds
  - [ ] 40 seconds
  - why: Completion times are 100, 110, 120; average = (100+110+120)/3 = 110. Running shortest first instead would cut this to 50.

- **MCQ:** Which scheduler goal typically favors minimizing turnaround time?
  - [x] Batch throughput
  - [ ] Interactive responsiveness
  - [ ] Fairness among equal-priority jobs
  - [ ] Low context-switch overhead
  - why: Batch systems care about finishing jobs quickly end-to-end, not how soon each one begins running.

- **MCQ:** Which component is excluded from wait time?
  - [x] Time the process is blocked on I/O
  - [ ] Time waiting in the ready queue before first run
  - [ ] Time waiting in the ready queue between time slices
  - [ ] Time queued after a preemption
  - why: Wait time counts only ready-queue time; blocked-on-I/O intervals are not "waiting for the CPU."

- **MCQ:** Why are turnaround time and response time often in tension?
  - [x] Running shortest job to completion helps turnaround but delays later arrivals' first run
  - [ ] They measure the same quantity in different units
  - [ ] Response time always equals twice turnaround time
  - [ ] Both improve monotonically with a smaller quantum
  - why: Policies that minimize turnaround (SJF/STCF) can leave newly arrived jobs waiting, whereas RR with small quanta cuts response time but lengthens turnaround due to switching.

## Gotchas

- **Turnaround ≠ response time**: Turnaround includes all waiting and running time; response is just the delay until first run.
- **Wait time** does not include I/O blocking time (the process is not "waiting in the ready queue" during I/O).
- When computing metrics by hand, carefully track arrival times—a process arriving late has a later start time, affecting both response and turnaround.

## Sources

- lectures__Week3_1.txt (pages 2-3): Turnaround time definition and metrics overview.
