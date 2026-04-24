# Zemaphore: Condition-Variable-Backed Semaphore

## Definition

A **Zemaphore** (or user-space semaphore) is a semaphore implementation built on top of mutexes and condition variables. This demonstrates how to construct one synchronization primitive from others and shows the relationship between different synchronization mechanisms.

## When to use

Zemaphores are educational, showing how semaphores can be implemented with more primitive constructs. In practice, use native semaphore libraries (sem_t). The main value is understanding the underlying mechanics of synchronization.

## Key ideas

- **Composition**: Zemaphores are built from mutex + CV, showing that all synchronization primitives are interchangeable
- **Integer value semantics**: Stores an integer representing available resources
- **Condition variable**: Threads wait on the CV when value <= 0
- **Mutex protection**: All operations are protected by the mutex
- **Relaxed invariant**: Unlike true semaphores, Zemaphores allow value to go negative (value represents waiting threads)
- **Signal semantics**: A post() increments value and signals; a wait() spins until value > 0, then decrements

## Pseudocode

Zemaphore implementation:
```
typedef struct __Zem_t {
    int value;
    pthread_cond_t cond;
    pthread_mutex_t lock;
} Zem_t;

void Zem_init(Zem_t *s, int value) {
    s->value = value;
    pthread_cond_init(&s->cond, NULL);
    pthread_mutex_init(&s->lock, NULL);
}

void Zem_wait(Zem_t *s) {
    pthread_mutex_lock(&s->lock);
    while (s->value <= 0)
        pthread_cond_wait(&s->cond, &s->lock);
    s->value--;
    pthread_mutex_unlock(&s->lock);
}

void Zem_post(Zem_t *s) {
    pthread_mutex_lock(&s->lock);
    s->value++;
    pthread_cond_signal(&s->cond);
    pthread_mutex_unlock(&s->lock);
}
```

## Hand-trace example

Zemaphore usage (parent-child signaling, Zem initialized to 0):

| Step | Parent | Child | value | Condition | Notes |
|------|--------|-------|-------|-----------|-------|
| 1 | Zem_wait() | - | 0 | wait | Parent: lock, while(0<=0) true, wait on CV |
| 2 | (sleeping) | Zem_post() | 0 | (sleeping) | Child: lock |
| 3 | (sleeping) | (post) | 1 | signal | Child: increment value=1, signal |
| 4 | (sleeping) | unlock | 1 | (signaled) | Child: release lock |
| 5 | (woken) | (done) | 1 | while(<=0)? | Parent: reacquire lock, recheck |
| 6 | value-- | (done) | 0 | (none) | Parent: value=0, exit loop |
| 7 | unlock | (done) | 0 | (done) | Parent: release lock |

Binary semaphore (mutex, Zem initialized to 1):

| Step | T1 | T2 | value | Notes |
|------|----|----|-------|-------|
| 1 | Zem_wait() | - | 1 | T1: lock, while(1<=0) false, value=0 |
| 2 | (crit sect) | Zem_wait() | 0 | T2: lock, while(0<=0) true, wait |
| 3 | (crit sect) | (sleeping) | 0 | T1 in critical section |
| 4 | Zem_post() | (sleeping) | 0 | T1: lock, value=1, signal |
| 5 | unlock | (woken) | 1 | T1 releases; T2 wakes |
| 6 | (done) | while(<=0)? false | 0 | T2: recheck, value=1, exit loop, value=0 |
| 7 | (done) | unlock | 0 | T2 releases |

Counting semaphore (MAX buffers, Zem initialized to MAX=2):

| Step | Event | value | Notes |
|------|-------|-------|-------|
| 1 | Zem_wait() (Producer) | 2 | P: lock, while(2<=0) false, value=1 |
| 2 | Zem_wait() (Producer) | 1 | P: lock, while(1<=0) false, value=0 |
| 3 | Zem_wait() (Producer) | 0 | P: lock, while(0<=0) true, WAIT |
| 4 | Zem_post() (Consumer) | 1 | C: lock, value=1, signal (wake P) |
| 5 | (P woken) | 0 | P: recheck while(1<=0) false, value=0 |

## Common exam questions

- **MCQ:** Why does `Zem_wait` use a `while` loop around `pthread_cond_wait`?
  - [x] Mesa semantics mean the predicate may be false when the thread reacquires the mutex
  - [ ] `if` is a syntax error with condition variables
  - [ ] `while` avoids spurious wakeups by disabling them
  - [ ] `while` is required to decrement the semaphore value
  - why: Another thread may have consumed the post between the signal and the waiter reacquiring the mutex; the while-loop re-checks before decrementing.

- **MCQ:** Which primitive(s) does a Zemaphore use internally?
  - [x] One mutex and one condition variable
  - [ ] A single futex
  - [ ] Two condition variables and no mutex
  - [ ] Hardware CAS only
  - why: The whole point is to show a semaphore can be built from mutex + CV; no atomic primitives are directly used.

- **MCQ:** Can you build a semaphore from a condition variable alone, with no mutex?
  - [x] No — the mutex is required to protect the value and avoid lost wakeups
  - [ ] Yes — the CV already provides mutual exclusion
  - [ ] Yes, if you use `pthread_cond_broadcast` instead of signal
  - [ ] Yes — CVs internally embed a lock
  - why: A CV does not protect any state; without a mutex, the value field and the wait predicate can race, and lost-wakeup bugs become inevitable.

- **MCQ:** How does a Zemaphore differ from a classic Dijkstra semaphore's invariant?
  - [x] Zemaphore `value` never goes negative; a classic semaphore's value can encode waiters as negative
  - [ ] Zemaphore allows negative values; classic semaphores don't
  - [ ] Zemaphore always uses broadcast; classic uses signal
  - [ ] Zemaphore requires kernel support; classic doesn't
  - why: In the Zemaphore, waiters park in the CV wait queue, not in a negative counter; each Zem_wait only decrements when value > 0.

- **MCQ:** Initialized with value = 1, a Zemaphore behaves like:
  - [x] A mutex
  - [ ] A 1-slot producer/consumer signal
  - [ ] A read-write lock
  - [ ] A barrier
  - why: First waiter decrements to 0, subsequent waiters block until a post increments to 1, exactly like a binary semaphore / mutex.

- **MCQ:** In `Zem_post`, why is `pthread_cond_signal` called while the mutex is held?
  - [x] Holding the mutex prevents a lost wakeup where a waiter has re-evaluated the predicate but not yet slept
  - [ ] POSIX forbids signaling without the mutex
  - [ ] Signal must atomically release the mutex
  - [ ] Broadcasts require the mutex but signals don't
  - why: Although signaling-under-lock can cause one extra context-switch on some systems, doing so ensures the signaled state and the predicate update are observed consistently by waiters.

## Gotchas

- **Relaxed invariant**: Zemaphore value can go below zero (representing waiting threads); true semaphores maintain value >= 0
- **Not the same as real semaphores**: The Linux semaphore maintains an invariant that value + num_waiters = initial_value; Zemaphores don't
- **Efficiency**: Each Zem_wait/post operation acquires a mutex and possibly signals a CV; true semaphores may be more efficient
- **Mesa semantics**: Zemaphore relies on while loops; a buggy version using if would have race conditions
- **Overhead**: Two operations (mutex + CV) per wait/post; can be slower than hardware-backed semaphores

## Sources

- lectures__Week8_1.txt
- zhang__Chapter+31+Semaphores+v2.txt
