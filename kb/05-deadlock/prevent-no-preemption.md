# Prevent Deadlock: Eliminate No Preemption

## Definition

Eliminating the no-preemption condition means allowing locks to be forcibly removed or released by a thread when they cannot be acquired. By using `pthread_mutex_trylock()` instead of blocking lock acquisition, a thread can release held locks and retry, effectively preempting its own resource allocation. However, naive retry loops cause livelock; adding random backoff fixes this.

## When to use

- When you want a thread to give up locks rather than wait indefinitely for another lock.
- In scenarios where you cannot deadlock but might livelock (and you add random delay to avoid livelock).
- In adaptive systems where retry with backoff is acceptable overhead.

## Key ideas

### trylock() Mechanism

`pthread_mutex_trylock(&lock)` returns:
- **0** (success) if the lock is acquired immediately
- **Non-zero** (typically -1) if the lock is held by another thread, without blocking

This allows a thread to check if a lock is available and proceed or retry if not.

### Basic trylock Pattern (Without Backoff)

```c
top:
pthread_mutex_lock(&L1);
if (pthread_mutex_trylock(&L2) == -1) {
    pthread_mutex_unlock(&L1);
    goto top;  // retry
}
// Critical section: now hold both L1 and L2
pthread_mutex_unlock(&L2);
pthread_mutex_unlock(&L1);
```

If `trylock(&L2)` fails, release L1 and retry the whole sequence. This breaks the no-preemption condition: a thread releases L1 (preempts its own resource) if it cannot get L2.

### The Livelock Problem

With the naive pattern above, both threads can enter a busy loop:
- Thread T1 acquires L1, fails on L2, releases L1, retries
- Thread T2 acquires L2, fails on L1, releases L2, retries
- Both threads keep trying and failing in a tight loop → **livelock**

Threads are active (spinning), not blocked, so the system is "busy" but making no progress.

### Solution: Random Backoff

Add a random delay before retrying to break the livelock cycle:

```c
top:
pthread_mutex_lock(&L1);
if (pthread_mutex_trylock(&L2) == -1) {
    pthread_mutex_unlock(&L1);
    // Random delay: reduces chance of collision
    sleep(random_delay());
    goto top;  // retry after delay
}
// Critical section: now hold both L1 and L2
pthread_mutex_unlock(&L2);
pthread_mutex_unlock(&L1);
```

With random backoff, the probability that both threads retry at exactly the same time decreases, allowing one to eventually succeed.

## Pseudocode

Without backoff (can livelock):

```c
void acquire_both(pthread_mutex_t *L1, pthread_mutex_t *L2) {
    top:
    pthread_mutex_lock(L1);
    if (pthread_mutex_trylock(L2) != 0) {
        pthread_mutex_unlock(L1);
        goto top;
    }
}
```

With backoff (avoids livelock):

```c
void acquire_both(pthread_mutex_t *L1, pthread_mutex_t *L2) {
    int retries = 0;
    top:
    pthread_mutex_lock(L1);
    if (pthread_mutex_trylock(L2) != 0) {
        pthread_mutex_unlock(L1);
        // Random backoff
        int delay = rand() % (1 << retries);  // exponential backoff
        usleep(delay);
        retries = (retries < 10) ? retries + 1 : 10;  // cap backoff
        goto top;
    }
}
```

## Hand-trace example

**Without backoff (livelock scenario):**

| Time | Thread T1 | Thread T2 | L1 | L2 | Notes |
|------|-----------|-----------|----|----|-------|
| 1 | lock(L1) | - | T1 | Free | T1 holds L1 |
| 2 | - | lock(L2) | T1 | T2 | T2 holds L2 |
| 3 | trylock(L2) FAIL | - | T1 | T2 | T1 fails |
| 4 | - | trylock(L1) FAIL | T1 | T2 | T2 fails |
| 5 | unlock(L1) | unlock(L2) | Free | Free | Both release |
| 6 | lock(L1) | lock(L2) | T1 | T2 | Back to step 1 → **LIVELOCK** |

Both threads retry and fail repeatedly, wasting CPU cycles.

**With backoff (resolves):**

| Time | Thread T1 | Thread T2 | L1 | L2 | Notes |
|------|-----------|-----------|----|----|-------|
| 5 | unlock(L1) | unlock(L2) | Free | Free | Both release |
| 6 | sleep(random) | sleep(random) | Free | Free | T2's random delay is shorter |
| 7 | - | lock(L2) | Free | T2 | T2 wakes first |
| 8 | lock(L1) [WAIT] | lock(L1) WAIT | Free | T2 | T1 blocked; T2 holds L2 |
| 9 | - | unlock(L2), unlock(L1) | Free | Free | T2 finishes; releases all |
| 10 | lock(L1) | - | T1 | Free | T1 now acquires both (T2 not competing) |

With different random delays, T2 finishes before T1 retries, breaking the symmetry.

## Common exam questions

- What is the difference between deadlock and livelock? Which one does trylock() with no backoff cause?
- Why does random backoff solve livelock?
- What is the CPU waste of spinning with trylock() vs. blocking lock()?
- Can exponential backoff guarantee eventual lock acquisition? Under what conditions?
- Compare the performance of trylock + backoff vs. lock ordering by address.

## Gotchas

- **Livelock can still occur without backoff**: Naive trylock retry loops can get into a busy-wait livelock. The exam often tests whether you understand this.
- **Random backoff is not deterministic**: Makes testing and debugging harder. Hard to reproduce timing-dependent bugs.
- **Performance overhead**: Spinning and retrying (even with backoff) wastes CPU. Blocking locks (condition variables) are often more efficient.
- **Exponential backoff caps out**: If backoff grows too large, the delay becomes unnecessarily long. Usually cap at a reasonable upper bound (e.g., 100ms).
- **Fairness issues**: High-contention scenarios with random backoff can favor some threads over others unpredictably.

## Sources

- Operating Systems: Three Easy Pieces, Chapter 32 (Zhang), pages 22–24 (No preemption, trylock, livelock, random delay solution)
- COP 4600 Week 9_1 Lecture Slides, pages 17–19 (Prevention via no preemption, trylock, livelock, random delay)
- Midterm 2 Exam, Question 11 (livelock vs. deadlock distinction with trylock)

