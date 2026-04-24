# The Process Abstraction

## Definition

A process is a running program with its own isolated execution environment. The OS manages the illusion of multiple CPUs through time sharing: running one process, then stopping it, and running another. The process abstraction comprises memory (address space), instructions, data, and hardware state (registers including program counter and stack pointer).

## When to use

- Understanding what the OS manages and controls when running user code.
- Explaining how a program transforms from a static executable file on disk to an executing entity in memory.
- Discussing why the OS needs data structures to track and manage multiple programs simultaneously.
- Reasoning about process states and transitions during scheduling decisions.

## Key ideas

The process abstraction is the OS's way of providing the illusion of many CPUs to user programs. At any given moment, only one process runs on a single CPU, but through time sharing, the OS creates the appearance of many programs running concurrently.

A process consists of several key components managed by the OS:

- **Address space (memory)**: The entire range of memory the process can access, logically organized into regions:
  - **Text (code)**: The executable instructions of the program.
  - **Data (static data)**: Initialized global variables and constants.
  - **Heap**: Dynamically allocated memory (malloc/free).
  - **Stack**: Local variables, function parameters, and return addresses.
  
Week 2_1 shows a concrete example: address space from 0-16 KB with text at the lowest addresses, data above it, heap above that, and stack at the highest addresses (growing downward).

- **Registers**: The CPU hardware state that must be saved and restored when the process is not running:
  - Program counter (instruction pointer): Points to the next instruction to execute.
  - Stack pointer: Points to the current top of the stack.
  - General-purpose registers: Used by the program for computation.

- **Program counter and stack pointer**: Special registers that determine execution flow and memory context.

The Process Control Block (PCB) is the OS's data structure for tracking a process. In xv6 (the example OS from Week 2_1), `struct proc` contains:
- `char *mem`: Start of process memory
- `uint sz`: Size of process memory
- `enum proc_state state`: Current process state (UNUSED, EMBRYO, SLEEPING, RUNNABLE, RUNNING, ZOMBIE)
- `int pid`: Process ID
- `struct proc *parent`: Pointer to parent process
- `struct context context`: The saved register state
- `struct file *ofile[NOFILE]`: Open file descriptors
- And others for tracking I/O and other OS resources

The `struct context` in xv6 saves critical registers during a context switch: eip (program counter), esp (stack pointer), ebx, ecx, edx, esi, edi, ebp.

## Process States

A process transitions through three primary states:

- **Running**: The process is currently executing on the CPU.
- **Ready**: The process is prepared to run but the OS scheduler has chosen not to execute it at this moment; it will eventually be scheduled.
- **Blocked**: The process has initiated an I/O operation (disk read, network request, etc.) and cannot proceed until that operation completes. While blocked, other processes can use the CPU.

State transitions occur as follows:
- Running → Ready: Descheduled (timer interrupt or yield syscall).
- Ready → Running: Scheduled by the scheduler.
- Running → Blocked: Process initiates I/O (e.g., read from disk).
- Blocked → Ready: I/O completes, process is eligible to run again.

## Why the OS needs the process abstraction

Without this abstraction, the OS would have no way to protect programs from each other or to manage multiple computations on a single CPU. The process provides:

1. **Isolation**: Each process has its own address space; one cannot corrupt another's memory.
2. **Control**: The OS can pause and resume processes, managing CPU time fairly.
3. **Resource management**: The OS tracks memory, open files, and other resources per process.
4. **Virtualization**: User programs believe they have their own CPU and memory, even though they are multiplexed.

## Common exam questions

- **MCQ:** Which of the following best defines a process?
  - [x] A running program with its own address space, execution state, and hardware context managed by the OS
  - [ ] A static executable file stored on disk
  - [ ] A block of kernel code that services interrupts
  - [ ] A thread of execution that shares memory with every other thread on the system
  - why: A process is the OS abstraction for a running program: memory, instructions, data, and hardware state (registers, PC, SP). The executable file on disk is not yet a process.

- **MCQ:** A process is currently waiting on a disk read to complete. Which state is it in?
  - [x] Blocked (SLEEPING in xv6)
  - [ ] Running
  - [ ] Ready (RUNNABLE in xv6)
  - [ ] Zombie
  - why: A process that has started I/O and cannot progress until it completes is Blocked; it becomes Ready again when the I/O finishes.

- **MCQ:** Which transition corresponds to the scheduler picking a process off the ready queue and starting it on the CPU?
  - [x] Ready to Running
  - [ ] Running to Ready
  - [ ] Running to Blocked
  - [ ] Blocked to Ready
  - why: Running to Ready is a deschedule; Running to Blocked is an I/O request; Blocked to Ready is I/O completion. Only Ready to Running is the scheduler dispatching the process.

- **MCQ:** What information does the Process Control Block (PCB) store?
  - [x] Process metadata including PID, state, parent pointer, saved register context, and open file descriptors
  - [ ] Only the program counter and stack pointer
  - [ ] The raw machine code of the program being executed
  - [ ] A copy of the process's entire address space
  - why: The PCB (xv6's struct proc) holds everything the kernel needs to manage the process: PID, state, parent, saved context, open files, and memory bookkeeping.

- **MCQ:** Why must the kernel save the program counter and stack pointer when descheduling a process?
  - [x] So that when the process later resumes, it continues at the right instruction on the correct stack frame.
  - [ ] Because user code is not allowed to touch those registers.
  - [ ] To compute the process's priority in the scheduler.
  - [ ] So the OS can deallocate the process's memory.
  - why: PC and SP jointly define "where execution is" and "which stack frame is active." Without them, resuming the process correctly is impossible.

- **MCQ:** What does the process abstraction provide that bare hardware does not?
  - [x] Isolation between programs and time-multiplexing of one or more CPUs across many programs
  - [ ] Faster CPUs
  - [ ] Direct access to physical memory for every program
  - [ ] A guarantee that every process runs to completion without interruption
  - why: The process abstraction gives each program its own address space (isolation) and lets the OS share the CPU by pausing/resuming processes (virtualization via time sharing).

- **MCQ:** In xv6, which state does a process enter after calling exit() but before its parent calls wait()?
  - [x] ZOMBIE
  - [ ] SLEEPING
  - [ ] UNUSED
  - [ ] RUNNABLE
  - why: After exit(), the process releases most resources but its PCB remains in the ZOMBIE state so the parent can retrieve its exit status via wait(); only then is the PCB slot freed to UNUSED.

## Gotchas

- **Not all register state is saved**: A context switch saves only callee-saved registers and the PC/SP. Caller-saved registers are handled by calling conventions. Full processor state (floating-point, segment registers, etc.) is saved only on full traps, not during lightweight context switches.
- **Process state names vary**: xv6 uses RUNNABLE (not Ready) and SLEEPING (blocked on a channel). Linux uses RUNNING, INTERRUPTIBLE_SLEEP, etc. The concepts are the same.
- **Memory layout is logical**: The OS uses virtual memory; the actual physical layout is different. The 0-16 KB example in Week 2_1 is a logical view, not a physical address range.
- **Zombie is a state too**: After a process calls exit() but before the parent calls wait(), the process is a zombie—it no longer runs but still occupies a PCB slot.

## Sources

- Week2_1.pdf: Process abstraction, address space layout (0-16 KB example), process states (Running/Ready/Blocked), state transitions, xv6 `struct context` and `struct proc` definitions.
- Week2_2.pdf: Limited Direct Execution protocol and context switching context.
