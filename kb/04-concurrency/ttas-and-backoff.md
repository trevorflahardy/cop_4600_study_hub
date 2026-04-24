# TTAS and Backoff

## Definition

**Test-Test-And-Set (TTAS)** reduces unnecessary atomic operations by first checking (non-atomically) whether the lock is free before attempting an atomic test-and-set. **Backoff** (exponential or linear) reduces contention by delaying a thread for a period before retrying the lock, giving other threads time to release it.

## When to use

TTAS is useful in moderately contended systems where the cost of failed atomic operations is significant. Exponential backoff is essential in heavily contended systems to reduce cacheline bouncing and give the lock holder time to release the lock. Both are practical improvements over basic spinlocks.

## Key ideas

- **TTAS**: Spin on a non-atomic read until the lock appears free, then try atomic TAS
- **Non-atomic read cost**: Faster (no cache coherency overhead) than atomic operations
- **Cache locality**: Non-atomic reads reduce unnecessary cache synchronization
- **Backoff**: Delay before retrying; reduces collision rate and hot-spots
- **Exponential backoff**: Delay doubles on each failure (e.g., 1, 2, 4, 8 cycles)
- **Contention awareness**: More failures suggest higher contention, so back off more
- **Trade-off**: Backoff may delay lock acquisition unnecessarily in low-contention scenarios

## Pseudocode

Test-Test-And-Set:
```
void lock(lock_t *lock) {
    while (1) {
        while (lock->flag == 1)  // spin on non-atomic read
            ;
        if (TestAndSet(&lock->flag, 1) == 0)
            return;              // lock acquired
    }
}
```

TTAS with linear backoff:
```
void lock(lock_t *lock) {
    int delay = 1;
    while (1) {
        while (lock->flag == 1)  // non-atomic spin
            ;
        if (TestAndSet(&lock->flag, 1) == 0)
            return;
        // backoff: delay before retrying
        for (int i = 0; i < delay; i++)
            ;  // busy-wait
        delay += 1;
    }
}
```

TTAS with exponential backoff:
```
void lock(lock_t *lock) {
    int delay = 1;
    int max_delay = 1024;
    while (1) {
        while (lock->flag == 1)
            ;
        if (TestAndSet(&lock->flag, 1) == 0)
            return;
        for (int i = 0; i < delay; i++)
            ;  // delay
        if (delay < max_delay)
            delay *= 2;
    }
}
```

## Hand-trace example

TTAS comparison (2 threads):

| Step | Thread 1 | Thread 2 | flag | Notes |
|------|----------|----------|------|-------|
| 1 | check flag (0) | - | 0 | T1: not locked, proceed |
| 2 | TAS(flag, 1) | - | 1 | T1: atomic, acquires lock |
| 3 | (critical sect) | check flag (1) | 1 | T2: locked, spin |
| 4 | (critical sect) | (spin, flag=1) | 1 | T2 keeps spinning |
| 5 | (critical sect) | (spin, flag=1) | 1 | T2 reads non-atomic (cheap) |
| 6 | flag = 0 | (spin, flag=1) | 0 | T1 releases |
| 7 | (done) | check flag (0) | 0 | T2: not locked, proceed |
| 8 | - | TAS(flag, 1) | 1 | T2: acquired |

Exponential backoff sequence on contention:

| TAS attempt | Backoff cycles | Result |
|-----|---------|--------|
| 1 | 0 | Failed |
| 2 | 1 | Failed (delay 1 cycle) |
| 3 | 2 | Failed (delay 2 cycles) |
| 4 | 4 | Failed (delay 4 cycles) |
| 5 | 8 | Failed (delay 8 cycles) |
| 6 | 16 | Failed (delay 16 cycles) |
| 7 | 32 | Success (delay 32 cycles before retry) |

## Common exam questions

- **MCQ:** How does TTAS improve on plain TAS spinlocks?
  - [x] It spins on a cheap non-atomic read until the lock looks free, then attempts a single atomic TAS
  - [ ] It uses CAS instead of TAS to be faster
  - [ ] It disables interrupts during the spin
  - [ ] It guarantees FIFO fairness
  - why: Repeated TAS attempts invalidate the cache line across cores; reading non-atomically keeps the line shared and only performs an atomic op when acquisition looks plausible.

- **MCQ:** Why does naive TAS on every iteration hurt performance under contention?
  - [x] Each atomic write invalidates the cache line on other cores, creating cacheline ping-pong
  - [ ] TAS instructions are slower than regular loads on all architectures
  - [ ] TAS requires a kernel trap
  - [ ] It prevents the compiler from inlining the loop
  - why: Atomic stores force the cache line into Modified state on the writer, invalidating copies elsewhere; repeated TAS across cores thrashes the coherence protocol.

- **MCQ:** In exponential backoff, what is the typical update rule after a failed TAS?
  - [x] Double the current delay (up to some maximum cap)
  - [ ] Increment delay by 1
  - [ ] Halve the current delay
  - [ ] Reset delay to 1 on every failure
  - why: Exponential growth quickly thins out retries under heavy contention, reducing collisions and coherence traffic; the cap prevents pathological latencies.

- **MCQ:** What is a downside of exponential backoff?
  - [x] A waiter may delay acquiring a free lock because its scheduled retry is far in the future
  - [ ] It violates mutual exclusion
  - [ ] It prevents other threads from acquiring the lock
  - [ ] It requires a kernel system call per retry
  - why: After a long backoff, the lock may free up but the thread sleeps through it; there is tension between reducing contention and responsiveness.

- **MCQ:** Which of these best describes the "test" part of test-test-and-set?
  - [x] A non-atomic read of the flag, cheap because it doesn't migrate the cache line
  - [ ] An atomic compare-and-swap
  - [ ] A kernel call that checks lock state
  - [ ] A write to the flag, but only if we expect to acquire
  - why: The initial spin is a read-only check; because it is non-atomic, cache lines remain shared and no coherence invalidation happens while the lock is held.

- **MCQ:** Compared to TTAS + backoff, why might a park-based (futex) lock be preferable under heavy contention?
  - [x] Waiters sleep in the kernel instead of consuming CPU time while backed off
  - [ ] Park-based locks guarantee FIFO
  - [ ] Park-based locks avoid atomic instructions
  - [ ] Park-based locks are faster in the uncontended case
  - why: Even with backoff, spinning still burns CPU; parking removes waiters from the scheduler so other work can run.

## Gotchas

- **Over-backoff**: Excessive backoff can increase latency even when contention is low
- **Adaptive backoff**: Fixed backoff doesn't adapt to load; true adaptive backoff is more complex
- **Lock-free semantics**: Backoff complicates fairness guarantees
- **TTAS cost**: Non-atomic reads still have overhead (cache misses, etc.); the gain is relative
- **Not a replacement for better algorithms**: TTAS+backoff is incremental; fundamentally better locks (parking) are superior

## Sources

- lectures__Week7_1.txt
- zhang__Chapter+28+Locks+v6.txt
