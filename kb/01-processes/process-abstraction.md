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

- What is the definition of a process? What are its key components?
- Explain the three process states (Running, Ready, Blocked) and draw the state transition diagram.
- What is a PCB (Process Control Block) and what information does it store? (Reference xv6's `struct proc`.)
- Why does the OS need to save the program counter and stack pointer when switching between processes?
- How does the process abstraction enable the OS to multiplex many processes on a single CPU?
- What is the purpose of the register context structure in process management?

## Gotchas

- **Not all register state is saved**: A context switch saves only callee-saved registers and the PC/SP. Caller-saved registers are handled by calling conventions. Full processor state (floating-point, segment registers, etc.) is saved only on full traps, not during lightweight context switches.
- **Process state names vary**: xv6 uses RUNNABLE (not Ready) and SLEEPING (blocked on a channel). Linux uses RUNNING, INTERRUPTIBLE_SLEEP, etc. The concepts are the same.
- **Memory layout is logical**: The OS uses virtual memory; the actual physical layout is different. The 0-16 KB example in Week 2_1 is a logical view, not a physical address range.
- **Zombie is a state too**: After a process calls exit() but before the parent calls wait(), the process is a zombie—it no longer runs but still occupies a PCB slot.

## Sources

- Week2_1.pdf: Process abstraction, address space layout (0-16 KB example), process states (Running/Ready/Blocked), state transitions, xv6 `struct context` and `struct proc` definitions.
- Week2_2.pdf: Limited Direct Execution protocol and context switching context.
