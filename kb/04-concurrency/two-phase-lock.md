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

- **MCQ:** What does a two-phase lock do during phase 1?
  - [x] Spin for a bounded number of iterations hoping the lock will be released quickly
  - [ ] Immediately call park() to avoid CPU waste
  - [ ] Broadcast on a condition variable
  - [ ] Yield the CPU every iteration
  - why: Phase 1 is a short, bounded spin — cheap if the holder is about to release, and avoids kernel overhead.

- **MCQ:** When is phase 1 (spin) MOST effective?
  - [x] Short critical sections when the holder is running on another CPU and will release soon
  - [ ] Long critical sections on oversubscribed systems
  - [ ] When the lock holder is blocked on I/O
  - [ ] When there are many more waiters than CPUs
  - why: Spinning only pays if the wait is short and the holder is making progress on another core; otherwise spinning just burns cycles.

- **MCQ:** What triggers the transition from phase 1 to phase 2?
  - [x] Exhausting the spin budget without acquiring the lock
  - [ ] A clock interrupt
  - [ ] An explicit fallback system call from the user
  - [ ] Detecting cache-line contention
  - why: Phase 2 is entered when the bounded spin gives up; the thread then parks / goes to sleep rather than burning more CPU.

- **MCQ:** Why is a pure spinlock worse than two-phase locking for long critical sections?
  - [x] Pure spinning burns an entire CPU per waiter for the whole duration
  - [ ] Pure spinning cannot enforce mutual exclusion
  - [ ] Pure spinning requires kernel intervention
  - [ ] Pure spinning violates bounded waiting
  - why: For long holds, every waiter is wasting a core; two-phase parks them after a short optimistic spin.

- **MCQ:** Why is a pure sleeping lock worse than two-phase locking for very short critical sections?
  - [x] The context-switch cost of sleep+wake dwarfs the time the holder actually holds the lock
  - [ ] Pure sleeping violates mutual exclusion
  - [ ] Pure sleeping always causes priority inversion
  - [ ] Pure sleeping requires atomic instructions and TTAS cannot
  - why: For microsecond critical sections, entering/leaving the kernel costs far more than just spinning briefly.

- **MCQ:** A major weakness of two-phase locking compared to a plain ticket or futex lock is:
  - [x] It does not provide strict FIFO fairness unless combined with a queue
  - [ ] It violates mutual exclusion
  - [ ] It requires no atomic instructions
  - [ ] It cannot release the lock if the holder spins
  - why: Two-phase locking is about waste-avoidance, not fairness; whichever waiter finds the lock free may acquire, so starvation is possible without explicit queuing.

## Gotchas

- **Spin threshold tuning**: No one-size-fits-all value; depends on lock contention and critical section length
- **Wake-up overhead**: OS wake-up can be expensive if done frequently
- **Cache effects**: Spinning keeps the lock in cache; sleeping loses cache affinity
- **Scheduler interaction**: If the lock holder is not running, spinning wastes time
- **Fairness lost**: Two-phase doesn't guarantee FIFO order unless combined with queueing

## Sources

- lectures__Week7_1.txt
- zhang__Chapter+28+Locks+v6.txt
