# Reader-Writer Locks with Writer Preference

## Definition

**Writer-preference reader-writer locks** prevent writer starvation by blocking new readers from acquiring the lock once a writer is waiting. This contrasts with reader-preference locks, where readers always have priority. Writer preference is crucial in systems where write operations must make timely progress.

## When to use

Use writer-preference locks when writers are critical (e.g., cache invalidation, state updates) and cannot be starved by a continuous stream of readers. The trade-off is reduced read concurrency when writers are waiting.

## Key ideas

- **readTry semaphore**: Controls whether new readers can enter (blocks when writer waiting)
- **rmutex semaphore**: Protects the reader count variable
- **wmutex semaphore**: Protects the writer count and waiting_writers variables
- **resource semaphore**: Provides exclusive access (acquired by first reader and all writers)
- **First reader role**: Acquires resource lock to block writers
- **Last reader role**: Releases resource lock to allow waiting writers
- **First writer role**: Increments waiting_writers and acquires readTry to block new readers
- **Last writer role**: Releases readTry to allow readers again
- **Reader starvation condition**: Does NOT occur with writer preference; readers wait for waiting writers to complete
- **Ordering logic**: Readers check readTry first (respecting waiting writers)

## Pseudocode

Writer-preference reader-writer lock (complete implementation):
```
typedef struct _rwlock_t {
    sem_t readTry;           // 1: readers allowed, 0: blocked (writer waiting)
    sem_t rmutex;            // protects reader count
    sem_t wmutex;            // protects writer count & waiting_writers
    sem_t resource;          // actual resource (1: available, 0: held)
    int readcount;           // number of active readers
    int writecount;          // number of active writers (0 or 1)
    int waiting_writers;     // number of writers waiting
} rwlock_t;

void rwlock_init(rwlock_t *rw) {
    sem_init(&rw->readTry, 0, 1);
    sem_init(&rw->rmutex, 0, 1);
    sem_init(&rw->wmutex, 0, 1);
    sem_init(&rw->resource, 0, 1);
    rw->readcount = 0;
    rw->writecount = 0;
    rw->waiting_writers = 0;
}

void rwlock_acquire_readlock(rwlock_t *rw) {
    // Readers respect waiting writers by checking readTry
    sem_wait(&rw->readTry);
    sem_wait(&rw->rmutex);
    rw->readcount++;
    if (rw->readcount == 1) {
        // First reader acquires resource to block writers
        sem_wait(&rw->resource);
    }
    sem_post(&rw->rmutex);
    sem_post(&rw->readTry);
}

void rwlock_release_readlock(rwlock_t *rw) {
    sem_wait(&rw->rmutex);
    rw->readcount--;
    if (rw->readcount == 0) {
        // Last reader releases resource for waiting writers
        sem_post(&rw->resource);
    }
    sem_post(&rw->rmutex);
}

void rwlock_acquire_writelock(rwlock_t *rw) {
    // Writer notifies it is waiting to block new readers
    sem_wait(&rw->wmutex);
    rw->waiting_writers++;
    if (rw->waiting_writers == 1) {
        // First writer blocks new readers
        sem_wait(&rw->readTry);
    }
    sem_post(&rw->wmutex);
    
    // Writer acquires exclusive access to resource
    sem_wait(&rw->resource);
    
    // Mark writer as active (no longer waiting)
    sem_wait(&rw->wmutex);
    rw->writecount = 1;
    rw->waiting_writers--;
    sem_post(&rw->wmutex);
}

void rwlock_release_writelock(rwlock_t *rw) {
    // Writer releases exclusive access
    sem_post(&rw->resource);
    
    // Check if other writers are waiting
    sem_wait(&rw->wmutex);
    rw->writecount = 0;
    if (rw->waiting_writers == 0) {
        // No more waiting writers; re-enable readers
        sem_post(&rw->readTry);
    }
    sem_post(&rw->wmutex);
}
```

## Quiz 7 Answer Key Coverage

**a) Purpose of rmutex:** Protects access to readcount variable; ensures atomicity of read-increment/decrement operations.

**b) Purpose of wmutex:** Protects access to writecount and waiting_writers variables; ensures atomic updates.

**c) Purpose of readTry:** Controls whether new readers can enter the critical section; set to 0 by first waiting writer to block new readers, re-enabled by last writer.

**d) Purpose of resource:** The actual lock controlling resource access; first reader acquires it (blocks writers), last reader releases it; all writers acquire it exclusively.

**e) Why first reader calls sem_wait(&resource):** To block any writers from entering the critical section while readers are active.

**f) Why last reader calls sem_post(&resource):** To release the resource and allow waiting writers to acquire it and proceed.

**g) Why first writer calls sem_wait(&readTry):** To block new readers from entering; prevents more readers from starting while a writer is waiting.

**h) Why last writer calls sem_post(&readTry):** To re-enable readers now that all waiting writers have completed.

**i) Can readers starve in this implementation?** No. Readers wait on readTry when a writer is waiting (due to sem_wait(&readTry) in acquire_readlock). Once the writer completes, readTry is re-enabled, allowing waiting readers to proceed. There is no mechanism for continuous writer arrival to block readers forever.

**j) Three readers in reading section; writer arrives:** The writer increments waiting_writers to 1 and calls sem_wait(&readTry), setting it to 0. The three readers continue reading. When the last reader finishes, it calls sem_post(&resource), waking the writer. The writer then has exclusive access.

**k) Writer writing; reader arrives:** The reader calls sem_wait(&readTry) but it is held to 0 by the active writer (the writer incremented waiting_writers earlier). The reader blocks on readTry until the writer completes and calls sem_post(&readTry).

## Hand-trace example

Scenario: 2 readers reading, writer arrives, another reader arrives

| Step | R1 | R2 | W | Another R | readTry | resource | readcount | waiting_writers | Notes |
|------|----|----|----|---------|----|------|----------|---------|-------|
| 1 | wait(&readTry) | - | - | - | 1 | 1 | 0 | 0 | R1: proceed |
| 2 | readcount++ | - | - | - | 1 | 1 | 1 | 0 | R1: readcount=1 |
| 3 | wait(&resource) | - | - | - | 1 | 0 | 1 | 0 | R1: acquired resource |
| 4 | (reading) | wait(&readTry) | - | - | 1 | 0 | 1 | 0 | R2: proceed |
| 5 | (reading) | readcount++ | - | - | 1 | 0 | 2 | 0 | R2: readcount=2 |
| 6 | (reading) | (reading) | wait(&wmutex) | - | 1 | 0 | 2 | 0 | W: acquire wmutex |
| 7 | (reading) | (reading) | waiting_writers++ | - | 1 | 0 | 2 | 1 | W: waiting_writers=1 |
| 8 | (reading) | (reading) | wait(&readTry) BLOCKED | - | 0 | 0 | 2 | 1 | W: first writer, blocks readTry |
| 9 | (reading) | (reading) | (blocked) | wait(&readTry) BLOCKED | 0 | 0 | 2 | 1 | New R: blocked on readTry |
| 10 | release_readlock | (reading) | (blocked) | (blocked) | 0 | 0 | 1 | 1 | R1: readcount=1 (not last) |
| 11 | (done) | release_readlock | (blocked) | (blocked) | 0 | 0 | 0 | 1 | R2: readcount=0 (last), post resource |
| 12 | (done) | (done) | wait(&resource) returns | (blocked) | 0 | 1 | 0 | 0 | W: acquired resource, writing |
| 13 | (done) | (done) | (writing) | (blocked) | 0 | 1 | 0 | 0 | New R: still blocked on readTry |
| 14 | (done) | (done) | release_writelock | (blocked) | 1 | 0 | 0 | 0 | W: post resource, post readTry |
| 15 | (done) | (done) | (done) | wait(&readTry) returns | 0 | 0 | 1 | 0 | New R: now unblocked, readcount=1 |

## Common exam questions

- Compare reader preference vs. writer preference in terms of fairness and starvation.
- Trace the state of all semaphores during a scenario with multiple readers and a writer.
- Can both readers and writers be in the critical section simultaneously? Why or why not?
- Explain how readTry prevents reader starvation in writer-preference locks.
- Design a scenario where reader-preference locks fail (writer starvation) but writer-preference succeeds.

## Gotchas

- **Waiting writer count critical**: Must increment before blocking readers; decrement after acquiring resource
- **readTry not a binary semaphore**: Although conceptually 0 or 1, it's used as a counting semaphore in this design
- **Order of operations**: First writer must block readTry before others notice; must be careful with semaphore order
- **Last writer logic**: Must only re-enable readTry if no more writers are waiting
- **Reader starvation is impossible**: By design, readers never starve; they just wait for waiting writers

## Sources

- zhang__quizzes__Attendance Quiz 7.txt
- zhang__Reader-Writer+Problem+with+Condition+Variables.txt
- lectures__Week8_1.txt
