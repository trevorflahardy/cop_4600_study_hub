# Concurrency — Final Exam Drills (Lock, CV, Semaphore Emphasis)

> Confirmed: 75 final-exam points on concurrency — the single biggest
> block. Professor emphasized: lock implementation, condition variable
> usage (use `while`, not `if`), spin lock, mutual exclusion with
> condition variables, semaphore correctness, and "fully understand
> midterm 2 practice and exam." Treat this file as the final-exam
> supplement to [cumulative-problems-concurrency.md](./cumulative-problems-concurrency.md).

## The four non-negotiable rules (memorize before the exam)

1. **Always hold the mutex around CV wait and signal.** If you call
   `wait` without the mutex, a race between the predicate check and the
   sleep can lose the signal.
2. **Always wait in a `while` loop, never an `if`.** Spurious wakeups
   and multi-waiter races can leave the predicate false on return.
3. **Signal after changing the predicate, still holding the lock.** The
   woken thread will re-acquire on return; order of signal vs. unlock
   is flexible in pthreads but cleaner to signal first.
4. **Use `broadcast` for covering conditions** — when different waiters
   wait on different predicates of the same CV.

## Drill 1 — the lost-wakeup bug (Chapter 30)

Does this code correctly pause and resume a worker thread? If not, where
is the bug?

```c
int ready = 0;
pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t  c = PTHREAD_COND_INITIALIZER;

void *worker(void *arg) {
    if (ready == 0)
        pthread_cond_wait(&c, &m);
    printf("worker running\n");
    return NULL;
}

void wake_worker() {
    ready = 1;
    pthread_cond_signal(&c);
}
```

### Solution

Two bugs:

1. **Mutex is not held around the check, the wait, or the signal.** The
   wait call atomically releases a mutex that was never held — undefined
   behavior in pthreads. Even with a held mutex, the check and the wait
   must be in a critical section; otherwise `wake_worker` can set
   `ready = 1` and signal between the worker's `ready == 0` check and
   its wait call. The worker then sleeps forever.
2. **Uses `if` instead of `while`.** Even with correct locking, a
   spurious wakeup or another-thread-consumed-the-signal race can leave
   the worker running before `ready` is truly 1.

### Fix

```c
pthread_mutex_lock(&m);
while (ready == 0)
    pthread_cond_wait(&c, &m);
pthread_mutex_unlock(&m);

// wake_worker:
pthread_mutex_lock(&m);
ready = 1;
pthread_cond_signal(&c);
pthread_mutex_unlock(&m);
```

## Drill 2 — `while` vs `if` stress test

Consider a bounded buffer (size 1) with one producer and two consumers.
Producer enqueues items; each consumer dequeues. Given this (buggy)
consumer:

```c
pthread_mutex_lock(&m);
if (count == 0)
    pthread_cond_wait(&full, &m);
int v = buffer[0];
count = 0;
pthread_cond_signal(&empty);
pthread_mutex_unlock(&m);
return v;
```

Describe a schedule where both consumers return the same value.

### Solution

1. Producer puts item 42. `count = 1`. Signals `full`.
2. Consumer-1 was waiting; wakes from `cond_wait` (re-acquires m).
3. Consumer-2 also was waiting (it had been asleep earlier). Signal
   landed on consumer-1, but consumer-2 is also eligible to be woken —
   in a broadcast scenario or with two waiters on the same CV, the
   signal primitive chooses one. Say consumer-1 wins.
4. Consumer-1 passes the `if`, executes body, reads buffer[0] = 42.
5. Before consumer-1 reaches `count = 0`, it is preempted.
6. Producer runs again? No — producer is waiting on `empty`. Another
   signal to `full` happens? No. So consumer-2 is asleep.

Wait — the bug requires a more aggressive schedule. Let's rewrite with
2 producers, 2 consumers:

1. Producer-1 puts item 42, signals `full`, unlocks.
2. Consumer-1 wakes, `if` passes, reads 42, sets count=0, signals
   empty, unlocks. Good.
3. Now reverse: Producer-1 puts item 99, signals full. Consumer-1 is
   woken but not yet running. Producer-2 also wants to run but finds
   count != 0 so waits on empty. Consumer-2, also waiting on full,
   is woken by a spurious wakeup (OS-level). Consumer-2's `if` check
   passes (count == 1), reads 99, count = 0, unlock, return 99.
4. Consumer-1 finally runs. It was inside `cond_wait`, returns, passes
   the `if` (no recheck!), reads buffer[0] still = 99, count = 0 already,
   returns 99.

**Both consumers returned 99.** The fix is `while`:

```c
while (count == 0)
    pthread_cond_wait(&full, &m);
```

Now consumer-1 on wakeup rechecks count, sees 0, goes back to sleep.

## Drill 3 — producer-consumer with semaphores

Fill in the blanks. Buffer size BSIZE, one producer, one consumer.

```c
int buf[BSIZE];
int fill = 0, use = 0;
sem_t empty, full, mutex;

void init() {
    sem_init(&empty, 0, ___);
    sem_init(&full,  0, ___);
    sem_init(&mutex, 0, ___);
}

void *producer(void *arg) {
    for (;;) {
        int v = produce();
        sem_wait(&___);            // (a)
        sem_wait(&___);            // (b)
        buf[fill] = v;
        fill = (fill + 1) % BSIZE;
        sem_post(&___);            // (c)
        sem_post(&___);            // (d)
    }
}

void *consumer(void *arg) {
    for (;;) {
        sem_wait(&___);            // (e)
        sem_wait(&___);            // (f)
        int v = buf[use];
        use = (use + 1) % BSIZE;
        sem_post(&___);            // (g)
        sem_post(&___);            // (h)
        consume(v);
    }
}
```

### Solution

- `sem_init(&empty, 0, BSIZE)` — initially all slots empty.
- `sem_init(&full, 0, 0)` — initially no items.
- `sem_init(&mutex, 0, 1)` — binary mutex for the buffer indices.

Producer: (a) `empty`, (b) `mutex`, (c) `mutex`, (d) `full`.
Consumer: (e) `full`, (f) `mutex`, (g) `mutex`, (h) `empty`.

### Trap

If you swap the order in the producer to `sem_wait(&mutex); sem_wait(&empty);`,
you deadlock: the consumer cannot take mutex because the producer is
holding it while waiting on empty. **Always acquire the condition
semaphore (empty/full) before the mutex.**

## Drill 4 — spinlock vs ticket lock fairness

Given a multi-threaded workload with 16 threads contending for the same
lock, compare the behavior of a raw TAS spinlock and a ticket lock:

1. Which threads make forward progress under contention?
2. Which guarantees no thread starves?
3. Which causes worse cache-coherence traffic?
4. When would a two-phase lock beat both?

### Solution

1. **TAS spinlock**: any thread that happens to run while the lock is
   released can grab it. No fairness. Some threads may starve.
   **Ticket lock**: threads enter a FIFO queue via FetchAndAdd on a
   global ticket counter. Next ticket holder wins.
2. **Ticket lock** guarantees bounded waiting; **TAS spinlock** does not.
3. **TAS spinlock** spins on one shared variable; every TAS is a
   read-for-ownership, generating coherence traffic. TTAS (test then TAS)
   reduces this by spinning on a read. **Ticket lock** spins on the
   ticket counter; threads with different tickets spin on the same
   variable but only one cache line.
4. **Two-phase lock**: spin briefly (optimistic that critical section is
   short), then block on a futex. Beats both under long critical
   sections where spinning wastes CPU.

## Drill 5 — TAS spinlock implementation

Given `int TAS(int *addr)` that atomically sets `*addr = 1` and returns
the previous value, write:

1. A spinlock using TAS.
2. A spinlock using CAS (with the signature `bool CAS(int *addr, int expected, int desired)`).
3. Explain why TTAS (test-and-TAS) is faster under contention.

### Solution

```c
// 1. TAS spinlock
typedef struct { int locked; } spinlock_t;

void spin_lock(spinlock_t *l) {
    while (TAS(&l->locked) == 1) {
        // spin
    }
}

void spin_unlock(spinlock_t *l) {
    l->locked = 0;
}
```

```c
// 2. CAS spinlock
void spin_lock_cas(spinlock_t *l) {
    while (!CAS(&l->locked, 0, 1)) {
        // spin
    }
}
```

```c
// 3. TTAS: spin on a read; only TAS when the read shows unlocked
void spin_lock_ttas(spinlock_t *l) {
    for (;;) {
        while (l->locked == 1) { /* spin on read */ }
        if (TAS(&l->locked) == 0) return;
    }
}
```

TTAS beats TAS because a plain read keeps the cache line in *shared*
state; many threads can spin without invalidating each other's cache.
Raw TAS always goes through the exclusive state, generating coherence
storms.

## Drill 6 — ticket lock implementation

Implement a ticket lock using `FAA(int *addr)` (fetch-and-add, returns old
value). Prove it is FIFO.

### Solution

```c
typedef struct {
    int ticket;   // next number to hand out
    int turn;     // who currently holds the lock
} ticket_lock_t;

void lock(ticket_lock_t *l) {
    int my_ticket = FAA(&l->ticket);   // atomically grab next number
    while (l->turn != my_ticket) {
        // spin
    }
}

void unlock(ticket_lock_t *l) {
    l->turn++;     // wakes the next ticket holder
}
```

**FIFO proof**: FAA hands tickets in arrival order. A thread entering the
critical section has some ticket T. When unlock increments `turn` to
T+1, only the thread holding T+1 proceeds — and T+1 was handed out
after T. Thus threads enter the critical section in the order they
called FAA.

## Drill 7 — mutual exclusion via CV (monitor pattern)

Implement a **thread-safe bounded queue** using a mutex and two CVs.
Interface: `put(int)` blocks if full, `get() -> int` blocks if empty.
Follow the four non-negotiable rules.

### Solution

```c
#define N 16
int buf[N];
int head = 0, tail = 0, count = 0;
pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t  not_full = PTHREAD_COND_INITIALIZER;
pthread_cond_t  not_empty = PTHREAD_COND_INITIALIZER;

void put(int v) {
    pthread_mutex_lock(&m);
    while (count == N)
        pthread_cond_wait(&not_full, &m);
    buf[tail] = v;
    tail = (tail + 1) % N;
    count++;
    pthread_cond_signal(&not_empty);
    pthread_mutex_unlock(&m);
}

int get(void) {
    pthread_mutex_lock(&m);
    while (count == 0)
        pthread_cond_wait(&not_empty, &m);
    int v = buf[head];
    head = (head + 1) % N;
    count--;
    pthread_cond_signal(&not_full);
    pthread_mutex_unlock(&m);
    return v;
}
```

**Every rule checked**:

1. Lock is held across wait and signal. ✓
2. Predicate is in `while`. ✓
3. Signal after predicate change. ✓
4. Two distinct CVs so `signal` is sufficient (not covering). ✓

## Drill 8 — when `signal` loses to `broadcast`

Consider a shared cache that multiple threads can "reserve" via a single
CV. Two different classes of waiters: one waits for `slot available`,
another for `slot owned by itself`.

```c
pthread_mutex_lock(&m);
while (! my_condition())
    pthread_cond_wait(&c, &m);
// critical action
pthread_mutex_unlock(&m);
```

If the producer calls `pthread_cond_signal(&c)`, can the wrong class of
thread wake up? What should it call instead?

### Solution

`signal` wakes exactly one thread — an implementation-chosen waiter.
That thread may not be the one the producer intended. On wakeup it
rechecks (`while` — good), predicate is still false, sleeps again.
Meanwhile the waiter that *could* proceed stays asleep. **Lost
progress.**

Fix: `pthread_cond_broadcast(&c)`. All waiters wake, check their own
predicates, and only the eligible one proceeds. Others go back to
sleep.

This is the **covering-conditions** rule.

## Drill 9 — print-in-order (Chapter 31)

Three threads T1, T2, T3. Required output: `A` then `B` then `C` (from
T1, T2, T3 respectively), regardless of scheduling. Use CVs and flags.

### Solution

```c
int a_done = 0, b_done = 0;
pthread_mutex_t m = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t  cond = PTHREAD_COND_INITIALIZER;

void *T1(void *) {
    pthread_mutex_lock(&m);
    printf("A\n");
    a_done = 1;
    pthread_cond_broadcast(&cond);
    pthread_mutex_unlock(&m);
    return NULL;
}

void *T2(void *) {
    pthread_mutex_lock(&m);
    while (!a_done)
        pthread_cond_wait(&cond, &m);
    printf("B\n");
    b_done = 1;
    pthread_cond_broadcast(&cond);
    pthread_mutex_unlock(&m);
    return NULL;
}

void *T3(void *) {
    pthread_mutex_lock(&m);
    while (!b_done)
        pthread_cond_wait(&cond, &m);
    printf("C\n");
    pthread_mutex_unlock(&m);
    return NULL;
}
```

**Why broadcast**: two CVs would work too, but with a single CV shared
across T2 and T3, a signal might wake the wrong thread (covering
conditions).

## Drill 10 — semaphore-based rendezvous

Two threads, each emits one print. Force `X` before `Y` regardless of
schedule, using *only semaphores*.

### Solution

```c
sem_t s;
sem_init(&s, 0, 0);  // starts at 0

void *T1(void *) {
    printf("X\n");
    sem_post(&s);
    return NULL;
}

void *T2(void *) {
    sem_wait(&s);
    printf("Y\n");
    return NULL;
}
```

T2 starts and blocks immediately at `sem_wait` (value is 0). When T1
prints X and posts, T2 wakes and prints Y.

## Drill 11 — semaphore as a mutex

Use a semaphore to implement a standard mutex. Give the initial value
and the `lock` / `unlock` code.

### Solution

```c
sem_t mx;
sem_init(&mx, 0, 1);   // binary semaphore

void lock(void)   { sem_wait(&mx); }
void unlock(void) { sem_post(&mx); }
```

## Drill 12 — reader-writer lock (Chapter 32)

Requirements:

- Multiple readers can hold the lock simultaneously.
- Writers get exclusive access.
- Reader-priority (classic): a reader can always enter while other
  readers are in; writers wait.

Implement using semaphores `lock` and `writelock`, and an integer
`readers`.

### Solution

```c
int readers = 0;
sem_t lock, writelock;
sem_init(&lock, 0, 1);
sem_init(&writelock, 0, 1);

void acquire_read(void) {
    sem_wait(&lock);
    readers++;
    if (readers == 1) sem_wait(&writelock);   // first reader blocks writers
    sem_post(&lock);
}

void release_read(void) {
    sem_wait(&lock);
    readers--;
    if (readers == 0) sem_post(&writelock);   // last reader unblocks writers
    sem_post(&lock);
}

void acquire_write(void) { sem_wait(&writelock); }
void release_write(void) { sem_post(&writelock); }
```

**Starvation warning**: if readers keep arriving, writers never get in.
Use writer-priority variant to avoid (more complex; not typically needed
at exam level).

## Drill 13 — find-the-race

```c
int counter = 0;

void *worker(void *arg) {
    for (int i = 0; i < 1000; i++) {
        counter++;
    }
    return NULL;
}
```

Ten threads run `worker`. Final `counter` value is frequently < 10000.
Why? Write the minimal fix using (a) a mutex, (b) an atomic `FAA`.

### Solution

`counter++` decomposes to `load; add; store`. Interleaving two threads'
load/store sequences loses updates (a classic data race).

(a) With a mutex:

```c
pthread_mutex_lock(&m);
counter++;
pthread_mutex_unlock(&m);
```

(b) With an atomic fetch-and-add:

```c
__atomic_add_fetch(&counter, 1, __ATOMIC_SEQ_CST);
```

or equivalently `FAA(&counter)`.

## Drill 14 — deadlock via lock ordering

Thread T1 runs `lock(a); lock(b); /* work */ unlock(b); unlock(a);`. T2
runs `lock(b); lock(a); /* work */ unlock(a); unlock(b);`.

1. Describe a schedule producing a deadlock.
2. Which of the four Coffman conditions are present?
3. Fix the code.

### Solution

1. T1 acquires `a`, preempted. T2 acquires `b`, preempted. T1 resumes,
   tries `lock(b)` — blocks. T2 resumes, tries `lock(a)` — blocks.
   Circular wait → deadlock.
2. Mutual exclusion (locks are exclusive), hold-and-wait (T1 holds `a`
   while requesting `b`), no preemption (OS can't steal), circular wait
   (T1→b→T2, T2→a→T1). All four. Remove any one to break the cycle.
3. **Impose a total order on locks.** For example, always lock by
   address: `lock(min(&a,&b)); lock(max(&a,&b));`. Both threads now
   acquire in the same order, so no cycle is possible.

## Drill 15 — signal vs broadcast case study

Producer-consumer with **N producers and N consumers** on a single
bounded buffer. Both `producer` and `consumer` use a single CV called
`cv` with predicate checks inside the critical section.

Should signals be `pthread_cond_signal` or `pthread_cond_broadcast`?
Justify.

### Solution

**Broadcast** is required. A single CV serves two classes of waiters —
producers (waiting for space) and consumers (waiting for items). A
`signal` can wake the wrong class: producer releases item, signals; a
blocked producer wakes, rechecks (still full? no — space now, so yes,
it can produce), consumes the signal. The waiting consumer never wakes
and starves.

The right answer: either use two CVs (`not_full` for producers,
`not_empty` for consumers) with `signal`, or use one CV with
`broadcast`. Two-CV with signal is more efficient.

## Drill 16 — futex / two-phase lock reasoning

Why does Linux prefer a futex-based two-phase lock over a pure spinlock
for user-space mutexes? Give one scenario where a spinlock would win.

### Solution

**Two-phase lock**: spin briefly (fast path for short critical sections),
then call into the kernel via `futex(FUTEX_WAIT)` to sleep (saves CPU
for long critical sections). Best of both worlds.

**Pure spinlock wins** only when critical sections are extremely short
(< scheduling quantum) and the contending threads are pinned to
different CPUs. No syscall overhead, no context-switch. Typical kernel
code and lock-free data structures.

## Drill 17 — dining philosophers (Chapter 31)

Five philosophers sitting in a circle. Each needs the left and right
chopstick. Naive code: `lock(left); lock(right);`. Show a deadlock.
Propose two fixes.

### Solution

**Deadlock schedule**: all five pick up their left chopstick
simultaneously. Each waits for the right, which its right neighbor is
holding. Circular wait; deadlock.

**Fix 1 — break symmetry**: one philosopher (say #4) acquires right
first. Now the circle cannot complete.

```c
if (id == 4) { lock(right); lock(left); }
else         { lock(left);  lock(right); }
```

**Fix 2 — limit concurrency**: let at most 4 philosophers sit at once
(use a semaphore init to 4). Pigeonhole: with 4 philosophers and 5
chopsticks, some philosopher always has both.

**Fix 3 — address order**: always lock the chopstick with lower address
first. All acquisitions follow a total order; cycles impossible.

## Drill 18 — semaphore ordering enumeration

Three threads, T1, T2, T3. Each runs:

```c
sem_wait(&s);
printf("<id>\n");
sem_post(&s);
```

`s` is initialized to 1. Enumerate all possible output sequences.

### Solution

Semaphore `s` starts at 1, so exactly one thread holds it at a time. The
three prints happen in some order, but the semaphore serializes them.
Every permutation of {1, 2, 3} is possible, depending on scheduler:

`1 2 3`, `1 3 2`, `2 1 3`, `2 3 1`, `3 1 2`, `3 2 1`

**6 possible outputs.**

## Drill 19 — when spin locks beat blocking locks

Sketch a scenario (critical section length, thread count, CPU count)
where a pure spin lock gives higher throughput than a pthread mutex.

### Solution

Very short critical section (say, a few nanoseconds — an atomic
increment), on a multi-core machine with per-core pinning, under high
contention. The pthread mutex calls into the kernel on contention,
costing ~1 microsecond. The spin lock stays in user space; threads on
other cores just spin briefly while the holder exits the critical
section. Spin wins by 100x on throughput for such workloads.

Inversion: with a critical section longer than a scheduling quantum
(~10 ms), the spin lock burns CPU that could have been used by other
threads. Blocking wins.

## Drill 20 — exam-style: fix the buggy producer

```c
// BUG: find it
void produce(int v) {
    if (count == N)
        pthread_cond_wait(&not_full, &m);
    pthread_mutex_lock(&m);
    buf[tail] = v;
    tail = (tail + 1) % N;
    count++;
    pthread_cond_signal(&not_empty);
    pthread_mutex_unlock(&m);
}
```

### Solution

Two bugs:

1. `cond_wait` is called without holding `m` (the mutex is locked
   *after* the wait). This is undefined behavior.
2. `if` instead of `while`. Even with correct locking, a woken thread
   may find `count == N` on return and proceed anyway.

Correct:

```c
void produce(int v) {
    pthread_mutex_lock(&m);
    while (count == N)
        pthread_cond_wait(&not_full, &m);
    buf[tail] = v;
    tail = (tail + 1) % N;
    count++;
    pthread_cond_signal(&not_empty);
    pthread_mutex_unlock(&m);
}
```

## Sources

- Professor's final-exam review session (2026-04-23): lock
  implementation, CV while-not-if, spin lock, semaphore, 75 pts,
  "fully understand MT2."
- OSTEP chapters 28 (locks), 29 (lock-based data structures), 30 (CVs),
  31 (semaphores), 32 (common concurrency bugs).
- Zhang TA concurrency review deck.
- Midterm 2 practice packet.
