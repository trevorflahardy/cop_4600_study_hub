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

- Design a synchronization mechanism for N threads to execute in order.
- Why do you need separate locks and condition variables for each stage?
- Can you use a single lock and two CVs for the three-thread ordering problem? Explain.
- Trace through the execution of print_in_order with threads starting in different orders.
- What happens if the ready flag is not set before signaling?

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
