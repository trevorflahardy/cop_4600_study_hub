# Atomicity Violations

## Definition

An atomicity violation occurs when a code region that was intended to be atomic (execute without interruption) is split across multiple operations, and a context switch occurs between them, allowing another thread to observe or modify the data in an inconsistent state. This is a non-deadlock concurrency bug; the violation happens even though there is no explicit lock protecting the region.

## When to use

- Analyzing real-world concurrency bugs in production code.
- Understanding why locks are necessary even for simple-looking code sequences.
- Identifying when a group of statements should be treated as a single atomic unit.

## Key ideas

### The Problem

A code region that logically should execute as one unit is broken into multiple low-level operations by the compiler/CPU. If a context switch occurs between these operations, another thread can interleave and see inconsistent state.

### Classic Example: MySQL proc_info

From Zhang Chapter 32, a real bug in MySQL:

```c
// UNSAFE: Not atomic
Thread1:
if (thd->proc_info) {
    fputs(thd->proc_info, ...);
}

Thread2:
thd->proc_info = NULL;
```

**The atomicity violation:**

Thread1 intends the entire if-block to be atomic: "if proc_info is non-null, use it." But the C code is compiled into multiple machine instructions:

1. Load `proc_info` from memory into a register
2. Check if register is non-null
3. If non-null, call `fputs` with the address

Between steps 2 and 3, Thread2 can execute `thd->proc_info = NULL`, invalidating the pointer. When Thread1 calls `fputs`, it passes a null pointer, causing a crash.

### The Fix: Add a Lock

```c
// SAFE: Atomic with lock
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

Thread1:
pthread_mutex_lock(&lock);
if (thd->proc_info) {
    fputs(thd->proc_info, ...);
}
pthread_mutex_unlock(&lock);

Thread2:
pthread_mutex_lock(&lock);
thd->proc_info = NULL;
pthread_mutex_unlock(&lock);
```

Both threads now hold the lock while accessing `proc_info`, ensuring the entire if-block executes without interference.

## Pseudocode

Generic pattern for atomicity violations:

```c
// UNSAFE: Atomicity violation
int x = 0;

Thread1:
if (x > 0) {           // Check
    x = x - 1;         // Use
}

Thread2:
x = 0;
```

If Thread1 checks `x > 0` and finds it true, but Thread2 sets `x = 0` before Thread1 decrements, Thread1 might decrement a value that is now zero, causing underflow or logical error.

**Safe version:**

```c
// SAFE: Atomic with lock
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

Thread1:
pthread_mutex_lock(&lock);
if (x > 0) {
    x = x - 1;
}
pthread_mutex_unlock(&lock);

Thread2:
pthread_mutex_lock(&lock);
x = 0;
pthread_mutex_unlock(&lock);
```

## Hand-trace example

**Unsafe (atomicity violation):**

| Step | Thread1 | Thread2 | proc_info | Outcome |
|------|---------|---------|-----------|---------|
| 1 | Load proc_info | - | 0xABCD | T1 reads address |
| 2 | Check != NULL | - | 0xABCD | T1 sees non-null |
| 3 | - | proc_info = NULL | NULL | T2 overwrites |
| 4 | fputs(0xABCD) | - | NULL | **T1 uses stale pointer; crash** |

The check and use are not atomic; data changed between them.

**Safe (with lock):**

| Step | Thread1 | Thread2 | proc_info | Outcome |
|------|---------|---------|-----------|---------|
| 1 | lock(mutex) | - | 0xABCD | T1 holds lock |
| 2 | Load proc_info | - | 0xABCD | T1 reads address |
| 3 | Check != NULL | - | 0xABCD | T1 sees non-null |
| 4 | fputs(0xABCD) | [blocked] | 0xABCD | T1 uses pointer safely |
| 5 | unlock(mutex) | - | 0xABCD | T1 releases lock |
| 6 | - | lock(mutex) | 0xABCD | T2 acquires lock |
| 7 | - | proc_info = NULL | NULL | T2 updates safely |
| 8 | - | unlock(mutex) | NULL | T2 releases lock |

The check and use happen without interruption.

## Common exam questions

- **MCQ:** Thread 1 does `if (thd->proc_info) fputs(thd->proc_info, ...);` while Thread 2 does `thd->proc_info = NULL;`. What kind of concurrency bug is this?
  - [x] Atomicity violation: a check-then-use sequence that should be one indivisible unit is split.
  - [ ] Order violation: Thread 2 runs before Thread 1 finishes initializing proc_info.
  - [ ] Deadlock: both threads block waiting for each other.
  - [ ] Livelock: both threads spin in a retry loop.
  - why: The logical atomic region (check != NULL, then use) is interrupted by Thread 2's write. No lock orders violated, nothing is blocked — the check and use just are not atomic.
- **MCQ:** What is the correct fix for the MySQL proc_info atomicity violation?
  - [x] Protect the entire check-and-use region in Thread 1 and the write in Thread 2 with the same mutex.
  - [ ] Acquire locks in a globally consistent order.
  - [ ] Replace the pointer with a CAS-based lock-free update.
  - [ ] Add random backoff before Thread 1 retries the check.
  - why: The bug is that two operations that must be atomic are split. A shared mutex around both threads' access to proc_info makes the check-use pair indivisible. Lock ordering is for deadlock, not atomicity; CAS is for lock-free code; backoff fixes livelock.
- **MCQ:** Can an atomicity violation occur with a single thread (no concurrency)?
  - [x] No — atomicity violations require another thread to interleave between the split operations.
  - [ ] Yes — the compiler can split any C statement into multiple instructions.
  - [ ] Yes — signal handlers always cause atomicity violations.
  - [ ] Yes — CPU pipelines execute instructions out of order even single-threaded.
  - why: An atomicity violation is defined by a concurrent interleaving that exposes intermediate state. Without a second thread (or signal handler racing the main code), no observer sees the split, so the logical atomicity is preserved.
- **MCQ:** Which pattern is the classic red flag for a potential atomicity violation?
  - [x] Check a condition, then act on the value that was checked (check-then-use) without holding a lock.
  - [ ] Using `pthread_cond_wait` inside a `while` loop.
  - [ ] Acquiring two locks in address order.
  - [ ] Calling `malloc` inside a critical section.
  - why: Check-then-use splits two operations that logically should be one: between the check and the use, another thread can invalidate the checked value. The other listed patterns are correct/safe idioms.
- **MCQ:** Thread 1 has `if (x > 0) x = x - 1;` and Thread 2 has `x = 0;`, both unlocked. What can go wrong?
  - [x] Thread 1 may decrement after Thread 2 zeroes x, producing an unintended negative value.
  - [ ] Thread 1 will deadlock waiting for Thread 2's lock.
  - [ ] Thread 1 and Thread 2 will livelock retrying.
  - [ ] The program will segfault because x is not initialized.
  - why: Thread 1 checks `x > 0`, sees true, then Thread 2 sets `x = 0`, then Thread 1 subtracts 1 producing -1 — an underflow caused by the check and the use not being atomic together.
- Compare atomicity violations to order violations. Which is more common in real code and why?

## Gotchas

- **Atomicity violations are non-obvious**: Unlike race conditions on a single variable, atomicity violations involve a sequence of accesses that logically should be atomic. The bug may not manifest immediately.
- **Granularity matters**: What should be atomic depends on the semantics of the code. A programmer must decide what units of work should be indivisible.
- **False positives with locks**: Adding a lock breaks the violation, but it's not always obvious where the lock should go. Too coarse a lock reduces concurrency; too fine a lock may not fully protect.
- **Compiler optimizations can introduce violations**: The compiler might reorder or split operations in unexpected ways, causing atomicity violations even if the C source looks safe.
- **Atomicity is a program invariant, not a hardware property**: The hardware doesn't know what should be atomic; only the programmer does. Locks encode the programmer's intent.

## Sources

- Operating Systems: Three Easy Pieces, Chapter 32 (Zhang), pages 6–7 (MySQL proc_info atomicity violation and fix)
- COP 4600 Week 9_1 Lecture Slides, pages 6–8 (Atomicity-violation bugs, proc_info example, solution with locks)
- Midterm 2 Practice, Question 1 (counter increment as atomicity violation)

