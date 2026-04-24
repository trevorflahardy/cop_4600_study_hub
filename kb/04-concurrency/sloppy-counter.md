# Sloppy Counter

## Definition

A **sloppy counter** (approximate counting) is a concurrent data structure designed for high-performance counting under contention. Instead of a single global counter protected by one lock, it maintains multiple per-CPU (or per-thread) local counters and a global counter, reducing lock contention by distributing updates across multiple locks.

## When to use

Use sloppy counters in high-concurrency systems where many threads are incrementing a counter. The trade-off is accuracy (the value may be out of date) for throughput. Ideal for statistics collection, monitoring, and other scenarios where approximate counts are acceptable.

## Key ideas

- **Fine-grained locking**: Multiple local locks instead of one global lock
- **Read-modify-write distribution**: Each CPU has its own counter to avoid lock contention
- **Staleness**: The global value may lag behind actual activity
- **Threshold S**: Local counters update the global counter every S increments
- **Accuracy vs. performance**: Higher S gives better performance but less accurate counts
- **Per-CPU locality**: Each thread/CPU works mostly with its local counter, improving cache behavior

## Pseudocode

Simple sloppy counter:
```
typedef struct {
    int global;          // global counter (lock-protected)
    int local[CPUS];     // per-CPU local counters (separately locked)
    int locks[CPUS];     // one lock per CPU local counter
} sloppy_counter_t;

void init(sloppy_counter_t *c) {
    c->global = 0;
    for (int i = 0; i < CPUS; i++) {
        c->local[i] = 0;
        c->locks[i] = 0;
    }
}

void increment(sloppy_counter_t *c) {
    int cpu = get_cpu();  // determine current CPU
    lock(&c->locks[cpu]);
    c->local[cpu]++;
    
    if (c->local[cpu] >= THRESHOLD) {
        // Periodically flush local to global
        lock(&c->global_lock);
        c->global += c->local[cpu];
        c->local[cpu] = 0;
        unlock(&c->global_lock);
    }
    unlock(&c->locks[cpu]);
}

int get_value(sloppy_counter_t *c) {
    int global_copy;
    lock(&c->global_lock);
    global_copy = c->global;
    unlock(&c->global_lock);
    
    // Add up all local counters
    int total = global_copy;
    for (int i = 0; i < CPUS; i++) {
        lock(&c->locks[i]);
        total += c->local[i];
        unlock(&c->locks[i]);
    }
    return total;
}
```

## Hand-trace example

Sloppy counter with 2 CPUs, THRESHOLD=3:

| Step | CPU0 operation | CPU1 operation | local[0] | local[1] | global | Notes |
|------|----------------|----------------|----------|----------|--------|-------|
| 1 | increment() | - | 1 | 0 | 0 | CPU0: local[0]++ |
| 2 | increment() | increment() | 2 | 1 | 0 | Both increment local |
| 3 | increment() | increment() | 3 | 2 | 0 | CPU0 at threshold |
| 4 | flush to global | (waiting) | 0 | 2 | 3 | CPU0: global+=3, reset local |
| 5 | (done) | increment() | 0 | 3 | 3 | CPU1 at threshold |
| 6 | - | flush to global | 0 | 0 | 6 | CPU1: global+=3, reset local |
| 7 | get_value() | - | 0 | 0 | 6 | Read global = 6 (accurate) |

Later scenario (get_value called mid-operation):

| Step | Event | local[0] | local[1] | global | Total (from get_value) |
|------|-------|----------|----------|--------|--------|
| 1 | CPU0 increment 3 times | 3 | 0 | 0 | 3 |
| 2 | CPU1 increment 2 times | 3 | 2 | 0 | 5 |
| 3 | get_value() called | 3 | 2 | 0 | 0 + 3 + 2 = 5 (accurate) |
| 4 | CPU0 flush | 0 | 2 | 3 | |
| 5 | CPU1 flush | 0 | 0 | 5 | |
| 6 | get_value() again | 0 | 0 | 5 | 5 (still accurate) |

Staleness example (local not yet flushed):

| Step | Event | local[0] | local[1] | global |
|------|-------|----------|----------|--------|
| 1 | CPU0 increments 2x | 2 | 0 | 0 |
| 2 | CPU1 increments 2x | 2 | 2 | 0 |
| 3 | get_value() called | 2 | 2 | 0 | Reads 0 + 2 + 2 = 4 (correct) |

But if get_value only reads global without locals:

| Step | Event | local[0] | local[1] | global | get_value reading just global |
|------|-------|----------|----------|--------|--------|
| 1 | CPU0/1 accumulate locally | 2 | 2 | 0 | Returns 0 (stale!) |

## Common exam questions

- **MCQ:** What is the main reason a sloppy counter scales better than a single lock-protected counter?
  - [x] Per-CPU local counters let most increments avoid the global lock
  - [ ] It uses lock-free CAS, eliminating locking entirely
  - [ ] It rounds increments to the nearest power of two for speed
  - [ ] It disables interrupts during counting
  - why: Each CPU mostly hits its own local counter and local lock; the global lock is only touched every THRESHOLD increments.

- **MCQ:** What is the effect of increasing the THRESHOLD S?
  - [x] Fewer global-lock acquisitions (higher throughput) at the cost of staler global values
  - [ ] More accurate global values at the cost of throughput
  - [ ] Fewer total increments because some are dropped
  - [ ] Guaranteed wait-free progress
  - why: Larger S means local counters accumulate longer before flushing, reducing global-lock traffic but allowing the global view to lag by up to S per CPU.

- **MCQ:** Why must `get_value` read both the global AND the per-CPU local counters?
  - [x] Unflushed increments live in the locals; reading only global gives a stale answer
  - [ ] The global counter can be corrupted without the locals
  - [ ] Reading both is required by POSIX
  - [ ] The locals are more up-to-date than the global so the global is ignored
  - why: An increment first updates its local, and only flushes to global when local hits S; any value still sitting in a local must be summed in.

- **MCQ:** With 4 CPUs and THRESHOLD=3, what is the maximum divergence between a `get_value` that reads only `global` and the true count?
  - [x] Up to 4 * (3-1) = 8 increments may be unflushed
  - [ ] Exactly 3 increments
  - [ ] Exactly 12 increments
  - [ ] Zero; global is always exact
  - why: Each local can hold up to S-1 un-flushed increments; across N CPUs that is N*(S-1) hidden updates.

- **MCQ:** When does a per-CPU local counter flush to the global?
  - [x] When the local reaches the threshold S
  - [ ] On every increment, under a write-through policy
  - [ ] When `get_value` is called
  - [ ] Only when the CPU is about to context-switch
  - why: The code compares `local >= THRESHOLD` on each increment, and only then grabs the global lock to add and reset.

- **MCQ:** Which workload is LEAST appropriate for a sloppy counter?
  - [x] Enforcing a strict limit where exact counts are required (e.g., exactly 100 allocations allowed)
  - [ ] Aggregate statistics with many concurrent writers
  - [ ] Per-CPU performance counters
  - [ ] Approximate reference counts for cache hits
  - why: Sloppy counters deliberately trade accuracy for throughput; hard limits that depend on exact counts will be violated because of unflushed locals.

## Gotchas

- **Incomplete get_value()**: Simply reading global without reading locals gives stale values
- **Overflow potential**: If local counters aren't flushed before overflowing, updates are lost (though threshold prevents this)
- **THRESHOLD tuning**: Too small = frequent flushes (more global lock contention); too large = stale reads
- **Not suitable for all use cases**: When you need exact, up-to-date counts, sloppy counters don't work
- **CPU affinity assumption**: If threads migrate across CPUs frequently, benefits diminish
- **Negative reads possible**: If not implemented carefully, get_value() could return a value less than a concurrent increment

## Sources

- lectures__Week7_1.txt (inferred from data structure patterns)
- zhang__Chapter+29+Lock-based+Concurrent+Data+Structures+v2.txt
