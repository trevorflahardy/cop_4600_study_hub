# TAS, CAS, and LL/SC Primitives

## Definition

**Test-And-Set (TAS)**, **Compare-And-Swap (CAS)**, and **Load-Linked/Store-Conditional (LL/SC)** are atomic hardware instructions that enable lock implementation. Each returns a value that indicates success or failure, allowing threads to implement busy-wait (spin-lock) behavior.

## When to use

These primitives form the foundation of low-level lock implementations. Hardware support is essential for synchronization on multi-CPU systems. Use TAS or CAS for spin locks; use LL/SC for architectures that support it (ARM, MIPS, PowerPC).

## Key ideas

- **Atomicity**: Read and write occur as a single indivisible operation; no interleaving is possible
- **Return value**: All three primitives return the OLD value, enabling lock state checks
- **Hardware barrier**: These instructions prevent the compiler and CPU from reordering memory operations
- **Test-and-set**: Simplest primitive; returns old flag value and sets it to 1
- **Compare-and-swap**: More powerful; only updates if value matches expected
- **Load-Linked/Store-Conditional**: Detects conflicts between LL and SC; SC succeeds only if no other thread stored to that address

## Pseudocode

**Test-And-Set (TAS):**
```
int TestAndSet(int *ptr, int new) {
    int old = *ptr;     // fetch old value at ptr
    *ptr = new;         // store 'new' into ptr
    return old;         // return the old value
}
```

**Compare-And-Swap (CAS):**
```
int CompareAndSwap(int *ptr, int expected, int new) {
    int actual = *ptr;
    if (actual == expected)
        *ptr = new;
    return actual;      // return the actual value at ptr
}
```

**Load-Linked and Store-Conditional:**
```
int LoadLinked(int *ptr) {
    return *ptr;        // return value and mark address as "linked"
}

int StoreConditional(int *ptr, int value) {
    if (no other thread has stored to *ptr since LL) {
        *ptr = value;
        return 1;       // success
    } else {
        return 0;       // failed; value unchanged
    }
}
```

## Hand-trace example

Using TAS to implement a spin lock:

```
typedef struct {
    int flag;
} lock_t;

void lock(lock_t *lock) {
    while (TestAndSet(&lock->flag, 1) == 1)
        ;   // spin if old value was 1 (locked)
}

void unlock(lock_t *lock) {
    lock->flag = 0;
}
```

Execution trace (flag starts at 0):

| Step | Thread 1 | Thread 2 | flag | Notes |
|------|----------|----------|------|-------|
| 1 | TestAndSet(flag, 1) | - | 0 | T1: read old=0, set to 1, return 0 |
| 2 | loop condition (0==1?) | - | 1 | T1: false, exit loop (acquired lock) |
| 3 | (critical section) | TestAndSet(flag, 1) | 1 | T2: read old=1, set to 1, return 1 |
| 4 | (critical section) | loop condition (1==1?) | 1 | T2: true, spin |
| 5 | (critical section) | (spinning) | 1 | T2 still spinning |
| 6 | flag = 0 | (spinning) | 0 | T1 releases lock |
| 7 | - | TestAndSet(flag, 1) | 0 | T2: read old=0, set to 1, return 0 |
| 8 | - | loop condition (0==1?) | 1 | T2: false, acquired lock |

Using LL/SC with concise form:
```
void lock(lock_t *lock) {
    while (LoadLinked(&lock->flag) || !StoreConditional(&lock->flag, 1))
        ;   // spin if flag is 1 OR if store fails
}
```

## Common exam questions

- **MCQ:** What value does `TestAndSet(ptr, new)` return?
  - [x] The OLD value at `*ptr` (before the store)
  - [ ] The new value it just wrote
  - [ ] 1 on success, 0 on failure
  - [ ] A pointer to the previous holder
  - why: Callers branch on the old value: if TAS returns 0 the lock was free and is now owned; if it returns 1 the lock was held.

- **MCQ:** How does `CompareAndSwap(ptr, expected, new)` decide whether to write?
  - [x] It writes `new` only if `*ptr` currently equals `expected`; it returns the value it saw
  - [ ] It always writes `new` and returns `expected`
  - [ ] It writes `new` if any other thread has not modified `*ptr`
  - [ ] It swaps *ptr and expected unconditionally
  - why: CAS is a conditional atomic write keyed on the observed value, enabling optimistic lock-free updates.

- **MCQ:** What makes LL/SC different from CAS in detecting conflicts?
  - [x] StoreConditional fails if ANY intervening write happened to the tracked address, not only a matching value
  - [ ] LL/SC is a single instruction while CAS is two
  - [ ] LL/SC cannot fail spuriously
  - [ ] SC always succeeds the first time
  - why: LL marks the address; any store to it (even from the same thread) can invalidate the reservation, so SC returns failure even if the value happens to match.

- **MCQ:** In a TAS spinlock `while (TestAndSet(&flag, 1) == 1) ;`, when does a thread exit the loop?
  - [x] When TAS returns 0, meaning the flag was free and is now owned by this thread
  - [ ] When TAS returns 1, meaning it succeeded in acquiring
  - [ ] When an interrupt fires
  - [ ] Never, under contention
  - why: Returning 0 means "old value was 0 (free), I set it to 1", so the caller now holds the lock.

- **MCQ:** Why does TAS subtly differ from CAS for lock implementation?
  - [x] TAS always writes `new`; CAS only writes when the old value matches, supporting richer protocols
  - [ ] TAS is not atomic on modern CPUs
  - [ ] CAS cannot be used to build a spinlock
  - [ ] TAS requires a memory barrier but CAS does not
  - why: CAS's conditional store enables lock-free algorithms (stacks, queues) where blind writes would clobber concurrent updates.

- **MCQ:** Can a correct mutual-exclusion lock be built without any hardware atomic instruction on a modern multi-core CPU?
  - [x] No — without atomic RMW or LL/SC, races on the flag itself can violate mutual exclusion
  - [ ] Yes — `volatile int flag = 1` is sufficient
  - [ ] Yes — disabling the compiler optimizer works
  - [ ] Yes — busy-waiting guarantees atomicity
  - why: Peterson-style software solutions work in theory but rely on sequential consistency; real hardware reorders memory operations, so atomic primitives or barriers are required.

## Gotchas

- **TAS doesn't distinguish intent**: CAS is more flexible but TAS is simpler
- **LL/SC correctness**: Store-conditional can fail even if no other thread explicitly accessed the address if the CPU detects any conflict
- **Spin-waiting inefficiency**: Even with atomic primitives, spinning wastes CPU cycles on busy systems
- **Memory barriers**: Some architectures require explicit barriers after these instructions to prevent reordering (not the focus here, but good to know)

## Sources

- lectures__Week7_1.txt
- zhang__Chapter+28+Locks+v6.txt
