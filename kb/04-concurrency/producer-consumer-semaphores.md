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

- Compare lock+CV producer-consumer with semaphore-based approach.
- Why must empty/full be acquired before mutex?
- Trace the state changes of all semaphores during one produce-consume cycle.
- What would happen if you reversed the order of sem_wait() calls in the producer?
- Design a bounded buffer producer-consumer with multiple producers and consumers using semaphores.

## Gotchas

- **Semaphore ordering critical**: Acquiring mutex before the counting semaphores (empty/full) causes deadlock
- **Initialization values**: empty=MAX, full=0, mutex=1; getting any wrong causes incorrect behavior
- **Single buffer special case**: With MAX=1, there's no point to separate buffers; the pattern still applies
- **Multiple producers/consumers**: All producers compete for mutex; order of wake-up from full/empty is non-deterministic but correct
- **No need for while loops**: Unlike CVs with Mesa semantics, semaphores are atomic; sem_wait() and sem_post() are indivisible

## Sources

- lectures__Week8_1.txt
- zhang__Chapter+31+Semaphores+v2.txt
