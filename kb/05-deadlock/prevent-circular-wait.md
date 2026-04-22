# Prevent Deadlock: Eliminate Circular Wait

## Definition

Circular wait prevention enforces a strict, global ordering on all locks so that threads always acquire locks in the same order. If every thread acquires locks L1 before L2 before L3, a circular wait cannot form because no thread can ever hold L3 and wait for L1. This is the most practical deadlock prevention technique.

## When to use

- In any multi-lock system where you can assign a consistent priority or order to locks.
- Most real-world deadlock prevention scenarios; preferred over the other three conditions.
- When designing concurrent data structures (e.g., two-vector operations, tree operations with parent/child locks).

## Key ideas

The strategy is simple: assign a unique priority (or address) to each lock, and ensure that all threads acquire locks in increasing order of priority. If lock_A < lock_B < lock_C (by address or assigned priority), then every thread acquires in that order.

### Lock Ordering by Address

The most common implementation uses the memory address of the lock as the ordering criterion:

```c
if (L1 > L2) {
    pthread_mutex_lock(L1);
    pthread_mutex_lock(L2);
} else {
    pthread_mutex_lock(L2);
    pthread_mutex_lock(L1);
}
```

If `L1_address > L2_address`, acquire L1 first. Otherwise, acquire L2 first. This ensures a consistent ordering.

### Why it prevents deadlock

Assume a circular wait cycle: T1 holds L_a and waits for L_b; T2 holds L_b and waits for L_a.

With ordered acquisition:
- For T1 to hold L_a and wait for L_b, we must have L_a < L_b (acquired L_a first).
- For T2 to hold L_b and wait for L_a, we must have L_b < L_a (acquired L_b first).
- But L_a < L_b and L_b < L_a is a contradiction.
- Therefore, a circular wait is impossible.

### Vector Addition Problem (from Midterm 2 Practice)

**Naive (deadlock-prone) code:**

```c
void vector_add(vector *v1, vector *v2) {
    pthread_mutex_lock(&v1->lock);  // Lock v1 first, always
    pthread_mutex_lock(&v2->lock);  // Then lock v2
    for (int i = 0; i < v1->size; i++) {
        v1->data[i] = v1->data[i] + v2->data[i];
    }
    pthread_mutex_unlock(&v2->lock);
    pthread_mutex_unlock(&v1->lock);
}
```

Two threads call:
- Thread 1: `vector_add(&vectorA, &vectorB)` locks A, then tries to lock B
- Thread 2: `vector_add(&vectorB, &vectorA)` locks B, then tries to lock A
- **Result: Deadlock** (T1 holds A, waits for B; T2 holds B, waits for A)

**Fixed code using address ordering:**

```c
void vector_add(vector *v1, vector *v2) {
    // Always acquire locks in address order
    if ((uintptr_t)&v1->lock > (uintptr_t)&v2->lock) {
        pthread_mutex_lock(&v1->lock);
        pthread_mutex_lock(&v2->lock);
    } else {
        pthread_mutex_lock(&v2->lock);
        pthread_mutex_lock(&v1->lock);
    }
    
    for (int i = 0; i < v1->size; i++) {
        v1->data[i] = v1->data[i] + v2->data[i];
    }
    
    // Unlock in reverse order
    if ((uintptr_t)&v1->lock > (uintptr_t)&v2->lock) {
        pthread_mutex_unlock(&v2->lock);
        pthread_mutex_unlock(&v1->lock);
    } else {
        pthread_mutex_unlock(&v1->lock);
        pthread_mutex_unlock(&v2->lock);
    }
}
```

Now, regardless of which thread runs, locks are acquired in the same global order. No circular wait is possible.

## Pseudocode

Generic pattern for two locks:

```c
void acquire_locks_ordered(pthread_mutex_t *L1, pthread_mutex_t *L2) {
    // Compare addresses
    if (L1 > L2) {
        pthread_mutex_lock(L1);
        pthread_mutex_lock(L2);
    } else {
        pthread_mutex_lock(L2);
        pthread_mutex_lock(L1);
    }
}

void release_locks_ordered(pthread_mutex_t *L1, pthread_mutex_t *L2) {
    // Release in reverse order of acquisition
    if (L1 > L2) {
        pthread_mutex_unlock(L2);
        pthread_mutex_unlock(L1);
    } else {
        pthread_mutex_unlock(L1);
        pthread_mutex_unlock(L2);
    }
}
```

## Hand-trace example (vector_add with address ordering)

Assume `&vectorA->lock < &vectorB->lock` (A has lower address than B):

| Step | Thread T1 | Thread T2 | Lock at A | Lock at B | Notes |
|------|-----------|-----------|-----------|-----------|-------|
| 1 | T1: A < B, lock(A) | - | T1 | Free | T1 locks A |
| 2 | - | T2: B > A, lock(B) | T1 | T2 | T2 locks B |
| 3 | T1: lock(B) [WAIT] | - | T1 | T2 | T1 waits for B |
| 4 | - | T2: lock(A) [WAIT] | T1 | T2 | T2 waits for A |

Wait—this still looks like deadlock! But the key is that if we trace through to completion:

Let me retrace assuming the if-condition is checked correctly:

| Step | Thread T1 | Thread T2 | Lock at A | Lock at B | Notes |
|------|-----------|-----------|-----------|-----------|-------|
| 1 | vector_add(A, B): A<B | - | - | - | A < B comparison |
| 2 | lock(A) | - | T1 | Free | T1 holds A |
| 3 | lock(B) | - | T1 | T1 | T1 holds both |
| 4 | - | vector_add(B, A): B>A | T1 | T1 | B > A means lock A first |
| 5 | unlock(B), unlock(A) | - | Free | Free | T1 finishes |
| 6 | - | lock(A) | T2 | Free | T2 locks A |
| 7 | - | lock(B) | T2 | T2 | T2 locks B |
| 8 | - | unlock(B), unlock(A) | Free | Free | T2 finishes |

**Result: No deadlock.** Thread T2 has to wait for T1 to finish, but both eventually make progress.

## Common exam questions

- Given two locks L1 and L2, show how to order them by address to prevent circular wait.
- For the vector_add problem, identify the deadlock scenario and then show how address ordering fixes it.
- Can a thread acquire locks out of order if it always acquires all locks? (Answer: No, if all threads follow the same order.)
- What is the difference between "lock ordering" and "lock ordering by address"?
- How does lock ordering by address scale to N locks?

## Gotchas

- **Requires careful implementation in complex systems**: In large codebases, ensuring all threads follow the same lock order is difficult. Violating the order even once can cause deadlock.
- **Not always possible to assign a global order**: In some systems (e.g., graph algorithms with dynamically determined lock dependencies), a static global order may not exist.
- **Type casting overhead**: Converting pointers to `uintptr_t` for address comparison adds small overhead.
- **Doesn't address fairness**: Even though there is no deadlock, threads may starve if higher-priority locks are frequently held.
- **Design constraint**: You must know (or be able to infer) all locks needed before acquiring the first one. This can complicate abstraction layers.

## Sources

- Operating Systems: Three Easy Pieces, Chapter 32 (Zhang), pages 17–20 (Circular wait prevention, lock ordering by address)
- COP 4600 Week 9_1 Lecture Slides, pages 12–16 (Four conditions, prevention via circular wait, Java Vector.AddAll example)
- Midterm 2 Practice / Solution, Question 6 (vector_add deadlock and fix via address ordering)

