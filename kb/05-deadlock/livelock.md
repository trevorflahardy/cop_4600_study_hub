# Livelock

## Definition

Livelock is a concurrency issue where threads are active and running (not blocked), but neither makes progress toward their goal. Threads are stuck in a loop of repeated actions that undo each other, similar to deadlock in outcome (no progress), but threads are busy-spinning rather than blocked. Typically occurs with naive `pthread_mutex_trylock()` retry patterns without backoff.

## When to use

- Understanding the downside of trylock-based lock acquisition patterns.
- Distinguishing between deadlock (blocked, waiting) and livelock (active but not progressing).
- Recognizing and fixing spinning retry loops that cause busy-wait.

## Key ideas

### Deadlock vs. Livelock

| Property | Deadlock | Livelock |
|----------|----------|----------|
| **Thread state** | Blocked (waiting on lock) | Active (running, spinning) |
| **CPU usage** | Low (blocked threads don't execute) | High (busy-spinning, wasting CPU) |
| **Symptom** | Program hangs, no progress | Program runs but nothing happens |
| **Observable** | System scheduler shows threads blocked | System shows high CPU, but no useful work |

### Livelock with trylock()

The naive trylock pattern (without backoff):

```c
top:
pthread_mutex_lock(&L1);
if (pthread_mutex_trylock(&L2) == -1) {
    pthread_mutex_unlock(&L1);
    goto top;  // Retry immediately
}
```

With two threads and two locks:

- Thread T1: lock L1, try L2, fail, release L1, retry
- Thread T2: lock L2, try L1, fail, release L2, retry
- Both threads are running (not blocked) but repeatedly failing to make progress
- Result: **livelock** (busy spinning, no progress)

Both threads keep trying and failing in a tight loop, wasting CPU cycles but never acquiring both locks simultaneously.

### Why Livelock Occurs

Symmetry in retry logic causes collisions:

1. Both threads use identical lock-acquisition logic (check L1, then L2).
2. When both fail and retry, they retry at nearly the same time.
3. They collide again, both retry, collide again, ... forever.
4. The symmetric pattern means they never "get ahead" of each other.

### The Fix: Random Backoff

Add a random delay before retrying:

```c
top:
pthread_mutex_lock(&L1);
if (pthread_mutex_trylock(&L2) == -1) {
    pthread_mutex_unlock(&L1);
    sleep(random_delay());  // Random backoff
    goto top;
}
```

With random backoff, the retry times are no longer symmetric. One thread's random delay is shorter than the other's, breaking the symmetry. That thread retries first, and with luck, succeeds before the other thread collides again.

### Statistical Reasoning

With random backoff (e.g., sleep 0–100ms randomly):
- Both threads fail and retry
- One thread's random delay is 20ms, the other's is 80ms
- The 20ms thread wakes first and retries; the 80ms thread is still sleeping
- The 20ms thread may succeed in acquiring both locks before the 80ms thread retries
- Over many iterations, randomness eventually allows progress

## Pseudocode

Without backoff (livelock):

```c
void acquire_both_locks_livelock(lock_t *L1, lock_t *L2) {
    top:
    lock(L1);
    if (trylock(L2) == -1) {
        unlock(L1);
        goto top;  // Tight loop; livelock risk
    }
}
```

With backoff (avoids livelock):

```c
void acquire_both_locks_safe(lock_t *L1, lock_t *L2) {
    int retries = 0;
    top:
    lock(L1);
    if (trylock(L2) == -1) {
        unlock(L1);
        int delay = random() % (1 << min(retries, 10));
        usleep(delay);
        retries++;
        goto top;
    }
}
```

## Hand-trace example

**Without backoff (livelock):**

| Time (ms) | Thread T1 | Thread T2 | L1 | L2 | CPU | Outcome |
|-----------|-----------|-----------|----|----|-----|---------|
| 0 | lock(L1) | - | T1 | Free | 50% | T1 holds L1 |
| 1 | - | lock(L2) | T1 | T2 | 50% | T2 holds L2 |
| 2 | trylock(L2) fail | - | T1 | T2 | 50% | T1 fails |
| 3 | - | trylock(L1) fail | T1 | T2 | 50% | T2 fails |
| 4 | unlock(L1) | unlock(L2) | Free | Free | 50% | Both unlock |
| 5 | lock(L1) | lock(L2) | T1 | T2 | 50% | Back to step 1 |
| ... | (repeat) | (repeat) | (repeat) | (repeat) | 50% | **LIVELOCK** |

Both threads keep trying and failing, wasting CPU at 50% load but making no progress.

**With backoff (resolves):**

| Time (ms) | Thread T1 | Thread T2 | L1 | L2 | CPU | Outcome |
|-----------|-----------|-----------|----|----|-----|---------|
| 0 | lock(L1) | - | T1 | Free | 50% | T1 holds L1 |
| 1 | - | lock(L2) | T1 | T2 | 50% | T2 holds L2 |
| 2 | trylock(L2) fail | - | T1 | T2 | 50% | T1 fails |
| 3 | - | trylock(L1) fail | T1 | T2 | 50% | T2 fails |
| 4 | unlock(L1) | unlock(L2) | Free | Free | 50% | Both unlock |
| 5 | sleep(rand: 50ms) | sleep(rand: 20ms) | Free | Free | 0% | Both sleep (reduced CPU) |
| 25 | - | lock(L2) | Free | T2 | 25% | T2 wakes first (20ms) |
| 26 | - | lock(L1) | T2 | T2 | 25% | T2 holds both; eats |
| 55 | lock(L1) | unlock(L2), unlock(L1) | Free | Free | 0% | T2 finishes; T1 wakes |

T1 waits; T2 wakes earlier (random 20ms < 50ms) and succeeds. **Progress is made; livelock avoided.**

## Common exam questions

- What is the difference between deadlock and livelock? Provide examples of each.
- Describe the trylock + goto top pattern and explain why it can cause livelock.
- How does random backoff solve livelock? Why is randomness necessary?
- Compare the CPU usage and responsiveness of deadlock vs. livelock.
- Can livelock occur with blocking locks (not trylock)? Why or why not?
- Write code that demonstrates livelock and then add backoff to fix it.
- In the exam (Midterm 2, Question 11), does the trylock pattern cause deadlock or livelock? Explain.

## Gotchas

- **Livelock is harder to detect than deadlock**: Deadlock shows as system hang with threads blocked. Livelock shows as high CPU with no progress; easy to miss as "the system is working hard."
- **Random backoff is probabilistic, not guaranteed**: In theory, both threads could have bad luck with random delays and collide forever. In practice, with random backoff, probability of collision decreases exponentially with each retry.
- **Exponential backoff can overshoot**: If you use `1 << retries`, you can grow delays very large (seconds, minutes). Usually cap at a reasonable max (e.g., 100ms).
- **Not all spinning is livelock**: A thread spinning on a single volatile variable waiting for another thread to set it is not livelock (it's polling). Livelock is when symmetric actions keep undoing each other.
- **Other than trylock, livelock can occur in other scenarios**: For example, two threads repeatedly sending each other messages in a way that cancels out progress (rare but possible in complex distributed systems).

## Sources

- Operating Systems: Three Easy Pieces, Chapter 32 (Zhang), pages 22–24 (No preemption, trylock, livelock definition, random delay solution)
- COP 4600 Week 9_1 Lecture Slides, pages 17–19 (Livelock in trylock context, random delay fix)
- Midterm 2 Exam, Question 11 (trylock pattern; distinguishes livelock from deadlock)

