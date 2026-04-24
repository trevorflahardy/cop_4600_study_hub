# Spinlocks and Ticket Locks

## Definition

A **spinlock** uses atomic instructions to busy-wait on a flag until a lock becomes available. A **ticket lock** improves on spinlocks by using fetch-and-add to allocate a unique ticket number to each waiter, ensuring fairness and preventing starvation.

## When to use

Use spinlocks when the critical section is very short and contention is low (spinning cost is negligible). Use ticket locks when you need fairness guarantees or want to reduce the likelihood of starvation. Ticket locks are preferable in systems where fairness matters (e.g., kernel locks).

## Key ideas

- **Spinlock**: Simple but unfair; any waiting thread can acquire the lock
- **Busy-waiting**: Wastes CPU cycles but avoids OS scheduling overhead
- **Fairness problem**: With TAS-based spinlocks, a hungry thread can starve others
- **Ticket lock**: FIFO fairness; threads acquire tickets in order
- **Fetch-And-Add**: Atomically returns old value and increments; perfect for ticket allocation
- **Two fields**: ticket (allocator) and turn (current holder indicator)

## Pseudocode

Simple spinlock using Test-And-Set:
```
typedef struct {
    int flag;
} lock_t;

void init(lock_t *lock) {
    lock->flag = 0;
}

void lock(lock_t *lock) {
    while (TestAndSet(&lock->flag, 1) == 1)
        ;   // spin until we acquire lock
}

void unlock(lock_t *lock) {
    lock->flag = 0;
}
```

Ticket lock using Fetch-And-Add:
```
typedef struct {
    int ticket;
    int turn;
} lock_t;

void lock_init(lock_t *lock) {
    lock->ticket = 0;
    lock->turn = 0;
}

void lock(lock_t *lock) {
    int myturn = FetchAndAdd(&lock->ticket);
    while (lock->turn != myturn)
        ;   // spin until it's my turn
}

void unlock(lock_t *lock) {
    FetchAndAdd(&lock->turn);   // increment turn
}
```

## Hand-trace example

Ticket lock with 3 threads competing:

| Step | T1 | T2 | T3 | ticket | turn | Notes |
|------|----|----|----|---------|----|-------|
| 1 | FetchAndAdd() | - | - | 0→1 | 0 | T1: myturn=0 |
| 2 | while(turn!=0)? | FetchAndAdd() | - | 1→2 | 0 | T2: myturn=1 |
| 3 | false, lock acquired | while(turn!=1)? | FetchAndAdd() | 2→3 | 0 | T3: myturn=2 |
| 4 | (critical sect.) | true, spin | while(turn!=2)? | 3 | 0 | T3 spinning |
| 5 | (critical sect.) | (spinning) | true, spin | 3 | 0 | Both waiting in order |
| 6 | FetchAndAdd() | (spinning) | (spinning) | 3 | 0→1 | T1: unlock (turn++) |
| 7 | (done) | while(turn!=1)? | (spinning) | 3 | 1 | T2: lock acquired |
| 8 | - | (critical sect.) | (spinning) | 3 | 1 | T3 still waiting |
| 9 | - | FetchAndAdd() | while(turn!=2)? | 3 | 1→2 | T2: unlock |
| 10 | - | (done) | false, acquired | 3 | 2 | T3: acquired |

## Common exam questions

- **MCQ:** What does a plain TAS-based spinlock fail to guarantee?
  - [x] Fairness / bounded waiting — a thread can be repeatedly overtaken
  - [ ] Mutual exclusion
  - [ ] Progress when the lock is free
  - [ ] Atomicity of the TAS instruction
  - why: TAS just lets whichever thread wins the race grab the flag next; an unlucky thread can lose forever under contention.

- **MCQ:** Which atomic instruction is central to a ticket lock?
  - [x] Fetch-And-Add (to hand out a unique ticket number)
  - [ ] Test-And-Set (to flip a flag)
  - [ ] Compare-And-Swap (to swap the head pointer)
  - [ ] Load-Linked only (no store needed)
  - why: FetchAndAdd atomically returns the old value and increments, letting each thread grab a distinct, monotonically increasing ticket.

- **MCQ:** How does a ticket lock ensure FIFO fairness?
  - [x] A waiter spins until `turn == myturn`, so acquisitions happen in ticket order
  - [ ] By disabling interrupts while waiting
  - [ ] By maintaining a linked list of waiters
  - [ ] By using a separate queue lock per thread
  - why: The global `turn` counter advances one at a time; thread with the next matching ticket is the one that proceeds.

- **MCQ:** What does `unlock` do in a ticket lock?
  - [x] Atomically increment `turn`, letting the next ticket holder proceed
  - [ ] Store 0 into `turn` to reset the sequence
  - [ ] TAS(flag, 0) to clear the held bit
  - [ ] Post on a semaphore to wake one waiter
  - why: Incrementing turn is the hand-off; the waiter that holds turn-value-equal-to-myturn exits its spin.

- **MCQ:** Which is the main drawback of ALL spinlocks regardless of fairness?
  - [x] Waiters burn CPU cycles while spinning, wasting work
  - [ ] They require kernel system calls on every acquire
  - [ ] They require two atomic operations per acquire
  - [ ] They cannot coexist with condition variables
  - why: Spinning is the defining cost; whether TAS or ticket, a contended spinlock keeps the waiter burning a core.

- **MCQ:** On an oversubscribed system (more runnable threads than CPUs), why are spinlocks especially bad?
  - [x] A waiter spins while the lock holder may be off-CPU, so the spin cannot possibly succeed soon
  - [ ] The OS cannot schedule spinning threads
  - [ ] TAS instructions fail under oversubscription
  - [ ] The ticket counter overflows faster
  - why: Spinning is only useful when the holder is actively running on another core; if the holder is descheduled, waiters burn their quanta uselessly.

## Gotchas

- **Starvation in TAS spinlocks**: A thread can be "unlucky" and always see flag=1 when it reads (though rare, it's possible)
- **Not FIFO**: TAS spinlock order of acquisition is unpredictable
- **Ticket lock overhead**: More memory accesses (two fields) can increase cache coherency traffic
- **Contention**: On oversubscribed systems (more threads than CPUs), spinning is extremely wasteful
- **Fairness doesn't guarantee performance**: Ticket locks are fair but may have poor cache locality

## Sources

- lectures__Week7_1.txt
- zhang__Chapter+28+Locks+v6.txt
