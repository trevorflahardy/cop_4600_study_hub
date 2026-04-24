# Semaphores

## Definition

A **semaphore** is a synchronization primitive consisting of an integer value and two operations: `sem_wait()` (decrement and wait if negative) and `sem_post()` (increment and wake a waiting thread). Semaphores generalize locks and condition variables, supporting both mutual exclusion and signaling.

## When to use

Use semaphores for both locks and signaling in a unified interface. Binary semaphores (initialized to 1) act as locks; counting semaphores (initialized to N) control access to N identical resources. Semaphores are simpler than lock+CV pairs for simple synchronization patterns.

## Key ideas

- **Integer value**: Tracks available resources or permit count
- **sem_wait()**: Decrement value; if negative, thread sleeps (value tracks waiters as negative count)
- **sem_post()**: Increment value; if there are waiters (value was negative), wake one
- **Binary semaphore**: Initialized to 1; only 0 and 1 values (like a mutex)
- **Counting semaphore**: Initialized to N; tracks N resources
- **Atomic operations**: Both wait and post are atomic
- **Signaling vs. mutual exclusion**: Same abstraction works for both use cases

## Pseudocode

Binary semaphore (lock):
```
sem_t mutex;
sem_init(&mutex, 0, 1);  // binary: initialized to 1

sem_wait(&mutex);        // acquire lock (decrement to 0)
// critical section
sem_post(&mutex);        // release lock (increment back to 1)
```

Counting semaphore (resource pool):
```
sem_t empty, full;
sem_init(&empty, 0, MAX);  // MAX empty buffers
sem_init(&full, 0, 0);     // 0 full buffers

// Producer:
sem_wait(&empty);          // claim an empty buffer
put(item);
sem_post(&full);           // signal a full buffer

// Consumer:
sem_wait(&full);           // wait for full buffer
item = get();
sem_post(&empty);          // release the buffer slot
```

Parent waiting for child (signaling):
```
sem_t s;
sem_init(&s, 0, 0);  // initialized to 0 (not signaled yet)

// Child:
printf("child\n");
sem_post(&s);        // signal parent

// Parent:
printf("parent: begin\n");
sem_wait(&s);        // wait for child to signal
printf("parent: end\n");
```

## Hand-trace example

Binary semaphore (2 threads):

| Step | T1 | T2 | sem value | Notes |
|------|----|----|-----------|-------|
| 1 | sem_wait() | - | 1 | T1: decrement, value=0, return |
| 2 | (crit sect) | sem_wait() | 0 | T1 in critical section |
| 3 | (crit sect) | (blocked, value=-1) | -1 | T2: decrement, value=-1, sleep |
| 4 | sem_post() | (sleeping) | -1 | T1: increment, value=0, wake T2 |
| 5 | (done) | (woken, return) | 0 | T2 returns from wait and proceeds |
| 6 | - | (crit sect) | 0 | T2 in critical section |
| 7 | - | sem_post() | 1 | T2: increment, value=1, no waiters |

Parent-child synchronization (parent waits for child):

Case 1: Parent calls sem_wait() before child posts

| Step | Parent | Child | sem value | Notes |
|------|--------|-------|-----------|-------|
| 1 | sem_wait() | - | 0 | Parent: decrement, value=-1, sleep |
| 2 | (sleeping) | sem_post() | -1 | Child: increment, value=0, wake parent |
| 3 | (woken) | (done) | 0 | Parent wakes and continues |

Case 2: Child posts before parent calls sem_wait()

| Step | Parent | Child | sem value | Notes |
|------|--------|-------|-----------|-------|
| 1 | - | sem_post() | 0 | Child: increment, value=1 |
| 2 | (later) | (done) | 1 | Child done, no waiters |
| 3 | sem_wait() | - | 1 | Parent: decrement, value=0, return immediately |
| 4 | (continue) | - | 0 | No waiting; parent proceeds |

Counting semaphore (producer-consumer, MAX=2):

| Step | Producer | Consumer | empty | full | buffer | Notes |
|------|----------|----------|-------|------|--------|-------|
| 1 | sem_wait(&empty) | - | 2 | 0 | empty | P: decrement empty, value=1 |
| 2 | put(1) | - | 1 | 0 | 1 | Data in buffer |
| 3 | sem_post(&full) | - | 1 | 1 | 1 | P: increment full, value=1 |
| 4 | sem_wait(&empty) | - | 1 | 1 | 1 | P: decrement empty, value=0 |
| 5 | put(2) | - | 0 | 1 | 2 | Second data in buffer |
| 6 | sem_post(&full) | - | 0 | 2 | 2 | P: increment full, value=2 |
| 7 | sem_wait(&empty) | - | 0 | 2 | 2 | P: decrement empty, value=-1, sleep |
| 8 | (blocked) | sem_wait(&full) | 0 | 2 | 2 | C: decrement full, value=1 |
| 9 | (blocked) | get() | 0 | 1 | 1 | C consumed item 1 |
| 10 | (blocked) | sem_post(&empty) | 1 | 1 | 1 | C: increment empty, wake P |
| 11 | (woken) | - | 1 | 1 | 1 | P wakes, ready to produce |

## Common exam questions

- **MCQ:** To use a semaphore as a mutex (lock), what is the correct initial value?
  - [x] 1
  - [ ] 0
  - [ ] MAX
  - [ ] -1
  - why: A binary semaphore starts at 1 so the first `sem_wait` succeeds (decrement to 0) and subsequent waiters block.

- **MCQ:** To use a semaphore as a one-shot signal from child to parent (parent waits until child posts), what is the correct initial value?
  - [x] 0
  - [ ] 1
  - [ ] MAX
  - [ ] The number of threads
  - why: Starting at 0 means the parent's `sem_wait` blocks until the child's `sem_post` increments it to 1.

- **MCQ:** To use a semaphore for "N available resources," what is the correct initial value?
  - [x] N
  - [ ] 0
  - [ ] 1
  - [ ] 2N
  - why: A counting semaphore initialized to N allows N simultaneous successful waits before further waiters block.

- **MCQ:** Under the classic interpretation, what does a negative semaphore value represent?
  - [x] The magnitude equals the number of threads currently blocked on sem_wait
  - [ ] An invalid state that must be clamped to 0
  - [ ] The number of pending sem_post calls
  - [ ] The index of the next thread to wake
  - why: Each blocked thread drives the counter further negative; posting increments and wakes a waiter.

- **MCQ:** Which of the following is NOT true of semaphores (compared to condition variables)?
  - [x] Consumers must re-check a predicate after sem_wait returns
  - [ ] sem_wait and sem_post are atomic
  - [ ] No explicit mutex is required for basic counting
  - [ ] Initial value encodes available resources
  - why: Unlike CV wait (Mesa semantics forces a while-loop), sem_wait returns only after successfully decrementing, so no predicate re-check is needed.

- **MCQ:** A thread calls `sem_wait(&s)` with s == 0. What occurs?
  - [x] The value becomes negative (or the thread is enqueued) and the thread sleeps until a sem_post
  - [ ] sem_wait spins until another thread posts
  - [ ] sem_wait returns an error
  - [ ] sem_wait yields the CPU once and then returns
  - why: With no resources, sem_wait blocks the caller; sem_post later increments the value (or wakes directly) allowing the waiter to proceed.

- **MCQ:** Which statement about semaphore deadlock is accurate?
  - [x] Acquiring semaphores in inconsistent orders (e.g., mutex before empty in producer) can still deadlock
  - [ ] Semaphores are deadlock-free by construction
  - [ ] Deadlock only occurs with binary semaphores
  - [ ] Deadlock is impossible when initial values are correct
  - why: Semaphores don't magically avoid deadlock; ordering matters just as with locks, as in the broken producer that waits on empty while holding mutex.

## Gotchas

- **Initialization critical**: Binary semaphore should be 1; counting should be N; signaling should be 0
- **No spurious wakeups**: Unlike CVs, semaphores guarantee wake-up when value changes from negative to non-negative
- **No recheck needed**: Unlike CVs, you don't need to re-check conditions after sem_wait()
- **Value semantics**: When value is negative, its magnitude equals the number of waiting threads (not always true in all implementations; Zemaphore violates this)
- **Deadlock potential**: Improper semaphore ordering can still cause deadlock (e.g., waiting on empty before releasing mutex in P/C)

## Sources

- lectures__Week8_1.txt
- zhang__Chapter+31+Semaphores+v2.txt
