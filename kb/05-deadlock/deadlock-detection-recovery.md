# Deadlock Detection and Recovery

## Definition

Deadlock detection and recovery allows deadlocks to occur, then detects them and resolves them by killing one or more threads or rolling back state to a known safe point. Unlike prevention and avoidance, this approach does not try to make deadlock impossible; instead, it accepts deadlock as a runtime event and recovers from it.

## When to use

- In systems where deadlock is rare and the cost of recovery is acceptable.
- In database systems that use rollback mechanisms anyway (transactions with locks).
- When prevention and avoidance are too restrictive or expensive.
- In user-facing systems where killing a thread or asking the user to retry is tolerable.

## Key ideas

The approach has two phases:

1. **Detection**: Run a periodic detector that builds a resource-allocation graph (RAG) and checks for cycles. If a cycle exists, deadlock is detected.
2. **Recovery**: Kill one or more deadlocked threads, force them to release locks, and allow others to proceed. Alternatively, roll back their transactions and retry.

### Detection Algorithm

A resource-allocation graph has:
- Nodes: threads and locks
- Request edges: thread → lock (thread waiting for lock)
- Assignment edges: lock → thread (thread holds lock)

A cycle in the RAG indicates deadlock. The detector periodically:
1. Builds the RAG from current system state.
2. Checks for cycles using depth-first search or union-find.
3. If cycle found, triggers recovery.

### Recovery Strategies

1. **Process Termination**: Kill one or more deadlocked threads.
   - Victim selection: kill the thread that will cause least rollback cost.
   - Simplest approach but may lose work.

2. **Resource Preemption**: Forcibly remove locks from threads and roll back to a checkpoint.
   - Requires transaction support (like databases have).
   - More complex but preserves work partially.

3. **Partial Restart**: Kill the least-important thread in the cycle and restart it.
   - Balances simplicity with work preservation.

## Pseudocode

Detector running periodically:

```c
void deadlock_detector() {
    while (1) {
        // Sleep for a period
        sleep(DETECTION_INTERVAL);
        
        // Build current RAG
        rag_t rag = build_resource_allocation_graph();
        
        // Check for cycles
        if (has_cycle(rag)) {
            // Deadlock detected
            vector_t *cycle_threads = find_cycle_threads(rag);
            recover_from_deadlock(cycle_threads);
        }
    }
}

void recover_from_deadlock(vector_t *deadlocked_threads) {
    // Select a victim (simplest: kill the first one)
    thread_t *victim = select_victim(deadlocked_threads);
    
    // Kill victim and release its locks
    kill_thread(victim);  // forced termination
    
    // Other threads can now proceed
}
```

## Hand-trace example

Two threads in deadlock, detector runs:

| Step | T1 | T2 | L1 | L2 | RAG State |
|------|----|----|----|----|-----------|
| 1 | lock(L1) acquired | - | T1 | Free | T1→L1, no cycle |
| 2 | - | lock(L2) acquired | T1 | T2 | T1→L1, T2→L2, no cycle |
| 3 | lock(L2) wait | - | T1 | T2 | T1→L2, L2→T2, no cycle |
| 4 | - | lock(L1) wait | T1 | T2 | T2→L1, L1→T1, T1→L2, L2→T2 |
| **Cycle found** | (blocked) | (blocked) | T1 | T2 | **T1→L2→T2→L1→T1 is a cycle** |
| 5 | Detector runs, detects cycle | | T1 | T2 | Recovery triggered |
| 6 | T1 killed, L1 released | - | Free | T2 | T1 terminated |
| 7 | - | lock(L1) acquired | T2 | T2 | T2 now holds both, proceeds |
| 8 | - | [work completes] | Free | Free | T2 releases locks, finishes |

**Result**: Deadlock detected and recovered by killing T1.

## Common exam questions

- **MCQ:** In a resource-allocation graph (RAG) with one instance of each lock, what indicates deadlock?
  - [x] A directed cycle involving threads and locks (e.g., T1 → L2 → T2 → L1 → T1).
  - [ ] Any thread waiting for any lock.
  - [ ] More than N threads where N is the number of locks.
  - [ ] The graph being disconnected.
  - why: For single-instance resources, a cycle in the RAG is both necessary and sufficient for deadlock. Simply waiting for a lock is not deadlock unless the wait participates in a cycle.
- **MCQ:** How does detection-and-recovery differ from prevention?
  - [x] Detection allows deadlock to occur and resolves it afterward; prevention structurally eliminates one of the four Coffman conditions so deadlock is impossible.
  - [ ] Detection breaks circular wait; prevention breaks mutual exclusion.
  - [ ] Detection requires trylock; prevention uses blocking locks.
  - [ ] Detection is deterministic; prevention uses randomness.
  - why: Detection is reactive: it accepts deadlock as a runtime event and recovers via victim selection. Prevention is proactive: it removes one condition (ordering, all-at-once, trylock, CAS) so no deadlock ever forms.
- **MCQ:** What is the main trade-off of running the deadlock detector very frequently?
  - [x] More CPU spent building the RAG and scanning for cycles even when no deadlock exists.
  - [ ] Higher likelihood of livelock.
  - [ ] Loss of mutual exclusion.
  - [ ] Inability to recover deadlocks that do occur.
  - why: Cycle detection is O(V+E) per run. Frequent runs catch deadlocks quickly but waste cycles when the system is healthy; infrequent runs save CPU but let deadlocks persist longer.
- **MCQ:** In recovery, what does "process termination" mean?
  - [x] Killing one or more threads in the deadlock cycle so their locks are released and the remaining threads can proceed.
  - [ ] Shutting the whole OS down and rebooting.
  - [ ] Removing the thread from the scheduler queue but keeping its locks.
  - [ ] Running the thread to completion while ignoring the cycle.
  - why: The simplest recovery is victim selection: pick a thread in the cycle, force it to exit, and free its locks. Other threads then make progress. The killed thread loses uncommitted work.
- **MCQ:** Why is detection-and-recovery well-suited to database systems?
  - [x] Databases already have transaction rollback, so aborting a deadlocked transaction is cheap and restores a consistent state.
  - [ ] Databases do not use locks at all.
  - [ ] Databases can predict every lock request in advance.
  - [ ] Databases only run single-threaded.
  - why: DBMSs log operations so rollback is a built-in primitive. Choosing a victim transaction, aborting it, and restarting has low extra cost. In contrast, a C program killed mid-state loses work unrecoverably.
- **MCQ:** Why is detection-and-recovery generally unsuitable for real-time systems?
  - [x] Unpredictable detection intervals and recovery pauses violate real-time deadlines.
  - [ ] Real-time systems never use locks.
  - [ ] Cycle detection always takes exponential time.
  - [ ] Real-time kernels cannot build resource graphs.
  - why: Real-time systems demand bounded worst-case response times. Allowing deadlock and then stalling arbitrarily for detection and victim selection introduces latency spikes that break hard deadlines.

## Gotchas

- **Overhead of periodic detection**: Running the detector too frequently wastes CPU; too infrequently allows deadlock to persist. Tuning the interval is a trade-off.
- **Victim selection is non-deterministic**: Killing an arbitrary thread may not be the best choice. Optimal victim selection is NP-hard.
- **Lost work**: Killing a thread loses any uncommitted state. If the thread was in the middle of an important operation, results are discarded.
- **Starvation**: A frequently-killed thread may starve or never make progress if it keeps being selected as victim. Fair victim selection is hard.
- **Not suitable for real-time systems**: Unpredictable deadlock and recovery delays are unacceptable for real-time constraints.
- **Cycle detection complexity**: Building the RAG and checking for cycles is O(V + E) per check. With many threads and locks, this becomes expensive.

## Sources

- Operating Systems: Three Easy Pieces, Chapter 32 (Zhang), pages 28–29 (Deadlock detection and recovery)
- COP 4600 Week 9_1 Lecture Slides, pages 26–27 (Detect and recover, periodic detector, resource graph, cycle checking)

