# The Virtualization Abstraction

## Definition

Virtualization is the OS's core technique for multiplexing physical hardware resources among multiple processes. Each process sees a private, isolated view of the CPU and memory—even though all processes share the same underlying hardware—via time-sharing (for CPU) and address translation (for memory).

## When to use

- When explaining why one process's crash should not crash the entire system.
- When discussing the performance cost of switching between processes.
- When introducing the need for page tables and memory management hardware.
- When analyzing why memory addresses in different processes can be the same value but refer to different physical locations.
- When explaining the illusion that each process has its own CPU.

## Key ideas

**CPU virtualization** allows multiple processes to run "in parallel" on a single CPU. In reality, the OS uses a scheduler to multiplex the CPU: run process A for a time slice, then save its state (registers, program counter), restore process B's state, and run B. To the user, both processes appear to be running simultaneously, but only one is executing on the CPU at any moment. The key mechanism is the **timer interrupt**—a hardware timer that fires at regular intervals (e.g., every 10 milliseconds), forcing the kernel to regain control and decide which process runs next.

**Memory virtualization** creates the fiction that each process has a private address space. When a process reads or writes to address `0x00200000`, it is not directly accessing physical memory at `0x00200000`. Instead, the CPU's **memory management unit (MMU)** translates the virtual address to a physical address using a **page table** maintained by the OS kernel. Two separate processes can both refer to virtual address `0x00200000` and the MMU will translate them to different physical addresses.

A concrete example from `mem.c`: when you run the program twice, each instance prints that its data is at address `0x00200000`. If you inspect the actual physical memory at that location in the two processes, you will see different values. Each process genuinely believes it owns address space starting at zero; the kernel's page tables ensure they do not interfere.

Why is this worth the overhead? **Isolation and simplicity.** The application programmer does not need to know about other processes or negotiate memory layout. Each program is written as if it owns the machine. The OS enforces protection: if process A tries to access memory that belongs to process B, the MMU raises a hardware exception (a fault), and the kernel terminates the rogue process. This prevents bugs and malicious code from corrupting other applications' data.

## Common exam questions

- **MCQ:** How does the OS give each process the illusion of its own dedicated CPU?
  - [x] By time-sharing: rapidly saving/restoring process state and scheduling them in turn on the physical CPU
  - [ ] By physically duplicating the CPU hardware for each process
  - [ ] By running each process only when no other process exists
  - [ ] By executing all processes simultaneously on one core through parallel instruction issue
  - why: A single CPU can execute only one instruction stream at a time, so the OS multiplexes via context switches. Processes appear concurrent because switches are fast relative to human perception.

- **MCQ:** Two processes each print that their data lives at virtual address `0x00200000`, yet they read different values. Why?
  - [x] Each process has its own page table, so the MMU maps the same virtual address to different physical frames
  - [ ] One of the processes is lying about its address
  - [ ] The CPU caches hide the real address from user code
  - [ ] The OS writes both values into the same physical location and reads randomly
  - why: Memory virtualization gives each process a private virtual address space. The MMU consults the currently active page table during translation, so identical virtual addresses point to distinct physical frames.

- **MCQ:** What role does the timer interrupt play in CPU virtualization?
  - [x] It periodically returns control to the kernel so the scheduler can enforce time slices
  - [ ] It speeds up user code by increasing the CPU clock
  - [ ] It flushes the page table on every tick
  - [ ] It guarantees each instruction takes exactly one microsecond
  - why: Without a timer, a process that never makes a syscall would run forever. The timer is what makes preemptive time-sharing possible.

- **MCQ:** Which hardware component is responsible for translating a virtual address to a physical address?
  - [x] The memory management unit (MMU), using the page table
  - [ ] The CPU scheduler in software
  - [ ] The DMA controller
  - [ ] The disk controller
  - why: The MMU performs translation on every memory reference using the page table set up by the kernel. Software translation on each access would be prohibitively slow.

- **MCQ:** Which of the following is a true cost of virtualization?
  - [x] Context switches cause TLB flushes and cache misses, and address translation adds latency
  - [ ] Virtualization requires copying the entire address space to disk on every access
  - [ ] Virtual memory eliminates all cache hits
  - [ ] The MMU must be recompiled for each process
  - why: Virtualization is not free: each switch cools caches and TLBs, and translation itself costs cycles. Caches and TLBs mitigate but do not eliminate this overhead.

- **MCQ:** If two processes were allowed to write directly to the same physical memory address with no virtualization, what would happen?
  - [x] They could corrupt each other's data, breaking isolation and enabling hostile interference
  - [ ] The CPU would automatically merge their writes
  - [ ] Performance would improve because no translation is needed
  - [ ] The OS would no longer need a scheduler
  - why: Virtualization exists precisely to prevent uncoordinated sharing. Without it, any process could stomp on any other's data, making safe multi-programming impossible.

- **MCQ:** What triggers when a process accesses memory that is not mapped in its page table?
  - [x] The MMU raises a fault that traps into the kernel for handling
  - [ ] The access silently returns zero
  - [ ] The CPU reboots
  - [ ] The scheduler moves the process to the ready queue
  - why: Unmapped accesses raise a page fault exception. The kernel then decides to load the page, grow the stack, or kill the process depending on the cause.

- Describe, end to end, how the OS uses CPU time-sharing and MMU address translation together to give each process the illusion of a private machine.

## Gotchas

- Virtual address ≠ physical address. Confusing the two is a common mistake. Virtual addresses are private per process; physical addresses are the actual location in RAM.
- The page table is not a simple lookup table; it is a hierarchical data structure (typically a tree or inverted table) that maps ranges of virtual addresses to physical addresses and metadata.
- Virtualization is not free. Address translation on every memory access adds latency. Caches (TLB, L1/L2 caches) mitigate this, but switching between processes incurs a TLB flush and cache misses.
- The physical memory is a finite resource shared among all processes. If too many processes are running, the kernel may need to swap memory to disk (paging), causing severe slowdowns.

## Sources

- lectures__Week1.txt
