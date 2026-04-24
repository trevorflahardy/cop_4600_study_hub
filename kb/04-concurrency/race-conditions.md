# Race Conditions

## Definition

A race condition occurs when the final result of concurrent execution depends on the order in which threads execute, and the correct behavior requires a specific execution order. Multiple threads access and modify shared data without synchronization, leading to unpredictable or incorrect results.

## When to use

Understanding race conditions is essential when designing any multi-threaded system. You don't "use" them—you identify and eliminate them by adding proper synchronization (locks, condition variables, etc.).

## Key ideas

- **Non-atomicity**: Multiple instructions that should execute together get interleaved
- **Timing dependency**: The outcome depends on thread scheduling, not just logic
- **Non-determinism**: The same code can produce different results on different runs
- **Example**: `counter = counter + 1` takes 3 instructions (load, increment, store), and each can be interrupted

## Pseudocode

Broken code that exhibits a race condition:
```
counter = 50  // shared variable

Thread 1:
  mov  counter, %eax    // load counter into register (value: 50)
  add  $1, %eax         // increment (value: 51)
  [INTERRUPT HERE]
  mov  %eax, counter    // store back

Thread 2 (runs in middle of Thread 1):
  mov  counter, %eax    // load counter (still 50, because Thread 1 hasn't stored yet)
  add  $1, %eax         // increment (value: 51)
  mov  %eax, counter    // store back (value: 51)

Thread 1 (resumes):
  mov  %eax, counter    // store 51 (overwrites Thread 2's result)

Final result: 51 (should be 52)
```

## Hand-trace example

Two threads, each executing `counter++` once, starting from `counter = 50`:

| Step | Thread 1 | Thread 2 | counter | Notes |
|------|----------|----------|---------|-------|
| 1 | load counter → eax | - | 50 | T1 loads 50 |
| 2 | add $1, eax | - | 50 | T1 eax = 51 |
| 3 | interrupt | resume | 50 | Switch to T2 |
| 4 | - | load counter → eax | 50 | T2 loads 50 |
| 5 | - | add $1, eax | 50 | T2 eax = 51 |
| 6 | - | store eax → counter | 51 | T2 stores 51 |
| 7 | resume | - | 51 | Back to T1 |
| 8 | store eax → counter | - | 51 | T1 stores 51 (lost T2's update) |

Expected: 52; Actual: 51

## Common exam questions

- **MCQ:** Why does `counter++` produce a race condition despite looking like one operation?
  - [x] It compiles to a load, modify, and store, each of which can be interrupted by another thread
  - [ ] The `++` operator is undefined behavior in multithreaded code
  - [ ] The compiler is allowed to duplicate it multiple times
  - [ ] The value can exceed the integer range
  - why: At the machine level it is three instructions; a context switch between load and store lets another thread read the same old value.

- **MCQ:** Two threads each run `counter++` once starting from 50. What is the worst-case final value?
  - [x] 51 (one update is lost)
  - [ ] 50 (both updates are lost)
  - [ ] 52 (correct)
  - [ ] 100 (undefined)
  - why: Both threads can load 50, both compute 51, and both store 51 — one increment is overwritten.

- **MCQ:** Which statement best describes why race conditions are hard to reproduce in testing?
  - [x] They depend on specific thread interleavings that may rarely occur on a given platform
  - [ ] They only occur when `-O2` optimization is enabled
  - [ ] They require at least 8 CPU cores
  - [ ] They only manifest after millions of iterations
  - why: The bug is latent in the code; whether it surfaces depends on the nondeterministic schedule chosen at runtime.

- **MCQ:** Can a race condition occur on a single-CPU system?
  - [x] Yes, because preemption can interrupt a thread mid-sequence and schedule another
  - [ ] No, single-CPU systems execute one instruction at a time atomically
  - [ ] Only if interrupts are disabled
  - [ ] Only during I/O
  - why: Multithreading on a single CPU interleaves threads via preemption; the load/modify/store sequence can still be split across a context switch.

- **MCQ:** Which mechanism correctly eliminates the `counter++` race?
  - [x] Protect the increment with a lock (or use an atomic add instruction)
  - [ ] Declare `counter` as `volatile`
  - [ ] Sleep between the read and write
  - [ ] Use a local variable copy inside each thread
  - why: Locks (or hardware atomic RMW) make the three-step sequence appear indivisible, which is exactly the missing property.

- **MCQ:** Which of the following statements about race conditions is TRUE?
  - [x] A program with a race can appear correct on many runs yet still be buggy
  - [ ] Race conditions always cause crashes
  - [ ] A race condition requires at least 3 threads to manifest
  - [ ] A race condition can only occur on writes, never on reads mixed with writes
  - why: Because races are timing-dependent, a "lucky" schedule may produce correct output; the bug is still present and will manifest eventually.

## Gotchas

- Race conditions are **not guaranteed to happen**; they depend on timing, making them hard to reproduce
- High-level languages hide the multi-instruction nature; students often think `counter++` is one instruction
- Not all interleavings cause a race condition—only certain interleavings violate correctness
- A program with a race condition may pass tests if the "lucky" interleaving doesn't occur

## Sources

- lectures__Week6_1.txt
- zhang__Chapter+28+Locks+v6.txt
