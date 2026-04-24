# Producer-Consumer with Semaphores

## Definition

The **producer-consumer problem with semaphores** is a classic synchronization pattern where one or more producers place items into a bounded buffer and one or more consumers remove items, all coordinated using semaphores for both mutual exclusion and resource availability signaling.

## When to use

Use semaphore-based producer-consumer when you want to avoid the complexity of separate locks and condition variables. Semaphores unify mutual exclusion and signaling, making the code more compact and less error-prone than the lock+CV approach.

## Key ideas

- **Two semaphores**: `empty` (initially MAX) and `full` (initially 0) track buffer state
- **One semaphore**: `mutex` (initially 1) provides mutual exclusion
- **Correct ordering**: Acquire non-blocking semaphores (empty/full) before acquiring mutex to avoid deadlock
- **No spurious wakeups**: Unlike CVs, semaphores don't require recheck loops; sem_wait blocks atomically
- **Simplicity**: Fewer moving parts than lock+CV; fewer ways to make mistakes

## Pseudocode

Bounded buffer with multiple producers and consumers:
```
sem_t empty;    // initialized to MAX
sem_t full;     // initialized to 0
sem_t mutex;    // initialized to 1

int buffer[MAX];
int fill = 0;
int use = 0;

void put(int value) {
    buffer[fill] = value;
    fill = (fill + 1) % MAX;
}

int get() {
    int tmp = buffer[use];
    use = (use + 1) % MAX;
    return tmp;
}

void *producer(void *arg) {
    int i;
    for (i = 0; i < loops; i++) {
        sem_wait(&empty);      // line p1: wait for empty slot
        sem_wait(&mutex);      // line p1.5: acquire mutex
        put(i);                // line p2: fill buffer
        sem_post(&mutex);      // line p2.5: release mutex
        sem_post(&full);       // line p3: signal data ready
    }
}

void *consumer(void *arg) {
    int i;
    while (1) {
        sem_wait(&full);       // line c1: wait for data
        sem_wait(&mutex);      // line c1.5: acquire mutex
        int tmp = get();       // line c2: get data
        sem_post(&mutex);      // line c2.5: release mutex
        sem_post(&empty);      // line c3: signal slot available
        printf("%d\n", tmp);
    }
}

int main(int argc, char *argv[]) {
    sem_init(&empty, 0, MAX);
    sem_init(&full, 0, 0);
    sem_init(&mutex, 0, 1);
    // ... create threads ...
}
```

Broken approach (incorrect semaphore ordering):
```
// WRONG: Can cause deadlock
void *producer_broken(void *arg) {
    for (i = 0; i < loops; i++) {
        sem_wait(&mutex);      // acquire mutex FIRST
        sem_wait(&empty);      // then wait for empty (deadlock!)
        put(i);
        sem_post(&full);
        sem_post(&mutex);
    }
}
```

If the producer acquires mutex and then waits on empty (buffer is full), the consumer can never run to make room because the mutex is held.

## Hand-trace example

Correct producer-consumer (1 producer, 1 consumer, MAX=1):

| Step | Producer | Consumer | empty | full | mutex | buffer | Notes |
|------|----------|----------|-------|------|-------|--------|-------|
| 1 | sem_wait(&empty) | - | 1 | 0 | 1 | empty | P: decrement empty=0 |
| 2 | sem_wait(&mutex) | - | 0 | 0 | 1 | empty | P: decrement mutex=0 (acquired) |
| 3 | put(0) | - | 0 | 0 | 0 | 0 | P: fill buffer |
| 4 | sem_post(&mutex) | - | 0 | 0 | 1 | 0 | P: release mutex |
| 5 | sem_post(&full) | - | 0 | 1 | 1 | 0 | P: increment full=1 |
| 6 | (wait for empty) | sem_wait(&full) | 0 | 1 | 1 | 0 | C: decrement full=0 |
| 7 | (blocked) | sem_wait(&mutex) | 0 | 0 | 1 | 0 | C: decrement mutex=0 |
| 8 | (blocked) | get() | 0 | 0 | 0 | 0 | C: consume data |
| 9 | (blocked) | sem_post(&mutex) | 0 | 0 | 1 | 0 | C: release mutex |
| 10 | (blocked) | sem_post(&empty) | 1 | 0 | 1 | 0 | C: increment empty=1, wake P |
| 11 | sem_wait(&mutex) | - | 1 | 0 | 1 | 0 | P: decrement mutex=0 (acquired) |
| 12 | put(1) | - | 1 | 0 | 0 | 1 | P: fill buffer |
| 13 | sem_post(&mutex) | - | 1 | 0 | 1 | 1 | P: release mutex |
| 14 | sem_post(&full) | - | 1 | 1 | 1 | 1 | P: increment full=1, wake C |

Deadlock scenario (broken ordering):

| Step | Producer | Consumer | empty | full | mutex | Notes |
|------|----------|----------|-------|------|-------|-------|
| 1 | sem_wait(&mutex) | - | 1 | 0 | 1 | P: acquire mutex |
| 2 | sem_wait(&empty) | - | 1 | 0 | 0 | P: try to wait for empty |
| 3 | (blocking on empty, mutex held) | sem_wait(&full) | 0 | 0 | 0 | C: wait for full (blocked) |
| 4 | (blocked on empty, mutex=0) | (blocked waiting for full) | 0 | 0 | 0 | DEADLOCK! P holds mutex but waits on empty; C blocked on full |

## Common exam questions

- **MCQ:** What are the correct initial values for `empty`, `full`, and `mutex` in the bounded-buffer solution?
  - [x] empty = MAX, full = 0, mutex = 1
  - [ ] empty = 0, full = MAX, mutex = 1
  - [ ] empty = MAX, full = MAX, mutex = 0
  - [ ] empty = 1, full = 1, mutex = MAX
  - why: Initially there are MAX empty slots, 0 full slots, and mutex is a binary semaphore for mutual exclusion, so starts at 1.

- **MCQ:** Why must a producer call `sem_wait(&empty)` before `sem_wait(&mutex)`?
  - [x] Reversing the order can deadlock: producer blocks on empty while holding mutex, and the consumer needs mutex to release a slot
  - [ ] `empty` must be acquired on the same CPU as `mutex`
  - [ ] POSIX requires counting semaphores to be acquired before binary semaphores
  - [ ] mutex does not protect critical state, so its order is irrelevant
  - why: If the producer holds mutex and then blocks on empty (buffer full), the consumer can never acquire mutex to make room — classic deadlock.

- **MCQ:** What does `sem_post(&full)` signify after a producer's put()?
  - [x] One more full slot is available; wake any consumer waiting on `full`
  - [ ] The buffer is entirely full and must be flushed
  - [ ] The producer is releasing the mutex
  - [ ] The producer is done and will exit
  - why: `full` counts filled slots; posting increments it and potentially wakes a consumer blocked in `sem_wait(&full)`.

- **MCQ:** Why don't consumers need `while` loops around `sem_wait(&full)` the way they do with CVs?
  - [x] sem_wait is atomic: it decrements and blocks as one step, so there is no re-check hazard
  - [ ] Semaphores are implemented without Mesa semantics, so wakeups never happen
  - [ ] The OS guarantees consumers always wake in FIFO order
  - [ ] Semaphore wakeups are not allowed to be spurious in any implementation
  - why: sem_wait/sem_post are indivisible, so unlike CV wait (which needs a predicate re-check), semaphores return only when the count has been successfully decremented.

- **MCQ:** With multiple producers and multiple consumers, what role does `mutex` play?
  - [x] It protects `fill` and `use` index updates inside put() and get()
  - [ ] It prevents more than one producer from running at any time
  - [ ] It replaces `empty` and `full` under high contention
  - [ ] It ensures FIFO ordering of enqueued items
  - why: Multiple producers (or multiple consumers) could race on the index variables; the mutex serializes buffer bookkeeping, but empty/full still gate slot availability.

- **MCQ:** If you forgot `sem_post(&empty)` in the consumer, what happens?
  - [x] Producers eventually block forever because empty never counts up
  - [ ] Consumers will not wake after their first consume
  - [ ] The mutex will leak
  - [ ] full overflows and becomes negative
  - why: Without posting `empty`, the pool of "available slots" never replenishes; once empty hits 0, every subsequent producer blocks permanently.

- **MCQ:** Why is the semaphore-based solution simpler than the CV-based two-CV solution?
  - [x] sem_wait atomically blocks on a count, removing the need for predicate loops and explicit state variables
  - [ ] It uses fewer atomic instructions per operation
  - [ ] It avoids any kernel involvement
  - [ ] It requires only one producer and one consumer
  - why: Semaphores fold "check predicate + wait" into a single atomic operation, so producer/consumer code has fewer moving parts than the mutex + two CVs pattern.

## Gotchas

- **Semaphore ordering critical**: Acquiring mutex before the counting semaphores (empty/full) causes deadlock
- **Initialization values**: empty=MAX, full=0, mutex=1; getting any wrong causes incorrect behavior
- **Single buffer special case**: With MAX=1, there's no point to separate buffers; the pattern still applies
- **Multiple producers/consumers**: All producers compete for mutex; order of wake-up from full/empty is non-deterministic but correct
- **No need for while loops**: Unlike CVs with Mesa semantics, semaphores are atomic; sem_wait() and sem_post() are indivisible

## Sources

- lectures__Week8_1.txt
- zhang__Chapter+31+Semaphores+v2.txt
