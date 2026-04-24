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

- **MCQ:** Which of the following is NOT shared between threads in the same process?
  - [x] Stack
  - [ ] Heap
  - [ ] Code (text segment)
  - [ ] Global data
  - why: Each thread has its own stack (local variables, return addresses); heap, code, and globals all live in the shared address space.

- **MCQ:** Why is a thread-to-thread context switch typically cheaper than a process-to-process switch?
  - [x] The address space (page tables, TLB state) does not change, only registers and stack
  - [ ] Threads share a single register file
  - [ ] The kernel skips saving the program counter
  - [ ] Threads bypass the scheduler
  - why: Same-process switches avoid reloading page-table state and flushing TLB entries, which dominate cross-process switch cost.

- **MCQ:** What does a Thread Control Block (TCB) minimally contain?
  - [x] The thread's saved registers and program counter
  - [ ] A complete copy of the address space
  - [ ] The process's file descriptor table
  - [ ] The kernel stack for every other thread
  - why: Per-thread state is the CPU context (registers + PC) and a pointer to its stack; the address space is shared via the containing process.

- **MCQ:** Two threads in one process share memory. What is the immediate implication?
  - [x] Unsynchronized access to shared variables can race and corrupt data
  - [ ] They cannot communicate without pipes
  - [ ] They must share a single stack
  - [ ] They must run on the same CPU
  - why: Shared memory enables fast communication but removes the isolation that processes get, so synchronization is the programmer's job.

- **MCQ:** Which scenario favors processes over threads?
  - [x] Security isolation so one component's crash cannot corrupt another's memory
  - [ ] Maximum cache locality between concurrent tasks
  - [ ] Fine-grained parallelism on a small shared data structure
  - [ ] Lowest possible creation and switch overhead
  - why: Processes have separate address spaces, providing fault and security isolation at the cost of more expensive communication.

- **MCQ:** A stack overflow in thread T1 can corrupt T2's stack when:
  - [x] Their stacks happen to be adjacent in the shared address space and guard pages are missing/insufficient
  - [ ] Never, because thread stacks are isolated
  - [ ] Only on 32-bit systems
  - [ ] Only if T1 and T2 share a file descriptor
  - why: Thread stacks live in the same address space; without guard pages, an overflow in one can step into a neighbor's stack region.

## Gotchas

- Threads do NOT have separate address spaces; shared memory access requires synchronization
- Don't confuse OS-level threads with user-level threads; this course covers OS threads (pthreads)
- Stack overflow in one thread can corrupt another thread's stack if they're adjacent in memory
- Thread creation is cheaper than process creation, but doesn't eliminate context-switch cost

## Sources

- lectures__Week6_1.txt
- lectures__Week6_2.txt
