# Futex and Park-Based Locks

## Definition

**Futex** (fast userspace mutex) is a Linux kernel primitive for efficient user-space synchronization that minimizes system calls. **Park-based locks** use OS-provided park() and unpark() calls to manage sleeping threads waiting for a lock, avoiding busy-waiting and wasted CPU cycles.

## When to use

Use park-based locks for production systems where contention is unpredictable and efficiency is critical. Futex is the standard for Linux mutex implementations and provides excellent performance. These replace spinlocks and two-phase locks in real-world systems.

## Key ideas

- **Futex**: User-space first, kernel second; only goes to kernel if contention detected
- **Atomic check**: Fast path avoids kernel call when lock is available
- **Wakeup/wait race**: Original park/unpark had a race; futex/setpark solves this
- **Guard lock**: A spinlock protecting the wait queue prevents race conditions
- **Bit 31 (futex implementation)**: Used to indicate lock state; atomically operated
- **Efficiency**: Minimizes system calls and context switches

## Pseudocode

Park-based lock with queue (conceptual):
```
typedef struct {
    int flag;              // 0 = available, 1 = held
    int guard;             // spinlock protecting queue
    queue_t *q;            // queue of waiting threads
} lock_t;

void lock_init(lock_t *m) {
    m->flag = 0;
    m->guard = 0;
    queue_init(m->q);
}

void lock(lock_t *m) {
    // Acquire guard spinlock to safely check flag
    while (TestAndSet(&m->guard, 1) == 1)
        ;  // spin on guard
    
    if (m->flag == 0) {
        m->flag = 1;
        m->guard = 0;
        return;
    } else {
        queue_add(m->q, gettid());
        m->guard = 0;
        park();  // put thread to sleep
    }
}

void unlock(lock_t *m) {
    // Acquire guard
    while (TestAndSet(&m->guard, 1) == 1)
        ;
    
    if (queue_empty(m->q)) {
        m->flag = 0;
    } else {
        unpark(queue_remove(m->q));  // hold lock for next thread
    }
    m->guard = 0;
}
```

Futex mutex_lock and mutex_unlock (Linux):
```
void mutex_lock(int *mutex) {
    int v;
    // Fast path: try to acquire without system call
    if (atomic_bit_test_set(mutex, 31) == 0)
        return;
    
    atomic_increment(mutex);  // indicate contention
    
    while (1) {
        if (atomic_bit_test_set(mutex, 31) == 0) {
            atomic_decrement(mutex);
            return;
        }
        v = *mutex;
        if (v >= 0)
            continue;  // lock became free, retry
        futex_wait(mutex, v);  // sleep; kernel wakes if value changes
    }
}

void mutex_unlock(int *mutex) {
    if (atomic_add_zero(mutex, 0x80000000))
        return;  // no waiters; lock is free
    futex_wake(mutex);  // wake one waiter
}
```

## Hand-trace example

Park-based lock acquisition and release (2 threads):

| Step | T1 | T2 | flag | guard | queue | Notes |
|------|----|----|------|-------|-------|-------|
| 1 | TAS(guard) → 0 | - | 0 | 1 (acquired) | empty | T1 acquires guard |
| 2 | flag==0? yes | - | 0 | 1 | empty | T1 checks flag |
| 3 | flag=1 | - | 1 | 1 | empty | T1 sets flag |
| 4 | guard=0 | TAS(guard) → 0 | 1 | 0 | empty | T1 releases guard; T2 acquires |
| 5 | (crit sect) | flag==0? no | 1 | 1 | empty | T2 checks, flag is held |
| 6 | (crit sect) | queue_add(T2) | 1 | 1 | T2 | T2 added to queue |
| 7 | (crit sect) | guard=0; park() | 1 | 0 | T2 | T2 sleeps |
| 8 | (crit sect) | (sleeping) | 1 | 0 | T2 | T2 in OS, no CPU |
| 9 | flag=0 | (sleeping) | 0 | 0 | T2 | T1 releases flag |
| 10 | TAS(guard) → 0 | (sleeping) | 0 | 1 | T2 | T1 acquires guard |
| 11 | queue empty? no | (sleeping) | 0 | 1 | T2 | T1 checks queue |
| 12 | unpark(T2) | (woken, runnable) | 0 | 1 | empty | T1 wakes T2, dequeues |
| 13 | guard=0 | (runnable) | 0 | 0 | empty | T1 releases guard |
| 14 | (done) | lock acquired | 1 | 0 | empty | T2 proceeds in critical section |

## Common exam questions

- What is the wakeup/waiting race and how does futex prevent it?
- Why does a park-based lock need a guard spinlock?
- Explain the fast path vs. slow path in futex_lock.
- How does futex reduce the number of system calls compared to basic park/unpark?
- Describe the atomicity requirements for flag updates in park-based locks.

## Gotchas

- **Race condition without guard**: Without the guard spinlock protecting the queue, a thread could be woken after it checks the queue but before it calls park()
- **Futex complexity**: The futex implementation has subtle details (bit 31, counters) that make it hard to understand fully
- **Spurious wake-ups**: Even with futex, a thread may wake without a corresponding wake call (though futex minimizes this)
- **Guard cost**: The spinlock guard adds overhead but is necessary for correctness
- **Kernel overhead**: Park/unpark require system calls; on low-contention workloads, spinlocks may be faster

## Sources

- lectures__Week7_1.txt
- zhang__Chapter+28+Locks+v6.txt
