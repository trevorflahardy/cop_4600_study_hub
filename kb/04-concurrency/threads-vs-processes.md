# Threads vs Processes

## Definition

A **process** is a complete program execution environment with its own address space, including code, heap, and stack. A **thread** is a lightweight execution unit within a single process that shares the address space with other threads but maintains its own program counter, registers, and stack.

## When to use

Use **processes** when isolation is critical (security, stability, fault tolerance) or when running completely independent programs. Use **threads** when you need lightweight concurrency with shared data access, such as handling multiple client requests in a web server or parallel computation with shared work queues.

## Key ideas

- **Process**: Isolation = safety but expensive context switches; requires IPC (pipes, sockets) for communication
- **Thread**: Low overhead, shared memory enables fast communication, but risks race conditions and synchronization bugs
- **Thread Control Block (TCB)**: Each thread has its own TCB storing program counter and registers
- **Address space sharing**: All threads in a process share code, heap, global data; each has its own stack
- **Context switching**: Switching between threads requires saving/restoring register state but NOT address space

## Pseudocode

Not applicable for conceptual distinction.

## Hand-trace example

**Single-threaded process:**
- One PC, one execution flow
- Sequential execution with single stack

**Multi-threaded process:**
- Two threads: T1 and T2
- T1: PC at instruction 100, stack from 16KB–15KB
- T2: PC at instruction 50, stack from 14KB–13KB
- Shared heap at 2KB, shared code at 1KB
- Context switch: save T1's registers, restore T2's registers, continue at T2's PC

## Common exam questions

- Explain the memory layout differences between a single-threaded and multi-threaded process.
- What information is stored in a Thread Control Block (TCB)?
- Why is context switching between threads faster than between processes?
- Describe a scenario where using threads is preferable to using processes.
- Can two threads in the same process interfere with each other's execution? Why or why not?

## Gotchas

- Threads do NOT have separate address spaces; shared memory access requires synchronization
- Don't confuse OS-level threads with user-level threads; this course covers OS threads (pthreads)
- Stack overflow in one thread can corrupt another thread's stack if they're adjacent in memory
- Thread creation is cheaper than process creation, but doesn't eliminate context-switch cost

## Sources

- lectures__Week6_1.txt
- lectures__Week6_2.txt
