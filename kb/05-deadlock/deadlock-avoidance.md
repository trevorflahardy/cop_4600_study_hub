# Deadlock Avoidance via Scheduling

## Definition

Deadlock avoidance (not prevention) is a dynamic, scheduling-based approach: instead of eliminating a condition, the OS uses global knowledge of which locks threads might need and schedules threads such that no deadlock cycle can ever form, even though all four conditions may technically hold. This requires analyzing thread lock requirements in advance and computing a safe schedule.

## When to use

- In systems where you have global knowledge of all threads' lock requirements before execution.
- In resource-constrained systems (e.g., embedded systems) where you control all scheduling.
- When prevention is not feasible but you want guaranteed deadlock-free execution.

## Key ideas

Unlike prevention (making deadlock impossible by blocking one condition), avoidance allows all four conditions to exist but ensures the scheduler never reaches an unsafe state. This is the banker's algorithm concept applied to locks.

### How Avoidance Works

1. Analyze each thread's lock requirements: which locks it will request and in what order.
2. Before scheduling a thread, check if allowing it to run could lead to a deadlock.
3. If yes, keep the thread waiting or schedule another thread instead.
4. If no, schedule the thread and let it proceed.

### Example from Week 9_1

Two processors, four threads:

| Thread | Needs L1? | Needs L2? |
|--------|-----------|-----------|
| T1 | yes | yes |
| T2 | yes | yes |
| T3 | no | yes |
| T4 | no | no |

**Unsafe schedule:** Run T1 and T2 together on different CPUs.
- T1 acquires L1, waits for L2 (held by T2)
- T2 acquires L2, waits for L1 (held by T1)
- **Deadlock**

**Safe schedule:** Keep T1 and T2 from running simultaneously.
- CPU 1: T3 (needs only L2)
- CPU 2: T1, T2 (run serially, one after the other)
- Result: T1 or T2 can acquire both locks without T2 or T1 interfering.

### Conservative Approach: Static Scheduling

The safest approach is to compute a static schedule that guarantees no deadlock:

```
CPU 1: T3 T4         (threads that don't conflict on L1)
CPU 2: T1 T2         (threads that need the same locks, scheduled serially)
```

Since T1 and T2 never run together, one always finishes before the other tries to acquire locks, so no deadlock.

### Trade-off: Performance vs. Deadlock Freedom

Safe schedules often reduce parallelism:

| Scenario | Schedule | Concurrency | Deadlock Risk |
|----------|----------|-------------|---------------|
| T1, T2, T3, T4 all need L1 and L2 | T1 → T2 → T3 → T4 (serial) | Low | None |
| T1, T2 need L1 and L2; T3, T4 independent | (T1 or T2 on CPU2), (T3 and T4 on CPU1) | Medium | None |
| All threads independent | T1, T2, T3, T4 on separate CPUs | High | None |

More conservative schedules have less parallelism but greater safety.

## Pseudocode

Conceptual avoidance algorithm:

```c
bool is_safe_schedule(thread_t *t, cpu_assignment_t assignment) {
    // Check if assigning thread t to the given CPU would lead to deadlock
    // Requires global knowledge of all threads' lock sets
    
    // Build a hypothetical resource allocation graph with this assignment
    rag_t hypothetical_rag = build_rag_with_assignment(t, assignment);
    
    // Check if there's a cycle
    if (has_cycle(hypothetical_rag)) {
        return false;  // Unsafe
    }
    return true;  // Safe
}

void schedule_with_avoidance() {
    for (each ready thread t) {
        for (each available CPU) {
            if (is_safe_schedule(t, cpu)) {
                assign_thread_to_cpu(t, cpu);
                break;
            }
        }
        if (t is not assigned) {
            // No safe CPU for t right now; keep it waiting
            add_to_wait_queue(t);
        }
    }
}
```

## Hand-trace example

Two processors, threads with lock requirements:

| Thread | L1? | L2? | Duration |
|--------|-----|-----|----------|
| T1 | yes | yes | 5 units |
| T2 | yes | yes | 5 units |
| T3 | no | yes | 3 units |

**Safe schedule (no concurrent T1+T2 on L1 and L2):**

```
Time: 0-5   CPU1: T1 (locks L1, L2)    CPU2: T3 (locks L2, waits if needed)
Time: 5-10  CPU1: T2 (locks L1, L2)    CPU2: done
Time: 10-13 CPU1: done                 CPU2: -
```

T1 finishes before T2 starts. L1 and L2 are never simultaneously held by two threads. No deadlock.

**Unsafe schedule (attempting T1 and T2 concurrently on L1/L2 contention):**

If we tried to run T1 and T2 simultaneously without checking first, we'd get deadlock (as shown in the four conditions file).

## Common exam questions

- What is the difference between deadlock prevention and deadlock avoidance?
- Given a set of threads and their lock requirements, determine if a schedule is safe or unsafe.
- Construct a safe schedule for threads with conflicting lock requirements.
- Explain why avoidance often requires more conservative scheduling than necessary.
- Can avoidance reduce concurrency compared to prevention? Under what conditions?
- What information must you have to use avoidance scheduling?

## Gotchas

- **Requires global knowledge in advance**: You must know ahead of time which locks each thread will need. This is often not practical in large, modular systems.
- **Statically computed schedules are conservative**: The schedule may be more restrictive than necessary because you over-approximate which threads conflict.
- **Not applicable to dynamic thread creation**: If threads are created on-the-fly, you cannot compute a safe schedule ahead of time.
- **Scalability**: As the number of threads and locks grows, computing safe schedules becomes computationally expensive (banker's algorithm is O(n^3) or worse).
- **Performance overhead**: Conservative scheduling can serialize code that could otherwise run in parallel, negating the benefit of multi-core systems.

## Sources

- Operating Systems: Three Easy Pieces, Chapter 32 (Zhang), pages 25–27 (Deadlock avoidance via scheduling, two examples)
- COP 4600 Week 9_1 Lecture Slides, pages 24–26 (Example with T1-T4, CPU1-CPU2, safe vs. contention schedules)

