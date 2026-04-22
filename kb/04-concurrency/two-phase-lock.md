# Two-Phase Locks

## Definition

A **two-phase lock** (or hybrid lock) combines spinning and sleeping. In phase 1, a thread spins hoping the lock will be released soon. If the lock is not acquired after phase 1, the thread enters phase 2 and yields control to the OS (park/sleep), avoiding further CPU waste.

## When to use

Use two-phase locks in general-purpose systems where contention patterns vary. Phase 1 spinning is effective when the lock holder is running on another CPU and will release soon. Phase 2 sleeping prevents CPU waste when contention is heavy. This approach balances the benefits of both strategies.

## Key ideas

- **Phase 1 (spin)**: Optimistic approach assuming lock will be released soon
- **Phase 2 (sleep)**: Pessimistic approach when phase 1 fails
- **Context switch cost**: Traded for potential short spin benefit
- **OS integration**: Phase 2 uses OS primitives (park/unpark or futex) to manage sleeping threads
- **Threshold tuning**: The spin duration is critical; too short wastes opportunities, too long wastes CPU
- **Lock holder assumption**: Assumes lock holder is actively running; ineffective if holder is also blocked

## Pseudocode

Two-phase lock with fixed spin duration:
```
void lock(lock_t *lock) {
    // Phase 1: Spin for a while
    int spin_count = SPIN_THRESHOLD;  // e.g., 100 iterations
    while (spin_count > 0 && lock->flag == 1) {
        spin_count--;
    }
    
    if (lock->flag == 0 && TestAndSet(&lock->flag, 1) == 0)
        return;  // acquired during spin
    
    // Phase 2: Give up and sleep
    park();  // put thread to sleep; OS scheduler takes over
}

void unlock(lock_t *lock) {
    lock->flag = 0;
    unpark(waiting_thread);  // wake one sleeping thread
}
```

Alternative with adaptive tuning:
```
void lock(lock_t *lock) {
    int spin_count = 100;
    for (int i = 0; i < spin_count; i++) {
        if (TestAndSet(&lock->flag, 1) == 0)
            return;  // success during phase 1
    }
    // Phase 1 failed, enter phase 2
    park();
}
```

## Hand-trace example

Two-phase lock with 3 threads, SPIN_THRESHOLD=5:

| Step | T1 | T2 | T3 | flag | Notes |
|------|----|----|----|----|-------|
| 1 | TAS (phase 1) | - | - | 1 | T1 acquires, enters critical section |
| 2 | (crit sect) | TAS (phase 1) | - | 1 | T2 fails phase 1 spin |
| 3 | (crit sect) | park() | - | 1 | T2 enters phase 2, sleeps |
| 4 | (crit sect) | (sleeping) | TAS (phase 1) | 1 | T3 fails phase 1 spin |
| 5 | (crit sect) | (sleeping) | park() | 1 | T3 enters phase 2, sleeps |
| 6 | flag=0 | (sleeping) | (sleeping) | 0 | T1 releases lock |
| 7 | unlock() | unpark(T2) | (sleeping) | 0 | T1 wakes T2 |
| 8 | (done) | (woken, runnable) | (sleeping) | 1 | T2 acquired (or enters phase 1 again) |
| 9 | - | (crit sect) | (sleeping) | 1 | T2 executes |
| 10 | - | flag=0 | (sleeping) | 0 | T2 releases |
| 11 | - | unlock() | unpark(T3) | 0 | T2 wakes T3 |
| 12 | - | (done) | (woken) | 1 | T3 acquired |

## Common exam questions

- Explain the rationale behind the two-phase approach.
- What is the ideal spin duration for phase 1?
- Why is two-phase locking preferable to pure spinning or pure sleeping?
- How does the OS scheduler interact with phase 2 sleeping?
- Describe a scenario where phase 1 is effective vs. ineffective.

## Gotchas

- **Spin threshold tuning**: No one-size-fits-all value; depends on lock contention and critical section length
- **Wake-up overhead**: OS wake-up can be expensive if done frequently
- **Cache effects**: Spinning keeps the lock in cache; sleeping loses cache affinity
- **Scheduler interaction**: If the lock holder is not running, spinning wastes time
- **Fairness lost**: Two-phase doesn't guarantee FIFO order unless combined with queueing

## Sources

- lectures__Week7_1.txt
- zhang__Chapter+28+Locks+v6.txt
