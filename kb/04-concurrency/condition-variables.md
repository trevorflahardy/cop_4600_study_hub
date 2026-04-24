# Condition Variables

## Definition

A **condition variable** is a synchronization primitive that allows threads to sleep (wait) until a specific condition becomes true, at which point another thread signals (wakes) one or more waiting threads. Condition variables are always paired with a mutex to protect the shared state being checked.

## When to use

Use condition variables whenever a thread needs to wait for a condition to become true (e.g., a buffer to fill, a counter to reach a target). Essential for producer-consumer problems, thread ordering, and any scenario where sleep-based synchronization is needed.

## Key ideas

- **Wait semantics**: Atomically releases mutex and puts thread to sleep; acquires mutex again upon waking
- **Mesa vs. Hoare**: Most systems use Mesa semantics (no guarantee that condition still holds when woken)
- **Always use while loops**: Even though POSIX uses `if`, using `while` is safer because condition may change after waking
- **Mutex pairing**: CVs must be used with a mutex; the mutex protects both the state and the condition variable
- **Signal vs. broadcast**: Signal wakes one thread; broadcast wakes all waiting threads
- **Spurious wakeups**: A thread may wake without an explicit signal (rare but possible)

## Pseudocode

Basic condition variable usage:
```
pthread_cond_t cond = PTHREAD_COND_INITIALIZER;
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
int value = 0;  // shared state

// Thread waiting for value == 5
void waiter() {
    pthread_mutex_lock(&lock);
    while (value != 5) {  // Always use while, not if
        pthread_cond_wait(&cond, &lock);
        // Woken up, mutex re-acquired, re-check condition
    }
    // value == 5 now (with lock held)
    pthread_mutex_unlock(&lock);
}

// Thread setting value and signaling
void signaler() {
    pthread_mutex_lock(&lock);
    value = 5;
    pthread_cond_signal(&cond);  // wake one waiter
    pthread_mutex_unlock(&lock);
}
```

## Hand-trace example

Simple producer-consumer with one CV (incorrect, for illustration):

```
int buffer = 0;
int count = 0;
pthread_cond_t cond = PTHREAD_COND_INITIALIZER;
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

void *producer(void *arg) {
    pthread_mutex_lock(&lock);
    if (count == 1)
        pthread_cond_wait(&cond, &lock);
    count = 1;
    buffer = 42;
    pthread_cond_signal(&cond);
    pthread_mutex_unlock(&lock);
    return NULL;
}

void *consumer(void *arg) {
    pthread_mutex_lock(&lock);
    if (count == 0)
        pthread_cond_wait(&cond, &lock);
    int val = buffer;
    count = 0;
    pthread_cond_signal(&cond);
    pthread_mutex_unlock(&lock);
    printf("consumed: %d\n", val);
    return NULL;
}
```

Execution trace (broken due to using if instead of while):

| Step | Thread | State | buffer | count | Notes |
|------|--------|-------|--------|-------|-------|
| 1 | C | lock | 0 | 0 | Consumer acquires lock |
| 2 | C | check (count==0) | 0 | 0 | True, will wait |
| 3 | C | wait (sleep) | 0 | 0 | Consumer releases lock and sleeps |
| 4 | P | lock | 0 | 0 | Producer acquires lock (C sleeping) |
| 5 | P | check (count==1) | 0 | 0 | False, no wait needed |
| 6 | P | produce | 42 | 1 | Buffer set to 42, count=1 |
| 7 | P | signal | 42 | 1 | Producer signals (wakes C) |
| 8 | P | unlock | 42 | 1 | Producer releases lock |
| 9 | C | wake (acquire lock) | 42 | 1 | Consumer re-acquires lock and wakes |
| 10 | C | use if (recheck?) | 42 | 1 | With `if`: doesn't recheck; buffer consumed |

Correct version (use while):

| Step | Thread | State | buffer | count | Notes |
|------|--------|-------|--------|-------|-------|
| 1-8 | P, C | (same setup) | 42 | 1 | Same up to signal |
| 9 | C | wake (acquire lock) | 42 | 1 | Consumer wakes, re-acquires lock |
| 10 | C | while(count==0) recheck | 42 | 1 | With `while`: rechecks; condition false |
| 11 | C | use buffer | 42 | 1 | Consumes safely |

## Common exam questions

- **MCQ:** Why must the predicate surrounding `pthread_cond_wait` be a `while` loop, not an `if`?
  - [x] Under Mesa semantics and spurious wakeups, the condition may be false when the thread finally reacquires the mutex
  - [ ] `if` is syntactically invalid with condition variables in POSIX
  - [ ] `while` is required so the thread never sleeps
  - [ ] `while` automatically retries the `cond_signal` call
  - why: Mesa semantics plus spurious wakeups mean a woken thread must re-check the predicate; `if` would proceed on stale state.

- **MCQ:** What atomic operation does `pthread_cond_wait(&c, &m)` perform when entered?
  - [x] Release `m` and put the thread to sleep on `c`, atomically
  - [ ] Acquire `m` and signal `c` atomically
  - [ ] Spin on `c` without releasing `m`
  - [ ] Broadcast on `c` and then acquire `m`
  - why: The whole point of `cond_wait` is that releasing the mutex and sleeping happen as one step so no signal can be missed between them.

- **MCQ:** Why must a condition variable be paired with a mutex?
  - [x] The mutex protects the shared state the predicate tests and prevents lost wakeups
  - [ ] The mutex stores the actual condition value
  - [ ] pthread implementation requires a mutex for memory allocation
  - [ ] The mutex is what puts the thread to sleep
  - why: Without the mutex, one thread could evaluate the predicate, then lose a signal issued before it blocks — the classic lost-wakeup race.

- **MCQ:** What is the key difference between `pthread_cond_signal` and `pthread_cond_broadcast`?
  - [x] signal wakes at most one waiter; broadcast wakes all waiters
  - [ ] signal is synchronous; broadcast is asynchronous
  - [ ] signal guarantees the woken thread sees the condition; broadcast does not
  - [ ] signal requires the mutex held; broadcast does not
  - why: Signal picks one waiter (implementation-chosen); broadcast wakes every waiter, each of which then re-acquires the mutex in turn.

- **MCQ:** A signaler sets `value = 5` then calls `pthread_cond_signal` without holding the mutex. What can go wrong?
  - [x] A waiter can check the predicate, miss the signal, then sleep forever (lost wakeup)
  - [ ] pthread_cond_signal will crash when called outside a critical section
  - [ ] The signal always reaches the waiter, but 5 is lost
  - [ ] Broadcast becomes required in place of signal
  - why: If the signaler does not hold the mutex, its store and signal can be interleaved so a waiter evaluates the predicate (false), and then the signal arrives with no one waiting.

- **MCQ:** Why might a thread wake from `pthread_cond_wait` even though no other thread called `signal` or `broadcast`?
  - [x] Spurious wakeups are permitted by the standard; the loop re-checks and sleeps again
  - [ ] Timer expiration always wakes threads
  - [ ] The mutex automatically signals the CV on release
  - [ ] The OS guarantees no spurious wakeups — this cannot happen
  - why: POSIX explicitly allows spurious wakeups, which is another reason the predicate must sit inside a `while` loop.

## Gotchas

- **If vs. while**: Using `if` instead of `while` can lead to waking the wrong thread or proceeding with a false condition
- **Mutex release**: pthread_cond_wait() atomically releases the mutex; you must re-acquire it after waking (pthread does this automatically)
- **No return value on condition**: The condition variable doesn't store the condition; you must check it yourself
- **Spurious wakeups**: Some systems wake threads without a signal; always recheck the condition
- **Mesa semantics gotcha**: When woken, the condition may already be false (another thread could have consumed it first); always loop

## Sources

- lectures__Week6_2.txt
- lectures__Week7_2.txt
- zhang__Chapter+30+Condition+Variables+v2.txt
