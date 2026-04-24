# Reader-Writer Locks

## Definition

**Reader-writer locks** (or RW locks) distinguish between threads that read shared data (readers) and those that modify it (writers). Multiple readers can access the data simultaneously, but a writer requires exclusive access. A writer blocks all readers and other writers; a reader blocks only writers.

## When to use

Use reader-writer locks when the workload is read-heavy and write-heavy operations are rare, such as caches, lookup tables, and configuration data. The overhead of RW locks is only worth it if read concurrency significantly outweighs the synchronization cost.

## Key ideas

- **Read vs. write**: Readers share access; writers require exclusivity
- **First reader enters**: Must acquire the write lock to block writers
- **Last reader exits**: Must release the write lock to allow writers
- **First writer enters**: Must acquire readTry lock to block new readers
- **Last writer exits**: Must release readTry lock to allow readers again
- **Starvation potential**: Without writer preference, readers can starve writers
- **Multiple implementations**: Reader preference, writer preference, or hybrid

## Pseudocode

Reader-writer lock with semaphores (reader preference):
```
typedef struct _rwlock_t {
    sem_t lock;       // binary semaphore (basic lock)
    sem_t writelock;  // used to allow ONE writer or MANY readers
    int readers;      // count of readers reading
} rwlock_t;

void rwlock_init(rwlock_t *rw) {
    rw->readers = 0;
    sem_init(&rw->lock, 0, 1);
    sem_init(&rw->writelock, 0, 1);
}

void rwlock_acquire_readlock(rwlock_t *rw) {
    sem_wait(&rw->lock);
    rw->readers++;
    if (rw->readers == 1)
        sem_wait(&rw->writelock);  // first reader blocks writers
    sem_post(&rw->lock);
}

void rwlock_release_readlock(rwlock_t *rw) {
    sem_wait(&rw->lock);
    rw->readers--;
    if (rw->readers == 0)
        sem_post(&rw->writelock);  // last reader unblocks writers
    sem_post(&rw->lock);
}

void rwlock_acquire_writelock(rwlock_t *rw) {
    sem_wait(&rw->writelock);  // exclusive access
}

void rwlock_release_writelock(rwlock_t *rw) {
    sem_post(&rw->writelock);
}
```

Writer-preference variant (prevents writer starvation):
```
typedef struct _rwlock_t {
    sem_t readTry;
    sem_t resource;
    sem_t rmutex;
    sem_t wmutex;
    int readers;
    int writers;
    int waiting_writers;
} rwlock_t;

void rwlock_acquire_readlock(rwlock_t *rw) {
    sem_wait(&rw->readTry);      // readers respect waiting writers
    sem_wait(&rw->rmutex);
    rw->readers++;
    if (rw->readers == 1)
        sem_wait(&rw->resource);
    sem_post(&rw->rmutex);
    sem_post(&rw->readTry);
}

void rwlock_acquire_writelock(rwlock_t *rw) {
    sem_wait(&rw->wmutex);
    rw->waiting_writers++;
    if (rw->waiting_writers == 1)
        sem_wait(&rw->readTry);  // block new readers when writer waiting
    sem_post(&rw->wmutex);
    
    sem_wait(&rw->resource);     // exclusive access
    
    sem_wait(&rw->wmutex);
    rw->writers = 1;
    sem_post(&rw->wmutex);
}

void rwlock_release_writelock(rwlock_t *rw) {
    sem_post(&rw->resource);
    
    sem_wait(&rw->wmutex);
    rw->writers = 0;
    rw->waiting_writers--;
    if (rw->waiting_writers == 0)
        sem_post(&rw->readTry);
    sem_post(&rw->wmutex);
}
```

## Hand-trace example

Reader preference scenario (3 readers, 1 writer):

| Step | R1 | R2 | R3 | W | readers | writelock | Notes |
|------|----|----|----|----|---------|-----------|-------|
| 1 | acquire_readlock | - | - | - | 0 | 1 | R1: wait(&lock), readers++, readers=1 |
| 2 | wait(&writelock) | - | - | - | 1 | 1 | R1: first reader, wait on writelock |
| 3 | (acquired) | acquire_readlock | - | - | 1 | 0 | R1 has writelock; R2 enters |
| 4 | (reading) | wait(&lock) | - | - | 1 | 0 | R2: wait for lock |
| 5 | (reading) | readers++ | - | - | 1 | 0 | R2: increment readers |
| 6 | (reading) | (no writelock wait) | acquire_readlock | - | 2 | 0 | R2: not first, R3 enters |
| 7 | (reading) | (reading) | wait(&lock) | - | 2 | 0 | R3 waiting for lock |
| 8 | (reading) | (reading) | readers++ | acquire_writelock | 3 | 0 | R3: readers=3; W tries to acquire |
| 9 | (reading) | (reading) | (reading) | wait(&writelock) BLOCKED | 3 | 0 | W blocked (R1 holds writelock) |
| 10 | release_readlock | (reading) | (reading) | (blocked) | 2 | 0 | R1: readers--, readers=2 (not last) |
| 11 | (done) | release_readlock | (reading) | (blocked) | 1 | 0 | R2: readers--, readers=1 (not last) |
| 12 | (done) | (done) | release_readlock | (blocked) | 0 | 0 | R3: readers--, readers=0 (last) |
| 13 | (done) | (done) | (done) | post(&writelock) WAKE | 0 | 1 | R3: post writelock, W wakes |
| 14 | (done) | (done) | (done) | (acquired, writing) | 0 | 0 | W now writing exclusively |

## Common exam questions

- **MCQ:** Which concurrency rule does a reader-writer lock enforce?
  - [x] Many readers OR one writer; never readers and a writer simultaneously
  - [ ] Exactly one reader and one writer at a time
  - [ ] One reader and many writers
  - [ ] Any combination of readers and writers, bounded by CPU count
  - why: Readers share; writers are exclusive. Mixing a reader with a writer would expose partial writes.

- **MCQ:** In the reader-preference implementation, what does the first reader do?
  - [x] Call `sem_wait(&writelock)` to block any writer while readers are active
  - [ ] Call `sem_post(&writelock)` to wake the waiting writer
  - [ ] Acquire `lock` and never release it
  - [ ] Increment a writer-waiting counter
  - why: Only the first reader needs to take writelock; subsequent readers just bump the count under `lock`.

- **MCQ:** Why does only the LAST reader call `sem_post(&writelock)`?
  - [x] Releasing it earlier would let a writer enter while other readers are still active
  - [ ] Every reader must post to keep the semaphore balanced
  - [ ] Only the last reader can decrement the counter
  - [ ] Posting wakes all readers, not writers
  - why: Writelock must stay held for the entire lifetime of any reader; posting before all readers finish would violate writer exclusion.

- **MCQ:** What starvation scenario is intrinsic to reader preference?
  - [x] A continuous stream of arriving readers can block a waiting writer indefinitely
  - [ ] Readers can block each other on `writelock`
  - [ ] Writers can starve other writers
  - [ ] The last reader can deadlock with the first writer
  - why: As long as readcount never drops to zero (new readers keep arriving), the writer never gets `writelock`.

- **MCQ:** Why is `sem_t lock` needed in addition to `writelock`?
  - [x] It protects the `readers` counter from concurrent increment/decrement
  - [ ] It provides exclusive access for the writer
  - [ ] It is used to signal condition variables
  - [ ] It is held for the duration of every reader's critical section
  - why: Without `lock`, two readers incrementing `readers` could race, corrupting the counter and the first-reader / last-reader logic.

- **MCQ:** Compared to a plain mutex, a reader-writer lock is only a win when:
  - [x] Reads are frequent, long, and writes are rare
  - [ ] Writes dominate the workload
  - [ ] All critical sections are equally short
  - [ ] There is exactly one thread
  - why: The extra bookkeeping (counter, two semaphores) only pays off when reads can overlap; otherwise a plain mutex is faster.

## Gotchas

- **Reader preference starvation**: If readers keep arriving, writers may wait indefinitely
- **Writer preference complexity**: Requires tracking waiting writers, adding overhead
- **Fairness vs. performance**: Strict fairness may hurt concurrent reader throughput
- **First/last reader/writer semantics**: Easy to get off-by-one errors in counting
- **Lock ordering**: If acquiring multiple RW locks, must avoid deadlock by consistent ordering

## Sources

- lectures__Week8_1.txt
- zhang__Reader-Writer+Problem+with+Condition+Variables.txt
