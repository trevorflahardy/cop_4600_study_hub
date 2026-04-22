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

- What is the difference between an order violation and a race condition?
- Given code with an order violation, explain what could go wrong and show a safe version using a condition variable.
- Why is a simple assignment like `ready = 1` insufficient to enforce order in concurrent code?
- What role does the state variable (e.g., `mtInit`) play in the condition variable fix?
- Why must you use `while (ready == 0)` instead of `if (ready == 0)` when waiting?
- Can an order violation occur with locks but without condition variables? (Answer: Yes, if you only lock the final assignment and not the entire initialization.)

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

