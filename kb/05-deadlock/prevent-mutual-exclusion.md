# Prevent Deadlock: Eliminate Mutual Exclusion

## Definition

Eliminating the mutual exclusion condition means replacing explicit locks with lock-free atomic primitives, allowing multiple threads to safely update shared data without blocking. Instead of using `pthread_mutex_lock()`, you use hardware-supported atomic operations like Compare-And-Swap (CAS) that ensure atomicity without mutual exclusion over a critical section.

## When to use

- When you need to avoid locks entirely (wait-free or lock-free data structures).
- For high-contention scenarios where lock-free atomics are faster than locks.
- When you cannot tolerate the latency of lock acquisition and release.

## Key ideas

The key insight is that not all shared-data access requires mutual exclusion in the traditional sense. Some operations can be made atomic using hardware instructions that operate on single memory locations.

### Compare-And-Swap (CAS)

The `__sync_bool_compare_and_swap(&address, expected, new)` atomic instruction atomically:
1. Compares the value at `address` with `expected`
2. If they match, writes `new` to `address` and returns true
3. If they don't match, does nothing and returns false

This is a single atomic operation with no possibility of context switching in the middle, so no deadlock can arise from CAS.

### Lock-Free List Insertion Example

Traditional lock-based insertion:

```c
void insert(int value) {
    node_t *n = malloc(sizeof(node_t));
    n->value = value;
    lock(listlock);           // Acquire lock
    n->next = head;
    head = n;
    unlock(listlock);         // Release lock
}
```

Lock-free insertion using CAS:

```c
void insert(int value) {
    node_t *n = malloc(sizeof(node_t));
    n->value = value;
    do {
        n->next = head;
    } while (!__sync_bool_compare_and_swap(&head, n->next, n));
}
```

The loop retries until CAS succeeds. At the moment CAS executes, it atomically checks if `head` still equals `n->next` (meaning no other thread changed it) and updates `head` to `n` if true.

### Atomic Increment Example

```c
int CompareAndSwap(int *address, int expected, int new) {
    if (*address == expected) {
        *address = new;
        return 1;   // success
    }
    return 0;       // failure
}

void AtomicIncrement(int *value, int amount) {
    do {
        int old = *value;
    } while (!CompareAndSwap(value, old, old + amount));
}
```

This repeatedly tries to increment the value atomically without any explicit lock.

## Pseudocode

```c
// Lock-based: mutual exclusion required
void increment_mutex(int *counter) {
    pthread_mutex_lock(&lock);
    *counter = *counter + 1;
    pthread_mutex_unlock(&lock);
}

// Lock-free: using CAS, no mutual exclusion condition
void increment_cas(int *counter) {
    int old, new;
    do {
        old = *counter;
        new = old + 1;
    } while (!__sync_bool_compare_and_swap(counter, old, new));
}
```

## Hand-trace example

Lock-free increment with two threads competing on `counter = 0`:

| Step | Thread T1 | Thread T2 | counter | Outcome |
|------|-----------|-----------|---------|---------|
| 1 | old = 0 | - | 0 | T1 reads counter |
| 2 | - | old = 0 | 0 | T2 reads counter |
| 3 | CAS(0, 1)? YES | - | 1 | T1 updates; CAS succeeds |
| 4 | - | CAS(0, 1)? NO | 1 | T2 tries CAS; fails (counter != 0) |
| 5 | - | old = 1 | 1 | T2 re-reads counter |
| 6 | - | CAS(1, 2)? YES | 2 | T2 updates; CAS succeeds |

No locks are acquired. Both threads eventually succeed, and counter = 2 (correct).

## Common exam questions

- **MCQ:** Which Coffman condition does CAS-based lock-free synchronization eliminate?
  - [x] Mutual exclusion — no thread ever holds exclusive control of a critical section; updates are single atomic instructions.
  - [ ] Hold-and-wait.
  - [ ] No preemption.
  - [ ] Circular wait.
  - why: CAS atomically compares and swaps a single memory word. There is no locked region a thread "holds." Without mutual exclusion over a region, deadlock (which requires exclusive holding) cannot occur.
- **MCQ:** Can classical deadlock occur with purely CAS-based code?
  - [x] No — without locks there is nothing to hold, so the deadlock conditions cannot all hold.
  - [ ] Yes — CAS deadlocks on contention.
  - [ ] Yes — CAS introduces a new hold-and-wait pattern.
  - [ ] Yes — CAS always requires a lock internally.
  - why: Deadlock requires a thread to hold one resource while waiting for another. CAS neither holds anything between instructions nor waits — it either succeeds or fails and retries. However, livelock (symmetric retries) is still possible.
- **MCQ:** A CAS-based insert does `do { n->next = head; } while (!CAS(&head, n->next, n));`. When does the loop retry?
  - [x] When another thread changed `head` between the load and the CAS, so the expected value no longer matches.
  - [ ] Every iteration, regardless of state.
  - [ ] Only when the thread is preempted.
  - [ ] Only when the list is empty.
  - why: CAS succeeds only if the current value of `head` still equals the previously loaded `n->next`. If another thread inserted in between, head changed and CAS returns false, so the loop retries with the new head.
- **MCQ:** What is the ABA problem in lock-free code?
  - [x] A value changes from A to B and back to A, so CAS sees A and succeeds, even though the structure was modified in between.
  - [ ] Two threads are stuck spinning on each other forever.
  - [ ] A thread acquires lock A, then lock B, then lock A again.
  - [ ] Two threads acquire locks in opposite orders.
  - why: CAS only checks the value, not the history. If the value is restored to its original, CAS cannot detect that intermediate modifications occurred, which can corrupt linked data structures. Fix: versioned pointers or double-word CAS.
- **MCQ:** When is lock-free CAS likely to outperform mutexes?
  - [x] Under high contention on short critical sections, where mutex overhead and blocking dominate.
  - [ ] Under very low contention on long critical sections.
  - [ ] Only on single-core systems.
  - [ ] Only when using recursive mutexes.
  - why: Mutex lock/unlock has a fixed overhead and can park threads. For brief updates under heavy contention, CAS retries are cheaper than repeated blocking. For long or rarely contended sections, mutexes are simpler and often faster.
- **MCQ:** Is livelock possible with CAS-based code?
  - [x] Yes — threads can repeatedly fail and retry CAS in symmetric patterns, spinning without progress unless backoff is added.
  - [ ] No — CAS eliminates all concurrency bugs.
  - [ ] No — CAS converts livelock into deadlock.
  - [ ] Only on single-core systems.
  - why: Although CAS rules out deadlock (no held locks), multiple threads colliding on the same word can all CAS-fail and retry together. Random backoff on failed CAS prevents this, just as it prevents trylock-based livelock.

## Gotchas

- **Livelock is still possible**: Even without locks, if multiple threads' CAS operations repeatedly fail and retry, they may spin endlessly without making progress (livelock). Adding random backoff helps.
- **ABA Problem**: Thread A reads value X, does some work, then CAS checks if X is unchanged. But another thread may have changed X to Y and back to X in the meantime. CAS will succeed even though the data structure is in an unexpected state. Solution: use versioned pointers or double-word CAS.
- **Complexity and correctness**: Lock-free code is notoriously difficult to get right. Subtle race conditions can hide for months until they manifest under high load.
- **Not universally faster**: For short critical sections with low contention, locks can be faster due to less retry overhead. Lock-free shines at high contention.
- **Limited to single-memory-location atomics**: CAS only works on one memory word. Multi-word atomic updates require locks or more complex techniques.

## Sources

- Operating Systems: Three Easy Pieces, Chapter 32 (Zhang), pages 24–28 (lock-free list insertion with CAS)
- COP 4600 Week 9_1 Lecture Slides, pages 20–23 (CompareAndSwap, AtomicIncrement, list insertion)

