# Traps, Interrupts, and System Calls

## Definition

A **trap** is a synchronous exception triggered by a running process (e.g., a system call or illegal operation); an **interrupt** is an asynchronous signal from hardware that forces the CPU to pause the current process and handle the event; a **system call** is a trap instruction that a user process deliberately executes to request an OS service. All three cause a transition to kernel mode via a **trap table**—a data structure the OS sets up at boot time that maps exception/interrupt types to kernel handler routines.

## When to use

- When explaining how the OS regains control of the CPU after user code is running.
- When distinguishing between user-initiated system calls and hardware-generated interrupts.
- When analyzing the sequence of events during a timer interrupt or I/O interrupt.
- When discussing how the trap table vectors control to the correct kernel handler.
- When examining the disabling of interrupts during critical OS operations.

## Key ideas

**Traps** are synchronous: they are caused by the instruction currently executing. Examples:

- A **system call**: the user process executes `int 0x80` (on x86) or `syscall` (on modern x86-64), explicitly requesting the OS to do something. The trap instruction includes an argument (in a register) specifying which service is wanted.
- An **illegal instruction**: the user process executes a privileged instruction (e.g., modifying the page table), which the CPU detects and raises a trap.
- A **page fault**: the user process accesses a virtual address that is not currently mapped in its page table. The MMU detects this and raises a trap, allowing the kernel to handle the fault (e.g., load the page from disk, or terminate the process if the access is invalid).

**Interrupts** are asynchronous: they are caused by external hardware events that are not related to the instruction currently executing. Examples:

- A **timer interrupt**: a hardware timer fires at regular intervals (e.g., every 10 ms), signaling the OS that it is time to consider scheduling a different process. This is the core mechanism for multiprocessing on a single CPU.
- A **disk interrupt**: the disk finishes reading a block of data and signals the CPU that the I/O is complete. The OS's interrupt handler can then wake up the process that was waiting for the data.
- A **network interrupt**: a network card receives a packet and signals the CPU.

The **trap table** (also called an exception table or interrupt descriptor table) is an array of addresses set up by the OS at boot time. Each entry in the table points to a kernel handler routine for a specific exception or interrupt type. When an exception or interrupt occurs, the CPU uses the exception/interrupt number as an index into the trap table and jumps to the corresponding handler.

The **system call interface** is the formal way a user process requests the OS. The process loads the system call number and arguments into registers and executes a trap instruction. The kernel's trap handler looks up the system call number, performs bounds checking and permission checks, executes the requested operation, and returns the result. Example system calls:

- `read()` and `write()` for file I/O.
- `fork()` to create a new process.
- `exec()` to load and run a new program.
- `open()`, `close()`, `stat()` for file system operations.

**Interrupt handling and critical sections.** When the OS is in the middle of a critical operation (e.g., updating a shared data structure), it may **disable interrupts** (using a privileged instruction) to prevent a timer interrupt from preempting it mid-operation. If the kernel allowed an interrupt to occur while updating the trap table itself, the handler's first instruction might read a partially-updated entry, causing incorrect behavior. The xv6 kernel extensively uses interrupt disabling to protect its critical sections. Once the critical operation is complete, interrupts are re-enabled.

## Common exam questions

- What is the difference between a trap and an interrupt?
- Name three types of exceptions that trigger traps.
- Describe the role of the trap table and how it directs the CPU to the correct handler.
- How does a timer interrupt allow the OS to enforce multiprocessing on a single CPU?
- Why must the OS disable interrupts during critical sections of code?
- What information does the kernel typically save when handling a trap or interrupt?

## Gotchas

- A system call is a trap, but not all traps are system calls. Traps caused by illegal operations or page faults are not system calls.
- Interrupt handlers must be extremely fast, since they preempt the running process. A slow interrupt handler can cause the system to appear unresponsive. Disk and network interrupts often defer actual processing to a background thread or bottom half.
- Disabling interrupts is a blunt tool. If interrupts are disabled for too long, incoming I/O events are not processed, and the system can lose data or become unresponsive.
- The CPU must be careful to save the user process's state (all registers, flags, program counter) before jumping to a trap handler, and to restore it correctly when returning to user mode. If state is lost or corrupted, the resumed process will behave erratically.

## Sources

- lectures__Week2_2.txt
