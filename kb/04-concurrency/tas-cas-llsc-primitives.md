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

- Explain the difference between TAS and CAS. When would you use CAS over TAS?
- Why is the atomicity of these instructions critical for lock correctness?
- How does LL/SC differ from TAS and CAS in detecting conflicts?
- Trace through a TAS-based spin lock acquisition and release.
- Can you implement a correct lock without hardware atomic instructions? Why or why not?

## Gotchas

- **TAS doesn't distinguish intent**: CAS is more flexible but TAS is simpler
- **LL/SC correctness**: Store-conditional can fail even if no other thread explicitly accessed the address if the CPU detects any conflict
- **Spin-waiting inefficiency**: Even with atomic primitives, spinning wastes CPU cycles on busy systems
- **Memory barriers**: Some architectures require explicit barriers after these instructions to prevent reordering (not the focus here, but good to know)

## Sources

- lectures__Week7_1.txt
- zhang__Chapter+28+Locks+v6.txt
