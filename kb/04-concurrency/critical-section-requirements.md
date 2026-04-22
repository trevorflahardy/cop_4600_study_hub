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

- Define mutual exclusion, progress, and bounded waiting. Why is each important?
- Can a solution achieve mutual exclusion without progress? Give an example.
- What is the difference between a deadlock and starvation?
- Explain how a lock enforces all three critical section requirements.
- Design a critical section for protecting a shared counter.

## Gotchas

- **Mutual exclusion alone is insufficient**: A solution that blocks all threads satisfies mutual exclusion but violates progress
- **Scope matters**: Only the minimal code accessing shared state should be in the critical section
- **Lock granularity**: Too coarse-grained locks reduce concurrency; too fine-grained increase complexity
- **Reentrant locks**: Some scenarios require locks that a thread can acquire multiple times (not covered in this unit but worth knowing)

## Sources

- lectures__Week6_1.txt
- zhang__Chapter+28+Locks+v6.txt
