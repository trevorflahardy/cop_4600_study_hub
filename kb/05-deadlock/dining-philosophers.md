# The Dining Philosophers Problem

## Definition

The dining philosophers problem is a classic concurrency puzzle: N philosophers sit around a table with N forks (one between each pair). Each philosopher alternates between thinking and eating. To eat, a philosopher must acquire both the fork to their left and the fork to their right. The naive solution deadlocks; two solutions fix it: (a) odd philosophers pick up right fork first, even pick up left first (asymmetric ordering), or (b) allow at most N-1 philosophers at the table simultaneously.

## When to use

- As a canonical example of circular-wait deadlock with symmetric resource contention.
- To illustrate how small asymmetries in lock acquisition order prevent deadlock.
- To teach the cost of serialization (limiting the number of philosophers eating).

## Key ideas

### The Naive Deadlock-Prone Solution

```c
#define N 5
pthread_mutex_t fork[N];

void *philosopher(void *arg) {
    int i = *(int *)arg;
    while (1) {
        think(i);
        
        // Pick up left fork
        pthread_mutex_lock(&fork[i]);
        
        // Pick up right fork
        pthread_mutex_lock(&fork[(i + 1) % N]);
        
        eat(i);
        
        // Put down right fork
        pthread_mutex_unlock(&fork[(i + 1) % N]);
        
        // Put down left fork
        pthread_mutex_unlock(&fork[i]);
    }
}
```

**Problem**: If all philosophers pick up their left fork simultaneously, each holds a left fork and waits for a right fork that is held by another philosopher → **circular wait deadlock**.

### Solution 1: Odd-Even Asymmetric Ordering

Odd-numbered philosophers pick up right fork first, then left fork. Even-numbered philosophers pick up left fork first, then right fork.

```c
void *philosopher(void *arg) {
    int i = *(int *)arg;
    while (1) {
        think(i);
        
        if (i % 2 == 0) {
            // Even philosopher: left first, then right
            pthread_mutex_lock(&fork[i]);
            pthread_mutex_lock(&fork[(i + 1) % N]);
        } else {
            // Odd philosopher: right first, then left
            pthread_mutex_lock(&fork[(i + 1) % N]);
            pthread_mutex_lock(&fork[i]);
        }
        
        eat(i);
        
        if (i % 2 == 0) {
            pthread_mutex_unlock(&fork[(i + 1) % N]);
            pthread_mutex_unlock(&fork[i]);
        } else {
            pthread_mutex_unlock(&fork[i]);
            pthread_mutex_unlock(&fork[(i + 1) % N]);
        }
    }
}
```

**Why it works**: The asymmetry breaks the circular wait. While all philosophers still claim mutual exclusion over forks (hold-and-wait condition), the lock acquisition order is no longer uniform. This prevents the circular chain where each philosopher waits for a resource held by the next.

### Solution 2: Semaphore-Based Limit (N-1 Philosophers)

Allow at most N-1 philosophers at the table simultaneously, preventing the circular wait by guaranteeing at least one philosopher can always make progress.

```c
#define N 5
pthread_mutex_t fork[N];
pthread_semaphore_t table_limit;  // Initialized to N-1

void *philosopher(void *arg) {
    int i = *(int *)arg;
    while (1) {
        think(i);
        
        sem_wait(&table_limit);  // At most N-1 at table
        
        pthread_mutex_lock(&fork[i]);
        pthread_mutex_lock(&fork[(i + 1) % N]);
        
        eat(i);
        
        pthread_mutex_unlock(&fork[(i + 1) % N]);
        pthread_mutex_unlock(&fork[i]);
        
        sem_post(&table_limit);  // Leave table
    }
}
```

**Why it works**: With N-1 philosophers at the table, at least one philosopher has both forks available (by pigeonhole principle). That philosopher eats, releases the forks, and others can proceed. The circular wait is impossible because you can't have a cycle with N-1 entities requiring N resources.

## Pseudocode

Both solutions in clear pseudocode:

```c
// Solution 1: Odd-Even Ordering
void *philosopher_odd_even(void *arg) {
    int i = *(int *)arg;
    while (1) {
        think(i);
        
        int left = i;
        int right = (i + 1) % N;
        
        if (i % 2 == 0) {
            lock(fork[left]);
            lock(fork[right]);
        } else {
            lock(fork[right]);
            lock(fork[left]);
        }
        
        eat(i);
        
        unlock(fork[right]);
        unlock(fork[left]);
    }
}

// Solution 2: Limit at Table
void *philosopher_limited(void *arg) {
    int i = *(int *)arg;
    while (1) {
        think(i);
        
        sem_wait(&max_at_table);  // N-1 max
        lock(fork[i]);
        lock(fork[(i+1) % N]);
        eat(i);
        unlock(fork[(i+1) % N]);
        unlock(fork[i]);
        sem_post(&max_at_table);
    }
}
```

## Hand-trace example

**Naive solution with all 5 philosophers (deadlock):**

| Time | P0 | P1 | P2 | P3 | P4 | Fork[0] | Fork[1] | Fork[2] | Fork[3] | Fork[4] |
|------|----|----|----|----|----|---------|---------|---------|---------|----|
| 1 | lock[0] | lock[1] | lock[2] | lock[3] | lock[4] | P0 | P1 | P2 | P3 | P4 |
| 2 | wait[1] | wait[2] | wait[3] | wait[4] | wait[0] | P0 | P1 | P2 | P3 | P4 |

All philosophers hold their left fork and wait for their right fork, which is held by the next philosopher. **Circular wait → Deadlock.**

**Solution 1 (Odd-Even, P0,P2,P4 even; P1,P3 odd):**

| Time | P0 (even: L then R) | P1 (odd: R then L) | P2 (even) | P3 (odd) | P4 (even) | Fork[0] | Fork[1] | Fork[2] | Fork[3] | Fork[4] |
|------|--------|--------|----------|----------|----------|---------|---------|---------|---------|----|
| 1 | lock[0] | lock[1] | lock[2] | lock[3] | lock[4] | P0 | P1 | P2 | P3 | P4 |
| 2 | lock[1] wait | - | lock[3] wait | lock[4] wait | lock[0] wait | P0 | P1 | P2 | P3 | P4 |
| 3 | - | lock[0] | - | - | - | P1 | P1 | P2 | P3 | P4 |
| 4 | - | eats | - | - | - | P1 | P1 | P2 | P3 | P4 |

P1 (odd) locks fork[1] first (right), then fork[0] (left), and succeeds because P0 hasn't locked fork[1] yet (was waiting on it). This breaks the circular dependency, allowing progress.

**Solution 2 (Limit to 4 at table, N=5):**

| Time | P0 | P1 | P2 | P3 | P4 | sem_limit | Outcome |
|------|----|----|----|----|----|-----------|----|
| 1 | wait(sem) | wait(sem) | wait(sem) | wait(sem) | wait(sem) | 4 | One waits outside |
| 2 | 0 | 0 | 0 | 0 | blocks | 0 | Four at table |
| 3 | lock[0], lock[1], eats | blocks | lock[2], lock[3], eats | blocks | blocks | 0 | Two can eat |
| 4 | eats → post(sem) | - | eats → post(sem) | - | - | 2 | Two released |

With only 4 philosophers at the table, at least one has both forks. Progress is guaranteed.

## Comparison Table

| Dimension | Odd-Even Ordering | N-1 Limit |
|-----------|-------------------|-----------|
| **Correctness** | Correct; no deadlock via asymmetric ordering | Correct; no deadlock via pigeonhole principle |
| **Fairness** | All philosophers get equal opportunity | Fair if semaphore is FIFO; odd-even may favor even/odd |
| **Concurrency** | High; many philosophers can eat simultaneously | Moderate; at most N-1 can eat, so one always waiting |
| **Complexity** | Moderate; requires conditional logic for odd/even | Simple; just a semaphore gate |
| **Scalability** | Scales well with N philosophers | Degrades as N grows; always one waits |
| **Real-world applicability** | Used in actual resource allocation (e.g., address-ordered locking) | Used in connection pooling, thread pools |

## Common exam questions

- Draw the naive code and show an interleaving that leads to deadlock. Identify the four conditions present.
- Explain why the odd-even ordering breaks the circular wait in dining philosophers.
- How does the N-1 limit prevent deadlock? Why is it sufficient?
- Compare the two solutions on fairness and concurrency. Which would you use in practice?
- Generalize the odd-even solution to N locks (not just 5 philosophers).
- Can the odd-even solution starve any philosopher? Why or why not?

## Gotchas

- **The naive solution is ALWAYS used as a counterexample**: Be very clear that it deadlocks.
- **Odd-even only works because N is symmetric**: With asymmetric counts, the pattern breaks.
- **N-1 limit wastes concurrency**: One philosopher always sits idle, never eating. This is the cost of guaranteed progress.
- **Both solutions assume forks are modeled as mutexes**: In the real problem, forks might be modeled differently (e.g., as resources in a banker's algorithm).
- **Starvation vs. deadlock**: The odd-even solution does not prevent starvation (some philosophers might eat less frequently), but it does prevent deadlock.

## Sources

- Operating Systems: Three Easy Pieces, Chapter 32 (Zhang), references the dining philosophers problem
- COP 4600 Week 9_1 Lecture Slides, pages 2–3 (The problem statement and helper functions)
- Zhang Reader-Writer Problem PDF, page 9 (Odd-even fork ordering solution code)
- Midterm 2 Review, Dining Philosophers section (naive deadlock version and fix)

