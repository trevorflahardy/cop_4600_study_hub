# Critical Section Requirements

## Definition

A **critical section** is a piece of code that accesses a shared resource (variable, data structure) and must not be concurrently executed by more than one thread. A critical section must satisfy three requirements: mutual exclusion, progress, and bounded waiting.

## When to use

Identify critical sections whenever threads access or modify shared data. Wrap these sections with locks (or other synchronization primitives) to ensure safety.

## Key ideas

- **Mutual Exclusion**: Only one thread executes the critical section at a time
- **Progress (Deadlock-free)**: If no thread is in the critical section and some threads want to enter, one must eventually enter (no indefinite waiting for external events)
- **Bounded Waiting (Starvation-free)**: After a thread requests entry, there is a bound on how many times other threads can enter before it enters
- **Atomicity**: The entire critical section appears to execute as a single indivisible operation

## Pseudocode

Safe critical section pattern:
```
lock_t mutex;

void enter_critical_section() {
    lock(&mutex);           // acquire lock
    // critical section here
    // modify shared variables
    unlock(&mutex);         // release lock
}
```

Incorrect pattern (violates mutual exclusion):
```
// No synchronization
counter = counter + 1;  // RACE CONDITION
```

## Hand-trace example

Correct synchronization with a lock:

| Step | Thread 1 | Thread 2 | Lock | Notes |
|------|----------|----------|------|-------|
| 1 | lock() call | - | acquired by T1 | T1 acquires lock |
| 2 | counter++ (load) | lock() call | acquired by T1 | T2 waits for lock |
| 3 | counter++ (add) | (blocked) | acquired by T1 | T2 still waiting |
| 4 | counter++ (store) | (blocked) | acquired by T1 | T2 still waiting |
| 5 | unlock() | (blocked) | released | T1 releases; T2 can proceed |
| 6 | - | lock() returns | acquired by T2 | T2 acquires lock |
| 7 | - | counter++ | acquired by T2 | T2 executes in critical section |
| 8 | - | unlock() | released | Done |

Result: counter incremented twice, correctly.

## Common exam questions

- **MCQ:** Which three properties must a correct critical-section solution satisfy?
  - [x] Mutual exclusion, progress, and bounded waiting
  - [ ] Atomicity, fairness, and priority inversion avoidance
  - [ ] Liveness, safety, and determinism
  - [ ] Mutual exclusion, determinism, and constant-time entry
  - why: The classical trio is mutual exclusion (safety), progress (no indefinite stall when no one is in CS), and bounded waiting (no starvation).

- **MCQ:** A solution blocks every thread whenever any thread wants to enter, so no thread ever enters. Which property fails?
  - [x] Progress
  - [ ] Mutual exclusion
  - [ ] Bounded waiting
  - [ ] Atomicity
  - why: Mutual exclusion is trivially preserved when nobody enters; progress is violated because a waiter cannot make forward progress even when the section is free.

- **MCQ:** What distinguishes starvation from deadlock?
  - [x] Deadlock: no one progresses; starvation: some threads progress indefinitely while another waits forever
  - [ ] Starvation only happens with spinlocks; deadlock only with semaphores
  - [ ] Deadlock requires exactly two threads; starvation requires three or more
  - [ ] Deadlock is always recoverable; starvation is not
  - why: In deadlock, a cycle of threads each wait for a resource the others hold. In starvation, the system keeps making progress but a specific thread is perpetually passed over.

- **MCQ:** Which of the following is a race condition rather than a correct critical section?
  - [x] `counter = counter + 1` with no locking across threads
  - [ ] `lock(m); counter++; unlock(m);`
  - [ ] `sem_wait(&s); counter++; sem_post(&s);`
  - [ ] Using a CAS loop to atomically increment counter
  - why: The unprotected `counter = counter + 1` is a load-modify-store sequence that can interleave, losing updates.

- **MCQ:** What is the "bounded waiting" requirement?
  - [x] Once a thread requests entry, the number of times others can enter first is bounded
  - [ ] A thread's critical section must complete in a bounded number of instructions
  - [ ] The lock must be released within a bounded amount of wall-clock time
  - [ ] The number of threads contending must be bounded
  - why: Bounded waiting prevents starvation: waiters are guaranteed eventual entry because only finitely many overtakes are permitted.

- **MCQ:** Which statement about critical-section scope is most accurate?
  - [x] Only the minimal code touching shared state should be inside the critical section
  - [ ] Longer critical sections are safer because they enforce serialization more strictly
  - [ ] Entering the critical section must disable interrupts for correctness
  - [ ] Critical sections must always hold the lock for the entire thread lifetime
  - why: Shrinking the critical section to the shared-state accesses reduces contention and preserves concurrency while still providing mutual exclusion.

## Gotchas

- **Mutual exclusion alone is insufficient**: A solution that blocks all threads satisfies mutual exclusion but violates progress
- **Scope matters**: Only the minimal code accessing shared state should be in the critical section
- **Lock granularity**: Too coarse-grained locks reduce concurrency; too fine-grained increase complexity
- **Reentrant locks**: Some scenarios require locks that a thread can acquire multiple times (not covered in this unit but worth knowing)

## Sources

- lectures__Week6_1.txt
- zhang__Chapter+28+Locks+v6.txt
