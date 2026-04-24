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

- **MCQ:** Which three responsibilities are commonly called the "three easy pieces" of an operating system?
  - [x] Virtualization, concurrency, and persistence
  - [ ] Compilation, linking, and loading
  - [ ] Networking, graphics, and scheduling
  - [ ] Booting, shutdown, and logging
  - why: OSTEP organizes the course around these three pillars: virtualizing hardware, managing concurrent execution safely, and persisting data reliably across crashes.

- **MCQ:** What is the core difference between a system call and a regular function call?
  - [x] A system call crosses from user mode to kernel mode via a trap; a regular call stays at the same privilege level
  - [ ] A system call is always slower because it is written in Python
  - [ ] A regular function call cannot return a value, but a system call can
  - [ ] System calls run only at boot; regular calls run only after login
  - why: The defining distinction is the privilege-level transition via a trap instruction. That mode switch is also why syscalls are measurably more expensive than plain function calls.

- **MCQ:** Why must the OS prevent user-mode code from executing privileged instructions?
  - [x] To uphold isolation, protection, and resource control across processes
  - [ ] Because privileged instructions run slower than normal ones
  - [ ] To reduce the size of the trap table
  - [ ] Because user-mode code cannot be compiled to use them
  - why: If user code could disable interrupts, rewrite page tables, or poke I/O ports, one buggy or malicious program could commandeer the whole machine. Hardware-enforced privilege is the backbone of OS protection.

- **MCQ:** Which of the following is an abstraction the OS provides to applications?
  - [x] The file as a persistent, named sequence of bytes, hiding block allocation and disk geometry
  - [ ] The transistor count of the CPU
  - [ ] The exact layout of cache lines on the processor
  - [ ] Direct control over the system's interrupt controller
  - why: The OS abstracts away hardware detail so programs do not have to manage blocks, sectors, or interrupt controllers directly. Low-level hardware details are intentionally hidden.

- **MCQ:** Which statement about the kernel and the OS is most accurate?
  - [x] The kernel is the privileged core component; the OS as a whole also includes shells, libraries, and utilities
  - [ ] Kernel and OS are synonyms with no meaningful distinction
  - [ ] The kernel runs in user mode while the rest of the OS runs in kernel mode
  - [ ] The kernel is a user-space daemon started after boot
  - why: The kernel is only the privileged, hardware-managing core. Commonly the "OS" also includes shells, standard libraries, drivers, and system utilities, most of which run in user space.

- **MCQ:** Which system call creates a new process as a duplicate of the caller?
  - [x] `fork()`
  - [ ] `execv()`
  - [ ] `exit()`
  - [ ] `open()`
  - why: `fork()` duplicates the caller, producing a child with its own copy of the address space. `execv()` replaces the current program image, `exit()` terminates a process, and `open()` opens a file.

- **MCQ:** Which problem does memory virtualization primarily solve?
  - [x] Giving each process a private address space while multiplexing a single shared physical RAM
  - [ ] Making the disk faster than RAM
  - [ ] Eliminating the need for a CPU scheduler
  - [ ] Guaranteeing every program fits in L1 cache
  - why: Memory virtualization provides isolation and simple per-process addressing while the kernel and MMU share physical RAM safely among all processes.

- Explain how the three pieces (virtualization, concurrency, persistence) combine to let multiple programs run simultaneously and store data reliably.

## Gotchas

- The OS is not the operating system's kernel; the OS is the whole software system including shells, standard libraries, device drivers, and the kernel itself. The kernel is the core privileged component that manages the hardware.
- A process's virtual address space does not exist "in" physical memory; it is a translation performed by the MMU (memory management unit) in hardware, with the kernel maintaining the page tables that describe the translation.
- System calls are not direct library calls; they require a mode switch and context switch, adding measurable overhead. This is why high-frequency operations sometimes avoid system calls (e.g., buffering I/O).

## Sources

- lectures__Week1.txt
- lectures__OS_intro_Spring26.txt
