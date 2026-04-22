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

- Given a process set (arrival times, burst times) and a scheduling algorithm, compute average turnaround and response times.
- Explain why turnaround and response time are often at odds.
- Which metric would you prioritize for a time-sharing OS? Why?
- How do the convoy effect and response time constraints interact?

## Gotchas

- **Turnaround ≠ response time**: Turnaround includes all waiting and running time; response is just the delay until first run.
- **Wait time** does not include I/O blocking time (the process is not "waiting in the ready queue" during I/O).
- When computing metrics by hand, carefully track arrival times—a process arriving late has a later start time, affecting both response and turnaround.

## Sources

- lectures__Week3_1.txt (pages 2-3): Turnaround time definition and metrics overview.
