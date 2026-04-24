# Prevent Deadlock: Eliminate Hold-and-Wait

## Definition

Preventing hold-and-wait means acquiring all locks atomically at once, before entering the critical section. This ensures that a thread never holds one lock while waiting for another, breaking the hold-and-wait condition. Once all locks are acquired, no thread can force a wait for additional resources.

## When to use

- When you know in advance exactly which locks a thread will need.
- In scenarios where you cannot afford to release and retry locks.
- When you want a simple guarantee that hold-and-wait cannot occur.

## Key ideas

The strategy is to use a global "prevention lock" that gates the acquisition of all other locks. While holding the prevention lock, a thread acquires all the locks it needs. Then it releases the prevention lock and operates on the shared resources. This serializes lock acquisition, eliminating the opportunity for hold-and-wait.

### Prevention Lock Pattern

```c
pthread_mutex_t prevention;        // Global lock guarding lock acquisition
pthread_mutex_t L1, L2;            // Regular locks

void critical_section() {
    // Acquire prevention lock first
    pthread_mutex_lock(&prevention);
    
    // Now acquire all locks atomically (while preventing others from acquiring)
    pthread_mutex_lock(&L1);
    pthread_mutex_lock(&L2);
    
    // Release prevention lock (other threads can now acquire)
    pthread_mutex_unlock(&prevention);
    
    // Enter critical section
    // ... use L1 and L2 safely ...
    
    // Release all locks
    pthread_mutex_unlock(&L2);
    pthread_mutex_unlock(&L1);
}
```

### Why it works

No thread can be in a state of "holding L1 and waiting for L2" because:
1. Acquiring locks is done while holding the prevention lock.
2. No two threads can hold the prevention lock simultaneously.
3. Thus, lock acquisition is serialized: T1 acquires all locks, releases prevention lock, then T2 can acquire prevention lock and all its locks.
4. While a thread waits for L2, it is NOT holding prevention lock, and no other thread can force it to wait (since acquiring happens under prevention lock).

### Two-Vector Problem

Consider two threads calling `vector_add`:
- Thread 1: `vector_add(&v1, &v2)` needs locks for v1 and v2
- Thread 2: `vector_add(&v2, &v1)` needs locks for v2 and v1

Without prevention lock, Thread 1 could lock v1, then wait for v2 while Thread 2 locks v2 and waits for v1 → deadlock.

With prevention lock, thread acquisition is serialized, so no circular wait is possible.

## Pseudocode

```c
pthread_mutex_t prevention = PTHREAD_MUTEX_INITIALIZER;
pthread_mutex_t L1 = PTHREAD_MUTEX_INITIALIZER;
pthread_mutex_t L2 = PTHREAD_MUTEX_INITIALIZER;

void critical_operation() {
    // Atomically acquire all locks
    pthread_mutex_lock(&prevention);
    {
        pthread_mutex_lock(&L1);
        pthread_mutex_lock(&L2);
    }
    pthread_mutex_unlock(&prevention);
    
    // Do work with L1 and L2
    // ...
    
    // Release in reverse order
    pthread_mutex_unlock(&L2);
    pthread_mutex_unlock(&L1);
}
```

## Hand-trace example

Two threads, each needs two locks in different orders:

| Step | Thread T1 | Thread T2 | prevention | L1 | L2 | Notes |
|------|-----------|-----------|------------|----|----|-------|
| 1 | lock(prevention) | - | T1 | Free | Free | T1 acquires prevention |
| 2 | lock(L1) | - | T1 | T1 | Free | T1 gets L1 |
| 3 | lock(L2) | - | T1 | T1 | T1 | T1 gets L2 |
| 4 | unlock(prevention) | - | Free | T1 | T1 | T1 releases prevention |
| 5 | [do work] | lock(prevention) [WAIT] | Free | T1 | T1 | T2 waits for prevention |
| 6 | unlock(L2), unlock(L1) | - | Free | Free | Free | T1 releases all locks |
| 7 | - | lock(prevention) | T2 | Free | Free | T2 acquires prevention |
| 8 | - | lock(L2), lock(L1) | T2 | T2 | T2 | T2 acquires both |
| 9 | - | unlock(prevention) | Free | T2 | T2 | T2 releases prevention |

Result: Lock acquisition is serialized. No deadlock.

## Common exam questions

- **MCQ:** Which Coffman condition is broken by acquiring all required locks atomically under a global prevention lock?
  - [x] Hold-and-wait.
  - [ ] Mutual exclusion.
  - [ ] No preemption.
  - [ ] Circular wait.
  - why: After the atomic acquisition section, a thread either holds every resource it needs or holds none of them. It never holds one lock while waiting for another, which is precisely the hold-and-wait condition.
- **MCQ:** Why does the prevention lock approach work even when threads need the same pair of locks in opposite orders?
  - [x] Lock acquisition is serialized by the prevention lock, so only one thread at a time can be in the middle of acquiring its set.
  - [ ] It uses CAS to eliminate mutual exclusion.
  - [ ] It relies on random backoff.
  - [ ] Threads never actually hold locks; they simulate holding.
  - why: The prevention lock gates entry into the acquisition phase. Only one thread acquires its full set at a time, so no interleaving can produce a cycle. Other threads wait on the prevention lock, not on partially-held resource locks.
- **MCQ:** What is the main performance cost of the prevention-lock approach?
  - [x] It serializes lock acquisition across the whole system, sharply reducing concurrency.
  - [ ] It requires exponential-time cycle detection.
  - [ ] It introduces livelock.
  - [ ] It requires hardware CAS support.
  - why: Because only one thread at a time can acquire any set of locks, threads that would otherwise operate independently must queue on the prevention lock. This creates a global bottleneck.
- **MCQ:** What must a thread know before entering the prevention-lock critical section?
  - [x] The complete set of locks it will need before acquiring any of them.
  - [ ] Nothing — it can acquire locks on demand.
  - [ ] Only the first lock; subsequent locks can be discovered dynamically.
  - [ ] Only the CPU it will run on.
  - why: The entire point of "all at once" acquisition is that no additional locks are grabbed after the prevention lock is released. If the code discovers it needs more locks mid-critical-section, the technique fails.
- **MCQ:** How does the prevention-lock approach compare to address-ordered lock acquisition?
  - [x] Prevention lock requires knowing all locks up front and serializes acquisition; address ordering allows concurrent acquisition as long as the global order is respected.
  - [ ] They are identical.
  - [ ] Address ordering causes livelock; prevention lock causes deadlock.
  - [ ] Prevention lock breaks circular wait; address ordering breaks hold-and-wait.
  - why: Both prevent deadlock, but they break different conditions (hold-and-wait vs. circular wait). Address ordering is typically preferred because it permits concurrent acquisition: two threads needing disjoint locks can proceed in parallel.
- **MCQ:** Which category does the prevention-lock approach fall under?
  - [x] Deadlock prevention (structurally removes the hold-and-wait condition).
  - [ ] Deadlock avoidance (banker-style safe scheduling).
  - [ ] Deadlock detection and recovery.
  - [ ] Livelock mitigation.
  - why: It eliminates one of the four Coffman conditions by construction, which is the definition of prevention. Avoidance would instead permit all four conditions and schedule around unsafe states.

## Gotchas

- **Serializes lock acquisition, reducing concurrency**: Only one thread can acquire locks at a time. Even if threads need different locks, they must take turns. This is a significant performance penalty.
- **Requires knowing all locks in advance**: You must call `lock(prevention)` before any other lock in the critical section, and you must know which locks you need. This breaks modularity.
- **Not suitable for recursive locks**: If thread A holds L1 and tries to acquire L1 again, it will deadlock with itself (unless using a recursive mutex, which has its own issues).
- **Scalability issues**: As the number of locks grows, the bottleneck at the prevention lock becomes worse.

## Sources

- Operating Systems: Three Easy Pieces, Chapter 32 (Zhang), pages 19–21 (Hold-and-wait prevention)
- COP 4600 Week 9_1 Lecture Slides, pages 15–16 (Hold-and-wait prevention strategy)

