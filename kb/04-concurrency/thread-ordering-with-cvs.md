# Thread Ordering with Condition Variables

## Definition

**Thread ordering** (or thread sequencing) is the synchronization problem where multiple threads must execute in a specific predetermined order. Condition variables enable one thread to signal completion and allow the next thread to proceed, creating a chain of ordered execution.

## When to use

Use thread ordering when a sequence of tasks must complete in a specific order, such as printing "first", "second", "third" from three different threads, or when processing pipelines require sequential stages. This pattern is common in task dependency management.

## Key ideas

- **Signaling chain**: Each thread signals the next one in sequence
- **State flags**: Track which threads have completed their tasks
- **One CV per thread**: Simplest approach is to have each thread wait on its own CV
- **Atomicity with locks**: State changes and signals must be atomic with respect to lock
- **No passing threads**: Only one thread should be awake at any time (in the simplest version)
- **Reusability**: The pattern generalizes to N threads, not just 3

## Pseudocode

Three-thread ordering (print "first", then "second", then "third"):

```
#include <stdio.h>
#include <assert.h>
#include <pthread.h>

int ready1 = 0, ready2 = 0;
pthread_mutex_t lock1, lock2;
pthread_cond_t cond1, cond2;

void printFirst() { printf("first\n"); }
void printSecond() { printf("second\n"); }
void printThird() { printf("third\n"); }

void first() {
    printFirst();
    pthread_mutex_lock(&lock1);
    ready1 = 1;
    pthread_cond_signal(&cond1);
    pthread_mutex_unlock(&lock1);
}

void second() {
    pthread_mutex_lock(&lock1);
    while (ready1 == 0)
        pthread_cond_wait(&cond1, &lock1);
    pthread_mutex_unlock(&lock1);
    
    printSecond();
    
    pthread_mutex_lock(&lock2);
    ready2 = 1;
    pthread_cond_signal(&cond2);
    pthread_mutex_unlock(&lock2);
}

void third() {
    pthread_mutex_lock(&lock2);
    while (ready2 == 0)
        pthread_cond_wait(&cond2, &lock2);
    pthread_mutex_unlock(&lock2);
    
    printThird();
}
```

## Hand-trace example

Execution with thread ordering (3 threads, random start order):

| Step | T_first | T_second | T_third | ready1 | ready2 | Notes |
|------|---------|----------|---------|--------|--------|-------|
| 1 | printFirst() | - | - | 0 | 0 | T_first prints "first" |
| 2 | lock(&lock1) | - | - | 0 | 0 | T_first acquires lock1 |
| 3 | ready1 = 1 | - | - | 1 | 0 | Set flag |
| 4 | signal(&cond1) | - | - | 1 | 0 | Wake T_second |
| 5 | unlock(&lock1) | (woken, runnable) | - | 1 | 0 | T_first releases |
| 6 | (done) | lock(&lock1) | - | 1 | 0 | T_second acquires |
| 7 | (done) | while(ready1==0)? false | - | 1 | 0 | Condition satisfied |
| 8 | (done) | unlock(&lock1) | lock(&lock2) blocked | 1 | 0 | T_second releases; T_third tries lock2 |
| 9 | (done) | printSecond() | (blocked) | 1 | 0 | T_second prints "second" |
| 10 | (done) | lock(&lock2) | (blocked) | 1 | 0 | T_second acquires lock2 |
| 11 | (done) | ready2 = 1 | (blocked) | 1 | 1 | T_second sets flag |
| 12 | (done) | signal(&cond2) | (woken) | 1 | 1 | T_second signals T_third |
| 13 | (done) | unlock(&lock2) | (acquire lock2) | 1 | 1 | T_second releases |
| 14 | (done) | (done) | while(ready2==0)? false | 1 | 1 | T_third condition satisfied |
| 15 | (done) | (done) | unlock(&lock2) | 1 | 1 | T_third releases |
| 16 | (done) | (done) | printThird() | 1 | 1 | T_third prints "third" |

## Inline C Code Example

From print_in_order.c:

```
typedef struct {
    int ready1, ready2;
    pthread_mutex_t lock1, lock2;
    pthread_cond_t cond1, cond2;
} Foo;

Foo* fooCreate() {
    Foo* obj = (Foo*) malloc(sizeof(Foo));
    obj->ready1 = 0;
    obj->ready2 = 0;
    pthread_mutex_init(&obj->lock1, NULL);
    pthread_mutex_init(&obj->lock2, NULL);
    pthread_cond_init(&obj->cond1, NULL);
    pthread_cond_init(&obj->cond2, NULL);
    return obj;
}

void first(Foo* obj) {
    printFirst();
    pthread_mutex_lock(&obj->lock1);
    obj->ready1 = 1;
    pthread_cond_signal(&obj->cond1);
    pthread_mutex_unlock(&obj->lock1);
}

void second(Foo* obj) {
    pthread_mutex_lock(&obj->lock1);
    while(obj->ready1 == 0)
        pthread_cond_wait(&obj->cond1, &obj->lock1);
    pthread_mutex_unlock(&obj->lock1);
    
    printSecond();
    
    pthread_mutex_lock(&obj->lock2);
    obj->ready2 = 1;
    pthread_cond_signal(&obj->cond2);
    pthread_mutex_unlock(&obj->lock2);
}

void third(Foo* obj) {
    pthread_mutex_lock(&obj->lock2);
    while(obj->ready2 == 0)
        pthread_cond_wait(&obj->cond2, &obj->lock2);
    pthread_mutex_unlock(&obj->lock2);
    
    printThird();
}

void fooFree(Foo* obj) {
    // cleanup if needed
}
```

## Common exam questions

- **MCQ:** In the "print first, second, third" problem with CVs, why is a ready flag required alongside signaling?
  - [x] It handles the case where the signaler runs before the waiter has blocked (no lost wakeup) and supports re-checks on wake
  - [ ] pthread forbids calling signal without a flag set
  - [ ] The flag tells the CV which thread to wake
  - [ ] Without it, broadcast would be mandatory
  - why: If `second()` calls cond_wait before `first()` signals, great; but if `first()` runs first, the flag ensures `second()` does not block waiting for a signal that already happened.

- **MCQ:** Why does `second()` use `while (ready1 == 0)` rather than `if`?
  - [x] Spurious wakeups and Mesa semantics require re-checking the predicate
  - [ ] pthread_cond_wait is a no-op when `if` is used
  - [ ] `while` spins until ready1 flips, avoiding the kernel
  - [ ] `if` would cause first() to be called twice
  - why: As with every CV wait, the wait must be inside a loop so the thread re-checks the predicate after being woken.

- **MCQ:** Can the three-thread ordering be solved with a single lock and two CVs?
  - [x] Yes — one lock guarding both `ready1` and `ready2` works, since the three threads never need the lock simultaneously for long
  - [ ] No — each stage strictly requires its own lock
  - [ ] Only if Hoare semantics are used
  - [ ] Only if `second` and `third` are the same thread
  - why: Using one mutex is sufficient because the critical sections are short; two locks just limit contention slightly and keep the stages independent.

- **MCQ:** What happens if `first()` calls `pthread_cond_signal(&cond1)` WITHOUT first setting `ready1 = 1`?
  - [x] If `second()` has not yet waited, the signal is lost; if it has waited, it wakes and spins because the predicate is still false
  - [ ] It is equivalent because Mesa semantics ensure correctness
  - [ ] pthread_cond_signal will return EINVAL
  - [ ] `second()` will proceed anyway since it was signaled
  - why: CV signals have no memory; without the flag, a signal that arrives before the wait is dropped, and even if the wait is already pending, the woken thread will re-check the still-false predicate.

- **MCQ:** To generalize the pattern to N threads executing in order, how many (ready flag, CV) pairs do you need?
  - [x] N - 1 pairs, one between each consecutive pair of stages
  - [ ] N pairs, one per thread
  - [ ] 1 pair regardless of N
  - [ ] 2 pairs regardless of N
  - why: Each "finished-stage-k to start-stage-k+1" handoff needs its own ready flag and CV; there are N-1 such handoffs.

- **MCQ:** Why is the ready flag still needed even though the mutex is held during signal?
  - [x] The mutex only guards the signal call; it does not prevent the waiter from arriving AFTER the signal was issued
  - [ ] The mutex cannot protect booleans
  - [ ] pthread requires an explicit condition variable state
  - [ ] The compiler may reorder signals past waits
  - why: Signals are ephemeral — they wake whoever is already waiting. The flag persists in memory and is what a late-arriving waiter reads to skip blocking.

## Gotchas

- **Unnecessary state variable**: It's tempting to omit the ready flags and just signal; don't—you need them for correctness
- **Lock acquisition order**: If threads acquire multiple locks, ensure a consistent order to avoid deadlock
- **Generalization to N threads**: N-1 state variables and condition variables needed for full ordering
- **Spurious wake-ups**: Even with flags, use `while` loops to be safe
- **Lock contention**: Multiple threads contending for the same lock can reduce parallelism further

## Sources

- print_in_order.c (full implementation)
- lectures__Week6_2.txt
- lectures__Week7_2.txt
