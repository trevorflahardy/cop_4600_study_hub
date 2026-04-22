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

- How does time-sharing of the CPU create the illusion that each process has its own processor?
- What role does the timer interrupt play in CPU virtualization?
- Explain how two processes can have data at the same virtual address (e.g., `0x00200000`) but read different values.
- What would happen if two processes were allowed to use the same physical memory address directly?
- How does the memory management unit (MMU) convert a virtual address to a physical address?

## Gotchas

- Virtual address ≠ physical address. Confusing the two is a common mistake. Virtual addresses are private per process; physical addresses are the actual location in RAM.
- The page table is not a simple lookup table; it is a hierarchical data structure (typically a tree or inverted table) that maps ranges of virtual addresses to physical addresses and metadata.
- Virtualization is not free. Address translation on every memory access adds latency. Caches (TLB, L1/L2 caches) mitigate this, but switching between processes incurs a TLB flush and cache misses.
- The physical memory is a finite resource shared among all processes. If too many processes are running, the kernel may need to swap memory to disk (paging), causing severe slowdowns.

## Sources

- lectures__Week1.txt
