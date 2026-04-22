# What Is an Operating System?

## Definition

An operating system is a software layer that abstracts hardware complexity and manages system resources by virtualizing the CPU and memory, enforcing concurrency safety, and handling persistent storage. It presents applications with a simplified, uniform interface—the system call API—and protects running processes from interfering with one another.

## When to use

- When explaining why applications don't need to know the details of the underlying hardware.
- When discussing why a program can be run on multiple computers without modification.
- When breaking down the OS into its three primary responsibilities (virtualization, concurrency, persistence).
- When introducing the system call as the boundary between user and kernel privilege levels.

## Key ideas

The operating system solves two fundamental problems: **complexity** and **resource contention**.

**Complexity.** Hardware is complicated. A modern CPU has caches, memory protection registers, interrupt controllers, and a privileged mode. Physical memory is fragmented and limited. Disks are slow and mechanical (or now flash, but still fundamentally different from RAM). Rather than force every application programmer to understand this machinery, the OS presents **abstractions**:

- **CPU virtualization** makes it appear that each process has its own dedicated processor, when in reality the kernel schedules many processes on a single (or few) physical CPUs.
- **Memory virtualization** gives each process a private address space starting at address zero, even though processes share a single block of physical RAM. The kernel uses page tables and MMU hardware to enforce this illusion. Example from `mem.c`: two separate processes both print the address `0x00200000` for their data, yet each sees different values—they are looking at different physical memory locations.
- **Persistence** abstracts the disk as a reliable file system, hiding low-level block allocation and crash recovery.

**Resource contention.** Multiple applications may run simultaneously and want to use the CPU, memory, and I/O devices. The OS acts as a resource manager, deciding which process gets the CPU next (scheduling), how much memory each process can use (memory management), and ensuring one process cannot read or corrupt another's data (isolation and protection).

The **system call interface** is the API through which applications request OS services. When a process calls `open()`, `read()`, `write()`, `fork()`, `exec()`, or `exit()`, it crosses from unprivileged user mode into privileged kernel mode, where the OS can enforce policy and manage resources.

## Common exam questions

- What are the three easy pieces of an operating system, and why does each one matter?
- How does memory virtualization allow two processes to use the same address (e.g., `0x00200000`) simultaneously?
- What is the difference between a system call and a regular function call, in terms of privilege level and CPU mode?
- Why must the OS prevent user-mode code from executing privileged instructions?
- Name three examples of system calls and explain what each one does at the OS level.

## Gotchas

- The OS is not the operating system's kernel; the OS is the whole software system including shells, standard libraries, device drivers, and the kernel itself. The kernel is the core privileged component that manages the hardware.
- A process's virtual address space does not exist "in" physical memory; it is a translation performed by the MMU (memory management unit) in hardware, with the kernel maintaining the page tables that describe the translation.
- System calls are not direct library calls; they require a mode switch and context switch, adding measurable overhead. This is why high-frequency operations sometimes avoid system calls (e.g., buffering I/O).

## Sources

- lectures__Week1.txt
- lectures__OS_intro_Spring26.txt
