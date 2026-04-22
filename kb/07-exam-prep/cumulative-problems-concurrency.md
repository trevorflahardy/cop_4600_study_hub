# Cumulative Concurrency Problems

## Overview

This problem set covers synchronization primitives, concurrency bugs, and deadlock. Topics include race conditions, mutexes, condition variables, semaphores, producer-consumer patterns, reader-writer synchronization, and the four Coffman deadlock conditions. These problems emphasize code-level reasoning: spotting bugs, understanding why they occur, and designing correct synchronization.

## Problem 1: Spotting a Race Condition

**Setup:**
A bank account system where two threads concurrently perform deposits and withdrawals:

```c
int balance = 1000;

void deposit(int n) {
    balance += n;
}

void withdraw(int n) {
    balance -= n;
}
```

Two threads:
- Thread A: calls deposit(100)
- Thread B: calls withdraw(50)

Both run concurrently starting from balance=1000.

**Task:**
1. Explain the race condition.
2. Show a problematic interleaving.
3. Propose a fix.

**Solution:**

1. **Race condition explanation:**
Both deposit and withdraw perform a read-modify-write (RMW) sequence:
- `balance += n` is compiled to: load balance, add n, store balance
- `balance -= n` is compiled to: load balance, subtract n, store balance

These operations are not atomic. Two threads can interleave, causing one thread's update to be lost.

2. **Problematic interleaving:**
Initial balance = 1000

| Step | Thread A        | Thread B        | balance | Comment |
|------|-----------------|-----------------|---------|---------|
| 1    | load balance (1000) | -            | 1000    | A loads 1000 |
| 2    | -               | load balance (1000) | 1000    | B also loads 1000 |
| 3    | add 100 → 1100  | -               | 1000    | A computes 1100 |
| 4    | -               | subtract 50 → 950 | 1000    | B computes 950 |
| 5    | store balance (1100) | -          | 1100    | A writes 1100 |
| 6    | -               | store balance (950) | 950    | B writes 950 |

**Final balance: 950** (expected 1050 = 1000 + 100 − 50)

Lost 100 from the deposit (A's write was overwritten by B's write).

3. **Fix using a mutex:**

```c
#include <pthread.h>

int balance = 1000;
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

void deposit(int n) {
    pthread_mutex_lock(&lock);
    balance += n;
    pthread_mutex_unlock(&lock);
}

void withdraw(int n) {
    pthread_mutex_lock(&lock);
    balance -= n;
    pthread_mutex_unlock(&lock);
}
```

Now, only one thread can execute the critical section at a time. Either A completes (balance becomes 1100), then B runs (balance becomes 1050), or vice versa (order varies but result is correct).

**Why it matters:**
Race conditions are among the most common concurrency bugs. Testing alone cannot reliably catch them (they depend on precise timing). Understanding atomicity and mutual exclusion is essential for correctness.

---

## Problem 2: Producer-Consumer with Condition Variables

**Setup:**
A single producer and single consumer share a bounded buffer (capacity = 1 element). The producer generates data and inserts it; the consumer removes and consumes it.

Broken implementation using a single condition variable:

```c
int buffer;
int count = 0; // 0 = empty, 1 = full
pthread_mutex_t lock;
pthread_cond_t cond;

void producer() {
    for (int i = 0; i < 10; i++) {
        pthread_mutex_lock(&lock);
        while (count == 1) {
            pthread_cond_wait(&cond, &lock);
        }
        buffer = i;
        count = 1;
        pthread_cond_signal(&cond);
        pthread_mutex_unlock(&lock);
    }
}

void consumer() {
    for (int i = 0; i < 10; i++) {
        pthread_mutex_lock(&lock);
        while (count == 0) {
            pthread_cond_wait(&cond, &lock);
        }
        int val = buffer;
        count = 0;
        pthread_cond_signal(&cond);
        pthread_mutex_unlock(&lock);
    }
}
```

**Task:**
1. Identify the bug in this implementation.
2. Describe a problematic execution scenario.
3. Provide a fixed version.

**Solution:**

1. **Bug identification:**
A single condition variable is shared by both producer and consumer. When the producer signals after inserting, it could wake up another producer (if there were multiple) instead of the consumer. Similarly, when the consumer signals, it could wake another consumer instead of the producer.

In this case with single producer and single consumer, the code might work by luck. But if we had two consumers or two producers, the bug manifests: a woken thread of the same type (e.g., a second consumer) would check the while condition, find the buffer empty, and wait again, missing the signal. The intended recipient (producer or consumer of the opposite type) remains blocked.

2. **Problematic scenario (with two consumers):**
- Producer inserts item. Buffer full (count=1). Produces signal.
- Both consumers are waiting on cond.
- Signal wakes Consumer1. Consumer1 acquires lock, reads buffer, sets count=0, signals.
- Signal wakes Consumer2 (not the producer!). Consumer2 acquires lock, checks while (count == 0), finds true, and waits again.
- Producer is still waiting (blocked in while or on signal). Deadlock: both consumers waiting, producer blocked.

3. **Fixed version using two condition variables:**

```c
int buffer;
int count = 0;
pthread_mutex_t lock;
pthread_cond_t empty;  // signaled when buffer becomes empty
pthread_cond_t fill;   // signaled when buffer becomes full

void producer() {
    for (int i = 0; i < 10; i++) {
        pthread_mutex_lock(&lock);
        while (count == 1) {
            pthread_cond_wait(&empty, &lock);
        }
        buffer = i;
        count = 1;
        pthread_cond_signal(&fill);
        pthread_mutex_unlock(&lock);
    }
}

void consumer() {
    for (int i = 0; i < 10; i++) {
        pthread_mutex_lock(&lock);
        while (count == 0) {
            pthread_cond_wait(&fill, &lock);
        }
        int val = buffer;
        count = 0;
        pthread_cond_signal(&empty);
        pthread_mutex_unlock(&lock);
    }
}
```

Now, the producer signals `fill` (waking consumers), and the consumer signals `empty` (waking producers). No thread waits on the wrong condition variable.

**Why it matters:**
Condition-variable bugs are subtle. The rule: use separate condition variables for logically distinct waiting conditions. One CV per resource state change (fill, empty, in this case) prevents spurious wake-ups and ensures the right thread is notified.

---

## Problem 3: Reader-Writer Synchronization

**Setup:**
Multiple readers and writers access a shared data structure (e.g., a cache). Readers can run concurrently, but writers need exclusive access. No reader should see a partially-written value.

Use a mutex (`rmutex`) protecting a reader count, a writer-protection mutex (`wmutex`), and an integer `readers` (count of active readers).

**Task:**
1. Describe the reader-preference strategy.
2. Write pseudocode for reader and writer entry/exit.
3. Explain a weakness and how to address it.

**Solution:**

1. **Reader-preference strategy:**
Readers are prioritized: if any readers hold the resource, new readers can acquire it without waiting for writers. Writers starve under continuous reader load.

2. **Pseudocode:**

```
Reader:
    rmutex.lock()
    readers++
    if (readers == 1) {
        wmutex.lock()  // first reader locks writer
    }
    rmutex.unlock()
    
    // read shared data
    
    rmutex.lock()
    readers--
    if (readers == 0) {
        wmutex.unlock()  // last reader releases writer
    }
    rmutex.unlock()

Writer:
    wmutex.lock()
    // write shared data
    wmutex.unlock()
```

Readers use the first-reader / last-reader pattern: the first reader acquires wmutex (blocking writers), and the last reader releases it. Multiple readers can proceed concurrently because only the first/last manipulate wmutex.

3. **Weakness: Writer starvation**
If readers continuously arrive, wmutex is never released for long enough for a writer to acquire it. The writer starves.

**Fix: Writer preference**
Introduce a writer-waiting flag and a condition variable. Readers check the flag before entering:

```
writerWaiting = false
writerCV

Reader:
    rmutex.lock()
    while (writerWaiting) {  // if writer waiting, reader yields
        rmutex.wait(writerCV)
    }
    readers++
    if (readers == 1) {
        wmutex.lock()
    }
    rmutex.unlock()
    // ... read ...
    rmutex.lock()
    readers--
    if (readers == 0) {
        wmutex.unlock()
        writerWaiting = false  // signal writer is now possible
        wmutex.broadcast(writerCV)
    }
    rmutex.unlock()

Writer:
    rmutex.lock()
    writerWaiting = true
    rmutex.unlock()
    wmutex.lock()
    // ... write ...
    wmutex.unlock()
```

Now, once a writer signals its intent (writerWaiting = true), new readers block, and the writer can acquire wmutex after existing readers finish.

**Why it matters:**
Reader-writer synchronization is a classic pattern in concurrent systems (databases, caches, file systems). Understanding fairness trade-offs (reader vs. writer preference) is crucial for system design. Exams often ask for detection and fixing of starvation bugs.

---

## Problem 4: Semaphore-Based Producer-Consumer

**Setup:**
A producer and consumer with a bounded buffer (capacity = 3 elements). Use semaphores:
- `empty`: initially 3 (count of empty slots)
- `full`: initially 0 (count of filled slots)
- `mutex`: initially 1 (mutual exclusion on buffer manipulation)

**Task:**
Write pseudocode using semaphore operations (wait, signal) for producer and consumer.

**Solution:**

```
Semaphore empty(3), full(0), mutex(1);
int buffer[3];
int in = 0, out = 0;  // pointers

Producer:
    while (true) {
        item = produce()
        empty.wait()        // wait for empty slot
        mutex.wait()        // acquire lock
        buffer[in] = item
        in = (in + 1) % 3
        mutex.signal()      // release lock
        full.signal()       // signal filled slot
    }

Consumer:
    while (true) {
        full.wait()         // wait for filled slot
        mutex.wait()        // acquire lock
        item = buffer[out]
        out = (out + 1) % 3
        mutex.signal()      // release lock
        empty.signal()      // signal empty slot
        consume(item)
    }
```

**Correctness:**
- `empty.wait()` ensures producer doesn't overwrite a filled slot. Starts at 3 (all empty).
- `full.wait()` ensures consumer doesn't read from an empty slot. Starts at 0 (no filled items).
- `mutex` prevents buffer races (in/out pointer corruption).
- When producer inserts, it decrements `empty` and increments `full`.
- When consumer removes, it decrements `full` and increments `empty`.
- Buffer size is preserved: empty + full = 3 (always).

**Why it matters:**
Semaphores are lighter-weight than condition variables and naturally encode bounded-buffer constraints. This pattern is used in real-world systems. Understanding semaphore semantics and the empty/full relationship is critical.

---

## Problem 5: Deadlock Analysis

**Setup:**
Four processes (P1, P2, P3, P4) and four resources (R1, R2, R3, R4). Resource allocation state:

| Process | Holds | Wants |
|---------|-------|-------|
| P1      | R1    | R2    |
| P2      | R2    | R3    |
| P3      | R3    | R4    |
| P4      | R4    | R1    |

**Task:**
1. Check the four Coffman conditions for deadlock.
2. Is the system in deadlock?
3. Break the deadlock by removing one condition.

**Solution:**

1. **Coffman conditions:**
   - **Mutual exclusion:** Yes. Each resource (R1–R4) is held exclusively by one process.
   - **Hold-and-wait:** Yes. P1 holds R1 while waiting for R2; P2 holds R2 while waiting for R3, etc.
   - **No preemption:** Yes. Resources cannot be forcibly taken; a process must release them voluntarily.
   - **Circular wait:** Yes. P1 → P2 → P3 → P4 → P1 forms a cycle:
     - P1 waits for R2 (held by P2)
     - P2 waits for R3 (held by P3)
     - P3 waits for R4 (held by P4)
     - P4 waits for R1 (held by P1)

2. **Is the system in deadlock?** Yes. All four Coffman conditions are present, creating a circular wait. Every process is blocked waiting for a resource held by another blocked process. No forward progress is possible.

3. **Break deadlock:**

   **Option A: Remove circular wait**
   Impose a total order on resources (R1 < R2 < R3 < R4). Each process must request resources in increasing order:
   - P4 requests R1 then R4 (was holding R4, wanting R1, but now in order R1 < R4, request R1 first). Once granted R1 and R4 are already held (wait), no cycle forms.
   
   In practice: P1 requests in order R1, R2. P2 requests in order R2, R3. P3 requests in order R3, R4. P4 requests in order R1, R4 (not R4, R1).
   
   Now P4 waits for R1 (held by P1), but P1 is waiting for R2 (held by P2, who is waiting for R3, held by P3, who is waiting for R4, held by ... no one). The cycle is broken because P4 no longer holds R4 while requesting R1.

   **Option B: Remove hold-and-wait**
   Require a process to request all resources at once, before execution:
   - P1 must request (R1, R2) atomically.
   - P2 must request (R2, R3) atomically.
   - P3 must request (R3, R4) atomically.
   - P4 must request (R4, R1) atomically.
   
   If P1 requests both R1 and R2 at once, the request cannot be granted (R2 is held by P2). But now P2 also requests both R2 and R3, and cannot be granted. This still deadlocks. Actually, with all-or-nothing, one process must succeed in getting all its resources (if we have enough). Suppose we grant P1 (R1, R2). Then P4 cannot get R1, but P2 and P3 can (R2 is now free? No, P1 holds R1 and R2). This reduces the problem but doesn't eliminate it in this scenario.
   
   Better: One process must eventually be able to acquire all its resources if we limit concurrent requests.

   **Option C: Remove no-preemption**
   Allow forcible resource removal: if P1 is waiting for R2 (held by P2), preempt R2 from P2, give to P1. P2 must release its resources and restart.
   - P4 requests R1 from P1. Preempt R1, give to P4. P4 runs, releases R1 (done).
   - P1 can now acquire R1, waits for R2 from P2. Preempt R2, give to P1. P1 runs (done).
   - P2 restarts, acquires R2, waits for R3 from P3. Preempt R3, give to P2. P2 runs (done).
   - P3 restarts, acquires R3, waits for R4 from P4. Preempt R4? But P4 is done (has no resources). P3 acquires R4, runs (done).
   
   Process completes via preemption and rollback.

**Why it matters:**
Deadlock detection and recovery are critical in database systems and OS kernels. The Coffman conditions provide a framework for understanding when deadlock occurs. Exams test your ability to identify cycles and propose fixes.

---

## Problem 6: Atomicity Violation

**Setup:**
Two threads accessing a shared variable `flag`:

```c
volatile int flag = 0;

void thread_A() {
    if (flag == 0) {
        // ... time passes (context switch here) ...
        flag = 1;
    }
}

void thread_B() {
    flag = 0;
}
```

Thread A reads flag, is preempted, and later writes flag. Thread B writes flag in between.

**Task:**
1. Show an interleaving that violates the intended atomicity.
2. Explain what the programmer likely intended.
3. Fix the bug.

**Solution:**

1. **Problematic interleaving:**

| Step | Thread A          | Thread B        | flag | Issue |
|------|-------------------|-----------------|------|-------|
| 1    | read flag (=0)    | -               | 0    | A reads flag |
| 2    | condition true    | -               | 0    | A enters if block |
| 3    | (execute code)    | -               | 0    | A does some work |
| 4    | -                 | write flag=0    | 0    | B overwrites flag to 0 |
| 5    | write flag=1      | -               | 1    | A writes flag=1 |

Thread A's intended check (if flag == 0, then execute critical code) is violated. Thread B's write in step 4 occurred between A's read and write, making the read stale.

2. **Intended behavior:**
Thread A wants to perform: "atomically check if flag==0, and if so, set flag=1." This is typically used as a simple lock or flag update. The programmer assumes the check and write happen together without interference.

3. **Fix using a mutex:**

```c
volatile int flag = 0;
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

void thread_A() {
    pthread_mutex_lock(&lock);
    if (flag == 0) {
        flag = 1;
    }
    pthread_mutex_unlock(&lock);
}

void thread_B() {
    pthread_mutex_lock(&lock);
    flag = 0;
    pthread_mutex_unlock(&lock);
}
```

Now, the entire check-and-set in thread A is atomic with respect to thread B's write. The lock ensures only one thread accesses flag at a time.

**Alternative fix using compare-and-swap (CAS):**

```c
#include <stdatomic.h>

volatile _Atomic(int) flag = 0;

void thread_A() {
    int expected = 0;
    atomic_compare_exchange_strong(&flag, &expected, 1);
}

void thread_B() {
    atomic_store(&flag, 0);
}
```

CAS is atomic at the hardware level, ensuring the comparison and exchange are indivisible.

**Why it matters:**
Atomicity violations are a major class of concurrency bugs. They occur when the programmer assumes a sequence of operations is atomic, but it's not. Using locks or atomic operations ensures correctness.

