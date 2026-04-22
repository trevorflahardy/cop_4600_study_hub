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

- How does TTAS improve on basic TAS spinlocks?
- Why is exponential backoff more effective than linear backoff?
- Explain cache coherency effects: why do frequent atomic operations hurt performance?
- Describe a scenario where backoff is essential vs. optional.
- What is the risk of excessive backoff?

## Gotchas

- **Over-backoff**: Excessive backoff can increase latency even when contention is low
- **Adaptive backoff**: Fixed backoff doesn't adapt to load; true adaptive backoff is more complex
- **Lock-free semantics**: Backoff complicates fairness guarantees
- **TTAS cost**: Non-atomic reads still have overhead (cache misses, etc.); the gain is relative
- **Not a replacement for better algorithms**: TTAS+backoff is incremental; fundamentally better locks (parking) are superior

## Sources

- lectures__Week7_1.txt
- zhang__Chapter+28+Locks+v6.txt
