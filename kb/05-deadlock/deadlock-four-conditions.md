# Deadlock: Four Conditions

## Definition

Deadlock occurs when two or more threads are blocked indefinitely, each waiting for a resource held by another thread, creating a circular wait. Four conditions must all hold simultaneously for deadlock to occur: mutual exclusion, hold-and-wait, no preemption, and circular wait. If any one condition is absent, deadlock cannot happen.

## When to use

- Analyzing whether a deadlock is possible in concurrent code with multiple locks.
- Identifying which condition to break to prevent deadlock in a given scenario.
- Understanding resource-allocation graphs and cycle detection.

## Key ideas

All four conditions must be true for deadlock to occur:

1. **Mutual Exclusion**: Threads claim exclusive control of resources (locks) that they require. A resource cannot be shared by multiple threads simultaneously.

2. **Hold-and-Wait**: A thread holds at least one resource while waiting for additional resources held by another thread. Threads do not release resources they currently hold while acquiring new ones.

3. **No Preemption**: Resources cannot be forcibly removed from threads holding them. Critical sections cannot be aborted externally; a thread must voluntarily release locks.

4. **Circular Wait**: There exists a circular chain of threads such that each thread holds one or more resources that are being requested by the next thread in the chain. Example: Thread T1 holds L1 and waits for L2; Thread T2 holds L2 and waits for L1.

### Resource Allocation Graph (RAG)

A resource-allocation graph visualizes the relationship between threads and locks. Each node represents either a thread or a lock. An edge from a thread to a lock (request edge) indicates the thread is waiting for the lock. An edge from a lock to a thread (assignment edge) indicates the lock is held by the thread. A cycle in the RAG indicates deadlock.

Example with a cycle:
- Thread T1 holds Lock L1 and waits for Lock L2
- Thread T2 holds Lock L2 and waits for Lock L1

This forms a cycle: T1 → L2 → T2 → L1 → T1

### Breaking any one condition prevents deadlock

To prevent deadlock, eliminate at least one condition. For instance:
- Break mutual exclusion: use lock-free atomics instead of locks
- Break hold-and-wait: acquire all locks atomically at once
- Break no preemption: use `pthread_mutex_trylock()` to release and retry
- Break circular wait: enforce a global lock ordering (acquire L1 before L2, always)

## Pseudocode

A simple case showing mutual exclusion and hold-and-wait:

```c
// Thread 1
pthread_mutex_lock(&L1);     // Acquire L1
pthread_mutex_lock(&L2);     // Wait for L2 (L2 held by T2)
// critical section
pthread_mutex_unlock(&L2);
pthread_mutex_unlock(&L1);

// Thread 2
pthread_mutex_lock(&L2);     // Acquire L2
pthread_mutex_lock(&L1);     // Wait for L1 (L1 held by T1)
// critical section
pthread_mutex_unlock(&L1);
pthread_mutex_unlock(&L2);
```

If Thread 1 locks L1, then Thread 2 locks L2, both threads are now waiting for each other's locks → deadlock.

## Hand-trace example

| Step | Thread T1 | Thread T2 | L1 | L2 | Outcome |
|------|-----------|-----------|----|----|---------|
| 1 | lock(L1) | - | T1 | Free | T1 holds L1 |
| 2 | - | lock(L2) | T1 | T2 | T2 holds L2 |
| 3 | lock(L2) [WAIT] | - | T1 | T2 | T1 waits for L2 |
| 4 | - | lock(L1) [WAIT] | T1 | T2 | T2 waits for L1 **→ DEADLOCK** |

Both threads are blocked: T1 waits for L2 (held by T2), and T2 waits for L1 (held by T1). Neither can proceed.

## Common exam questions

- **MCQ:** Which of the four Coffman conditions is specifically the one broken by enforcing a global lock ordering?
  - [x] Circular wait.
  - [ ] Mutual exclusion.
  - [ ] Hold-and-wait.
  - [ ] No preemption.
  - why: Global lock ordering means no thread ever holds a higher-address lock while waiting for a lower-address lock. That makes a cycle in the wait-for graph impossible. Mutual exclusion, hold-and-wait, and no preemption still hold.
- **MCQ:** Which Coffman condition is broken by using CAS-based lock-free data structures?
  - [x] Mutual exclusion.
  - [ ] Hold-and-wait.
  - [ ] No preemption.
  - [ ] Circular wait.
  - why: CAS updates a single memory location atomically without any thread claiming exclusive control of a region. No lock is held, so mutual exclusion (the requirement for exclusive access to resources) is absent.
- **MCQ:** Which Coffman condition is broken by acquiring all required locks atomically via a prevention lock?
  - [x] Hold-and-wait.
  - [ ] Mutual exclusion.
  - [ ] No preemption.
  - [ ] Circular wait.
  - why: After the atomic acquisition, a thread either holds every lock it needs or holds none. It never holds one lock while waiting for another, which is the hold-and-wait condition.
- **MCQ:** Which Coffman condition is broken by using `pthread_mutex_trylock` with release-and-retry?
  - [x] No preemption.
  - [ ] Mutual exclusion.
  - [ ] Hold-and-wait.
  - [ ] Circular wait.
  - why: With trylock, a thread voluntarily releases locks it already holds when it fails to acquire another one. This is self-preemption of its lock holdings, removing the no-preemption condition (though it can introduce livelock).
- **MCQ:** Two threads: T1 holds L1 and waits for L2; T2 holds L2 and waits for L1. Which of the four conditions are present?
  - [x] All four: mutual exclusion, hold-and-wait, no preemption, and circular wait.
  - [ ] Only mutual exclusion and circular wait.
  - [ ] Only hold-and-wait and no preemption.
  - [ ] Only circular wait.
  - why: Mutual exclusion (each lock is exclusive), hold-and-wait (each thread holds one and waits for another), no preemption (pthread mutexes cannot be stolen), and circular wait (T1 → L2 → T2 → L1 → T1) all hold. When all four are true and the interleaving occurs, deadlock happens.
- **MCQ:** If every thread in the system acquires locks in the same global order (e.g., always L1 before L2 before L3), can deadlock occur?
  - [x] No — a cycle in the wait-for graph is impossible under a consistent total order.
  - [ ] Yes — ordering does not help if threads use trylock.
  - [ ] Yes — mutual exclusion still causes deadlock on its own.
  - [ ] Yes — no preemption always guarantees deadlock eventually.
  - why: A cycle would require some thread to hold a lower-numbered lock while waiting for a higher-numbered lock AND another thread to do the reverse — a contradiction under a total order. So circular wait cannot arise.

## Gotchas

- **Not all cycles guarantee deadlock in practice**: A cycle in the RAG is a necessary and sufficient condition for deadlock in a single-instance resource system. But the system may not schedule threads in a way that actually reaches the deadlock state.
- **Circular wait is the only condition specific to deadlock**: The other three (mutual exclusion, hold-and-wait, no preemption) are common properties of lock-based systems. Circular wait is the differentiator.
- **Starvation vs. deadlock**: In deadlock, no thread makes progress. In starvation, some threads never get a chance to run (but other threads do make progress). Deadlock is stricter.
- **Breaking hold-and-wait naively can reduce concurrency**: Acquiring all locks upfront prevents overlapping access and can serialize the code.

## Sources

- Operating Systems: Three Easy Pieces, Chapter 32 (Zhang), pages 10–18
- COP 4600 Week 9_1 Lecture Slides, pages 12–22
- Midterm 2 Practice / Solution, Question 6

