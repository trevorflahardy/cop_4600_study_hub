# Covering Conditions

## Definition

**Covering conditions** address a scenario in synchronization where multiple different conditions might be true, but the waiting threads check different conditions. When one condition changes (e.g., memory becomes available), you may not know which waiting thread should wake. The solution is to use `pthread_cond_broadcast()` to wake all threads and let them re-evaluate.

## When to use

Use covering conditions when multiple distinct conditions are checked by different threads on the same condition variable. Common in memory allocation, resource pools, and scenarios with heterogeneous wait conditions. Alternatively, use separate condition variables for each condition.

## Key ideas

- **Condition awakening ambiguity**: When a condition changes, you may not know which thread should proceed
- **Broadcast over signal**: Wake all waiting threads; those whose condition is not met will re-wait
- **Correctness vs. efficiency**: Broadcasting is less efficient but safer and simpler
- **Re-checking loop**: All threads must use `while` loops to re-check their specific condition
- **Alternative**: Use multiple condition variables (one per distinct condition) to avoid broadcasting
- **Mesa semantics advantage**: Makes sense to use broadcasting because of Mesa semantics anyway

## Pseudocode

Scenario: Memory allocator where threads request different amounts

```
int bytesLeft = MAX_HEAP_SIZE;
cond_t cond;
mutex_t mutex;

void *allocate(int size) {
    pthread_mutex_lock(&mutex);
    while (bytesLeft < size)
        pthread_cond_wait(&cond, &mutex);
    void *ptr = ...;  // get memory from heap
    bytesLeft -= size;
    pthread_mutex_unlock(&mutex);
    return ptr;
}

void free(void *ptr, int size) {
    pthread_mutex_lock(&mutex);
    bytesLeft += size;
    // Problem: which waiting thread should we wake?
    // Solution: broadcast to all
    pthread_cond_broadcast(&cond);
    pthread_mutex_unlock(&mutex);
}
```

Better: Separate condition variables (optional, but avoids broadcast):

```
typedef struct {
    int bytesLeft;
    cond_t *conds;  // one CV per distinct condition
    int num_conds;
    mutex_t mutex;
} allocator_t;

void *allocate(int size, allocator_t *a) {
    pthread_mutex_lock(&a->mutex);
    // Wait on a specific condition variable or hash based on size
    while (a->bytesLeft < size)
        pthread_cond_wait(&a->conds[size % NUM_CONDS], &a->mutex);
    void *ptr = ...;
    a->bytesLeft -= size;
    pthread_mutex_unlock(&a->mutex);
    return ptr;
}

void free(void *ptr, int size, allocator_t *a) {
    pthread_mutex_lock(&a->mutex);
    a->bytesLeft += size;
    // Signal the specific condition (or all, but more targeted)
    pthread_cond_signal(&a->conds[size % NUM_CONDS]);
    pthread_mutex_unlock(&a->mutex);
}
```

## Hand-trace example

Covering condition scenario with broadcast:

| Step | Thread_A (needs 100B) | Thread_B (needs 50B) | bytesLeft | Notes |
|------|----|----|----|-------|
| 1 | lock | - | 500 | A acquires |
| 2 | allocate(100) | - | 500 | 500 >= 100, allocate |
| 3 | bytesLeft -= 100 | - | 400 | Now 400B left |
| 4 | unlock | lock | 400 | A releases; B acquires |
| 5 | (done with 100B) | allocate(50) | 400 | 400 >= 50, allocate |
| 6 | (processing) | bytesLeft -= 50 | 350 | Now 350B left |
| 7 | (processing) | unlock | 350 | B releases |
| 8 | (processing) | (processing) | 350 | Both using memory |
| 9 | free(100B) | (processing) | 350 | A wants to free |
| 10 | lock | - | 350 | A acquires |
| 11 | bytesLeft += 100 | - | 450 | Memory available |
| 12 | broadcast | - | 450 | Wake ALL waiting threads |
| 13 | unlock | lock (newly runnable) | 450 | A releases; waiting thread(s) woken |

Problem scenario without broadcast (using signal instead):

| Step | Thread_A (needs 100B) | Thread_B (needs 50B) | bytesLeft | Notes |
|------|----|----|----|-------|
| 1-10 | (same setup) | - | 450 | A freed 100B |
| 11 | signal (wrong thread!) | (waiting for 50B) | 450 | Signal wakes B (only 50B freed, A had 100B) |
| 12 | (blocked, needs 100B) | cond_wait (sleeping) | 450 | A waits; B got lucky and doesn't wait |
| 13 | free(50B) more? | (processing with 50B) | 450 | Unless more freed, A stays blocked |

Correct with broadcast:

| Step | Thread_A | Thread_B | bytesLeft | Notes |
|------|----|----|----|-------|
| 1-11 | (same, freed 100B) | (waiting) | 450 | A broadcast |
| 12 | (unblocked by broadcast) | (unblocked by broadcast) | 450 | Both wake, recheck |
| 13 | while(450 < 100)? false | while(450 < 50)? false | 450 | Both conditions satisfied |
| 14 | allocate(100) | allocate(50) | 300 | Both proceed; both get what they need |

## Common exam questions

- Explain the covering condition problem and when it arises.
- Why is broadcasting safer than signaling in covering condition scenarios?
- What is the performance cost of using broadcast?
- When is using separate condition variables preferable to broadcasting?
- Trace a scenario where signaling would fail but broadcasting succeeds.

## Gotchas

- **Broadcast overhead**: All woken threads re-check and possibly re-wait; can cascade wake-ups
- **Not efficient**: Too many spurious wakeups if conditions are diverse
- **Still need while loops**: Broadcasting doesn't eliminate the need for re-checking conditions
- **Multiple allocators**: If there are many allocators, broadcasts can cause widespread wakeups
- **Alternative: Multiple CVs**: Better if you can partition conditions cleanly (e.g., size ranges)

## Sources

- lectures__Week7_2.txt
- zhang__Chapter+30+Condition+Variables+v2.txt
