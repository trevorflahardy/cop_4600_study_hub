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

- **MCQ:** What is the key distinction between a trap and an interrupt?
  - [x] A trap is synchronous and caused by the currently executing instruction; an interrupt is asynchronous and caused by external hardware
  - [ ] A trap runs in user mode; an interrupt runs in kernel mode
  - [ ] A trap is raised only by the kernel; an interrupt is raised only by user code
  - [ ] A trap is always a system call; an interrupt is always a page fault
  - why: Synchronous vs. asynchronous is the defining distinction. Traps (syscall, illegal instruction, page fault) are tied to the running instruction; interrupts (timer, disk, NIC) arrive independently from hardware.

- **MCQ:** Which of the following is NOT a trap?
  - [ ] A user process executes a `syscall` instruction
  - [ ] A user process divides by zero
  - [ ] A user process accesses an unmapped virtual address (page fault)
  - [x] A disk finishes a read and signals the CPU that data is ready
  - why: A disk completion is asynchronous hardware-generated, so it is an interrupt. The other three are synchronous, caused by the current instruction, and therefore traps.

- **MCQ:** What is the purpose of the trap table?
  - [x] It maps each exception/interrupt number to the address of a kernel handler routine
  - [ ] It stores the page table entries for kernel memory
  - [ ] It records which process last called a system call
  - [ ] It buffers user-mode trap instructions before executing them
  - why: The trap table (IDT on x86) is an indexed array of handler addresses set up at boot. The CPU uses the exception/interrupt number as the index to jump to the correct handler.

- **MCQ:** How does the timer interrupt enable multiprocessing on a single CPU?
  - [x] It periodically forces control back to the kernel so the scheduler can switch processes
  - [ ] It duplicates the CPU so multiple processes can run truly in parallel
  - [ ] It lets user code yield voluntarily to other processes
  - [ ] It blocks system calls until the current process completes
  - why: A single CPU can only run one instruction stream at a time. The timer guarantees the kernel periodically regains control, enabling time-sliced multiplexing even if processes never trap voluntarily.

- **MCQ:** Why does the kernel sometimes disable interrupts during critical sections?
  - [x] To prevent an interrupt handler from running on partially updated shared data structures
  - [ ] To permanently speed up the CPU by removing hardware signals
  - [ ] To stop user processes from issuing system calls
  - [ ] To force the MMU to refresh all translations
  - why: If an interrupt fires while the kernel is mid-update (e.g., of the trap table), the handler could read inconsistent state. Disabling interrupts briefly guarantees atomicity of the critical section.

- **MCQ:** Which example is a system call specifically (not just any trap)?
  - [x] `read()` executing a `syscall` instruction to ask the OS for bytes from a file
  - [ ] A page fault caused by accessing an unmapped address
  - [ ] An illegal-instruction exception from running a privileged opcode in user mode
  - [ ] A divide-by-zero exception
  - why: A system call is a deliberate trap issued by user code via a trap instruction to request OS service. The other examples are also traps, but they are unintentional exceptions, not system calls.

- **MCQ:** Why must interrupt handlers be kept short?
  - [x] They run while preempting other work, so slow handlers delay other interrupts and degrade responsiveness
  - [ ] The CPU forcibly halts handlers that run longer than one instruction
  - [ ] Kernel mode cannot execute more than a few instructions at a time
  - [ ] The trap table only holds one handler at a time
  - why: A handler runs with priority over the interrupted work and often with further interrupts masked. Long handlers create latency or drop events, which is why real drivers defer heavy work to bottom halves or kernel threads.

- Describe the full sequence of CPU and kernel actions from the moment a user process executes a `syscall` instruction to the moment execution resumes in user mode.

## Gotchas

- A system call is a trap, but not all traps are system calls. Traps caused by illegal operations or page faults are not system calls.
- Interrupt handlers must be extremely fast, since they preempt the running process. A slow interrupt handler can cause the system to appear unresponsive. Disk and network interrupts often defer actual processing to a background thread or bottom half.
- Disabling interrupts is a blunt tool. If interrupts are disabled for too long, incoming I/O events are not processed, and the system can lose data or become unresponsive.
- The CPU must be careful to save the user process's state (all registers, flags, program counter) before jumping to a trap handler, and to restore it correctly when returning to user mode. If state is lost or corrupted, the resumed process will behave erratically.

## Sources

- lectures__Week2_2.txt
