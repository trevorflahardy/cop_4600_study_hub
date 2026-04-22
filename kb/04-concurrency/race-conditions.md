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

- Give an example of a race condition and explain why it occurs.
- Why do high-level operations like `counter++` need atomic protection even though they look like single statements?
- Describe the role of preemption (interrupts) in creating race conditions.
- How would you prevent the race condition in the `counter++` example?
- Can race conditions occur on a single-CPU system? Why or why not?

## Gotchas

- Race conditions are **not guaranteed to happen**; they depend on timing, making them hard to reproduce
- High-level languages hide the multi-instruction nature; students often think `counter++` is one instruction
- Not all interleavings cause a race condition—only certain interleavings violate correctness
- A program with a race condition may pass tests if the "lucky" interleaving doesn't occur

## Sources

- lectures__Week6_1.txt
- zhang__Chapter+28+Locks+v6.txt
