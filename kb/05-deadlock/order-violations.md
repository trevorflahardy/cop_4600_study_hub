# Order Violations

## Definition

An order violation occurs when the execution order of two memory accesses is inverted from what was intended, typically when one thread uses a variable before another thread has finished initializing it. The code implicitly assumes A happens before B, but in concurrent execution, B occurs before A, causing the dependent operation to fail or read uninitialized data.

## When to use

- Debugging thread initialization and creation issues.
- Understanding why synchronization primitives like condition variables are necessary.
- Analyzing code where one thread depends on another thread's setup work.

## Key ideas

### The Problem

Thread 1 creates and initializes a shared data structure, and Thread 2 uses it. Logically, Thread 1's initialization must complete before Thread 2 accesses the data. But without explicit synchronization, Thread 2 can run and access the data before Thread 1 finishes initialization.

### Classic Example: mThread Initialization

From Zhang Chapter 32, a real bug pattern in Mozilla Firefox:

```c
// UNSAFE: Order violation
int mThread = NULL;

Thread1:
void init() {
    mThread = PR_CreateThread(mMain, ...);
    // Initialization "logically" complete here
}

Thread2:
void mMain(...) {
    mState = mThread->State;  // mThread might still be NULL!
}
```

**The order violation:**

1. Thread 1 spawns Thread 2 by calling `PR_CreateThread()`.
2. Logically, "Thread 2 initialization is done" should happen before "Thread 2 accesses mThread".
3. But the scheduler can run Thread 2 immediately before Thread 1 finishes setting `mThread`.
4. Thread 2 reads `mThread` while it is still NULL → crash (dereferencing NULL).

The **intended order**: `mThread = value` → `mThread is used`
The **actual order**: `mThread is used` → `mThread = value`

### The Fix: Condition Variable

Use a condition variable to enforce the order:

```c
// SAFE: Order enforced with CV
pthread_mutex_t mtLock = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t mtCond = PTHREAD_COND_INITIALIZER;
int mtInit = 0;  // State variable to remember initialization

Thread1:
void init() {
    mThread = PR_CreateThread(mMain, ...);
    
    // Signal that initialization is complete
    pthread_mutex_lock(&mtLock);
    mtInit = 1;
    pthread_cond_signal(&mtCond);
    pthread_mutex_unlock(&mtLock);
}

Thread2:
void mMain(...) {
    // Wait for initialization to be signaled
    pthread_mutex_lock(&mtLock);
    while (mtInit == 0)
        pthread_cond_wait(&mtCond, &mtLock);
    pthread_mutex_unlock(&mtLock);
    
    // Now safe to use mThread
    mState = mThread->State;
}
```

**Why it works:**

- Thread 2 calls `pthread_cond_wait()`, which releases the mutex and blocks.
- Thread 1 acquires the mutex, sets `mtInit = 1`, signals, and releases the mutex.
- Thread 2 wakes up, re-acquires the mutex, checks `mtInit == 1` (true), and proceeds.
- The signal enforces that Thread 1's initialization completes before Thread 2 accesses the initialized data.

## Pseudocode

Generic pattern for order violations and fixes:

```c
// UNSAFE: Thread2 uses data before Thread1 initializes it
int data = 0;
int ready = 0;

Thread1:
void initialize() {
    data = compute_value();
    ready = 1;  // Signal ready (not atomic!)
}

Thread2:
void use_data() {
    if (ready == 1) {
        use(data);  // Might not be computed yet!
    }
}

// SAFE: Use a condition variable
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t cond = PTHREAD_COND_INITIALIZER;
int ready = 0;

Thread1:
void initialize() {
    data = compute_value();
    pthread_mutex_lock(&lock);
    ready = 1;
    pthread_cond_signal(&cond);
    pthread_mutex_unlock(&lock);
}

Thread2:
void use_data() {
    pthread_mutex_lock(&lock);
    while (ready == 0)
        pthread_cond_wait(&cond, &lock);
    pthread_mutex_unlock(&lock);
    use(data);
}
```

## Hand-trace example

**Unsafe (order violation):**

| Step | Thread1 | Thread2 | mThread | mtInit | Outcome |
|------|---------|---------|---------|--------|---------|
| 1 | spawn Thread2 | - | NULL | 0 | Thread2 created |
| 2 | - | mMain() | NULL | 0 | Thread2 runs |
| 3 | - | mThread->State | NULL | 0 | **T2 dereferences NULL; crash** |
| 4 | mThread = value | - | value | 0 | T1 sets (too late) |

Thread2 accesses before Thread1 initializes.

**Safe (with condition variable):**

| Step | Thread1 | Thread2 | mThread | mtInit | Outcome |
|------|---------|---------|---------|--------|---------|
| 1 | spawn Thread2 | - | NULL | 0 | Thread2 created |
| 2 | - | mMain() | NULL | 0 | T2 starts |
| 3 | - | wait(cond) [BLOCK] | NULL | 0 | T2 blocks on CV |
| 4 | mThread = value | - | value | 0 | T1 sets value |
| 5 | signal(cond) | - | value | 0 | T1 signals |
| 6 | - | [wakes] | value | 0 | T2 wakes |
| 7 | - | mtState = mThread->State | value | 0 | **T2 safely reads initialized value** |

Thread1's initialization completes before Thread2 uses it.

## Common exam questions

- **MCQ:** Thread 1 creates Thread 2 via `mThread = PR_CreateThread(...)`; Thread 2 immediately reads `mThread->State`, which may still be NULL. What kind of bug is this?
  - [x] Order violation: Thread 2 uses mThread before Thread 1's initialization is guaranteed to complete.
  - [ ] Atomicity violation: a check-then-use sequence is split.
  - [ ] Deadlock: both threads wait on each other's locks.
  - [ ] Livelock: both threads spin retrying.
  - why: The bug is an implicit ordering assumption (init must happen before use) that is not enforced. No check-then-use pair, no cycle in a wait-for graph, no spinning retries.
- **MCQ:** Which primitive is the standard fix for the mThread order violation?
  - [x] A condition variable plus a state flag, with Thread 2 waiting and Thread 1 signaling after initialization.
  - [ ] Replacing the pointer with CAS.
  - [ ] Adding a global lock ordering.
  - [ ] Adding random backoff before Thread 2 reads mThread.
  - why: The correct tool for "wait until X is true" is a condition variable guarded by a mutex and a state variable. Thread 1 sets the state and signals; Thread 2 waits until the state becomes true. CAS, lock ordering, and backoff target different bug classes.
- **MCQ:** Why must the waiter use `while (ready == 0) pthread_cond_wait(...)` rather than `if (ready == 0) pthread_cond_wait(...)`?
  - [x] Spurious wakeups and lost wakeups mean the condition must be rechecked after every return from cond_wait.
  - [ ] `if` does not compile with condition variables.
  - [ ] `while` is needed to enforce mutual exclusion.
  - [ ] `while` automatically adds random backoff.
  - why: pthread_cond_wait may return without a matching signal (spurious wakeup). Using `while` rechecks the predicate after waking and blocks again if it is still false, which is the safe idiom.
- **MCQ:** Why is `ready = 1;` as a plain assignment (no mutex, no condition variable) insufficient to enforce order in concurrent code?
  - [x] Without memory barriers, compiler/CPU reordering and cache effects can make Thread 2 see `ready == 1` before it sees the preceding initialization of `data`.
  - [ ] Plain assignment is always atomic and works fine.
  - [ ] `ready = 1` always deadlocks.
  - [ ] `ready = 1` only works on single-core systems.
  - why: Under relaxed memory models, stores can be reordered so another thread observes `ready = 1` while `data` is still stale. Mutex/condvar operations include the memory barriers that make the initialization visible before the flag.
- **MCQ:** What distinguishes an order violation from an atomicity violation (Lu et al.)?
  - [x] Order violation: one access should happen before another but is not enforced. Atomicity violation: two accesses should be indivisible but another thread interleaves between them.
  - [ ] They are the same bug with different names.
  - [ ] Order violations always deadlock; atomicity violations never do.
  - [ ] Order violations occur only with trylock; atomicity violations never do.
  - why: Both are non-deadlock concurrency bugs from the Lu et al. study. Order violations are about happens-before ordering of independent accesses; atomicity violations are about interleaving inside a supposedly atomic region.
- **MCQ:** What role does the `mtInit` state variable play in the CV-based fix?
  - [x] It remembers that initialization has already completed, so a late-arriving waiter does not block forever after the signal was sent.
  - [ ] It acts as a lock to provide mutual exclusion.
  - [ ] It adds random backoff.
  - [ ] It forces preemption of the initializer thread.
  - why: Without a state variable, a thread that starts waiting after the signal has fired would miss the wakeup and sleep forever. `mtInit` records that the event happened, so new waiters check the flag and proceed immediately.

## Gotchas

- **Order violations are implicit dependencies**: Unlike deadlock, which is explicit (two threads waiting for each other), order violations are implicit assumptions in the code ("this should be initialized first"). Easy to miss.
- **Spurious wakeups require while loop**: Condition variables can wake a thread even if the signal was not sent (spurious wakeup). Using `if` instead of `while` allows incorrect behavior.
- **Signal outside the critical section is dangerous**: If you signal without holding the lock, another thread can check the condition and then sleep after the signal is sent, missing the wakeup.
- **Initialization is a common pattern**: Order violations are often found in thread creation and pool initialization. Be alert for this pattern.
- **Compiler reordering**: In relaxed memory models (like ARM or some CPU optimizations), even the assignment `ready = 1` can be reordered with previous writes. Locks and condition variables include memory barriers to prevent this.

## Sources

- Operating Systems: Three Easy Pieces, Chapter 32 (Zhang), pages 8–10 (Order-violation bugs, mThread example, solution with condition variables)
- COP 4600 Week 9_1 Lecture Slides, pages 9–11 (Order-violation bugs, mThread initialization problem, CV solution, while loop requirement)
- Midterm 2 Practice, Question 4 (producer-consumer with lost wakeup, order violation variant)

