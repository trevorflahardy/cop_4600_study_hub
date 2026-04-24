# Limited Direct Execution

## Definition

Limited Direct Execution (LDE) is the OS's strategy for safely running user processes at near-native speed while maintaining control over the system. The OS allows user code to run directly on the CPU (hence "direct execution") but sets up hardware traps and timer interrupts to ensure the OS can reclaim control when needed (hence "limited"). The kernel never leaves the CPU entirely uncontrolled; it enforces an execution protocol that guarantees periodic opportunities to schedule a different process, handle I/O, and respond to faults.

## When to use

- When explaining how the OS balances performance (letting user code run fast) with safety (maintaining control).
- When describing the complete lifecycle of a process from startup through preemption and context switch.
- When analyzing what happens when a process calls a system call or when the timer interrupt fires.
- When introducing the xv6 context switch mechanism.
- When discussing the overhead costs of system calls and context switches.

## Key ideas

**The problem:** If the OS hands control of the CPU to user code, how does it ever get control back? If a user process enters an infinite loop, the OS will never regain control and cannot switch to a different process.

**The solution:** Limited Direct Execution uses two key mechanisms:

1. **Trap-based approach (for explicit requests):** The user process calls a system call (trap instruction), which transitions to kernel mode and allows the OS to handle the request. The kernel checks the request, performs the operation, and returns to the user process. This is fast—on the order of hundreds of CPU cycles—and synchronous: the OS gets control when the process explicitly asks for it.

2. **Timer-interrupt-based approach (for enforcing control):** The OS sets up a hardware timer to fire at regular intervals (e.g., 10 ms). When the timer fires, the CPU is interrupted, control passes to the OS, and the OS can decide to switch to a different process. This is the mechanism that prevents a runaway process from monopolizing the CPU.

**The protocol:**

- **At boot:** The OS initializes the trap table with handlers for all exceptions and interrupts, and it arms the timer to fire at regular intervals.
- **When starting a user process:** The OS loads the process's registers, sets the program counter to the first instruction of the user code, and executes a return-from-trap instruction, which switches to user mode and resumes the process.
- **While the process runs:** The user process executes its instructions at nearly full speed. If it executes a trap instruction (e.g., to read a file), the trap handler in the OS receives control. If the timer fires, an interrupt handler receives control.
- **During a trap or interrupt:** The OS is running in kernel mode. It can safely manipulate the trap table, page tables, and other protected data. It decides whether to resume the same process immediately (e.g., after a system call returns) or switch to a different process.
- **Context switch:** If the OS decides to switch processes, it saves the current process's state (all general-purpose registers, the program counter, condition flags, etc.) into a **process control block (PCB)** or kernel stack. It then loads the target process's saved state and executes a return-from-trap, resuming the new process from where it was previously paused.

**The xv6 context switch:** xv6 uses the `swtch()` assembly routine to perform the core part of a context switch. `swtch()` saves the current process's "kernel context"—the state of registers that the kernel's C code uses (on x86, the stack pointer and base pointer, the return address, and other callee-saved registers)—into the process's kernel stack. It then loads the target process's saved kernel context and jumps back to the scheduler. The full context (user registers, page table, etc.) is restored when returning to user mode.

Why "limited"? Because the OS never truly gives up control. It ensures that trap instructions and timer interrupts are always armed, so it will regain control either when the process asks for OS service or when the timer fires. The user process runs at full speed between these events, but it cannot indefinitely withhold the CPU from the OS or other processes.

## Common exam questions

- **MCQ:** What two mechanisms does Limited Direct Execution rely on to guarantee the OS can always regain control of the CPU?
  - [x] Trap instructions (for explicit requests) and timer interrupts (for enforced preemption)
  - [ ] Page faults and segmentation faults
  - [ ] Cooperative yields and polling loops
  - [ ] Function call returns and exception handlers only
  - why: LDE uses synchronous traps so the kernel runs when a process asks, and asynchronous timer interrupts so the kernel runs even when a process never asks. Faults and polling alone cannot preempt a runaway infinite loop, and cooperative yielding depends on the process cooperating.

- **MCQ:** Why is a timer interrupt necessary when system calls already allow the OS to regain control?
  - [x] A process stuck in an infinite loop may never execute a trap instruction, so the timer is the only guaranteed way to preempt it
  - [ ] System calls are too slow to be used for scheduling decisions
  - [ ] The trap table can only be accessed from timer-interrupt context
  - [ ] Timer interrupts are required to flush the TLB after every instruction
  - why: A process that never makes a syscall would otherwise hold the CPU forever. The timer guarantees the kernel a scheduled opportunity to preempt regardless of what the user code does.

- **MCQ:** During a context switch in xv6, what is saved by the `swtch()` routine itself?
  - [x] The kernel context (callee-saved registers, stack pointer, return address) used by the kernel's C code
  - [ ] The full user-mode register set, including all general-purpose registers
  - [ ] The page table base register and TLB entries
  - [ ] Only the program counter of the user process
  - why: The user register state was already saved by the CPU onto the kernel stack when the trap/interrupt fired. `swtch()` only needs to save the kernel-side callee-saved registers so the scheduler can resume correctly.

- **MCQ:** What happens on a return-from-trap instruction?
  - [x] The CPU switches from kernel mode to user mode and restores the saved user PC and registers
  - [ ] The CPU flushes all caches and restarts the process from scratch
  - [ ] The CPU stays in kernel mode but jumps to a user address
  - [ ] The CPU disables interrupts and enters a privileged loop
  - why: return-from-trap is the privileged instruction that drops privilege back to user mode while reloading the process's saved PC/registers so execution resumes as if the trap never happened.

- **MCQ:** Which of the following is NOT part of the standard LDE boot-time setup?
  - [ ] Initialize the trap table with handlers for exceptions and interrupts
  - [ ] Arm the hardware timer to fire at regular intervals
  - [ ] Set up kernel stacks for handling traps
  - [x] Pre-translate every user virtual address to a physical address before the process runs
  - why: The MMU performs address translation lazily on each access; the OS does not pre-translate all addresses. The first three steps are exactly how the kernel prepares for LDE at boot.

- **MCQ:** Why is frequent context switching harmful to performance?
  - [x] Each switch requires saving/restoring many registers and causes TLB flushes and cache misses
  - [ ] Context switches require writing the process to disk
  - [ ] The kernel must recompile user code on every switch
  - [ ] Context switches permanently disable interrupts
  - why: A switch is pure overhead: register save/restore plus the indirect cost of cold caches and flushed TLB entries on the newly scheduled process. Too many switches means the CPU spends more time switching than computing.

- Describe in detail the sequence of events from the moment a timer interrupt fires until a new process begins executing in user mode.

## Gotchas

- Disabling interrupts during critical OS code is correct, but only during narrow windows. If the OS disables interrupts for too long, the timer interrupt is lost, and the OS may not get a chance to schedule a different process for a long time.
- A context switch is expensive: it requires saving and restoring many registers, flushing the TLB (translation lookaside buffer), and incurring cache misses. This is why frequent context switching (too many processes, too many timer interrupts) degrades performance.
- The user process's full register state must be saved before jumping to the trap handler; otherwise, the resumed process will see garbage values in its registers. The CPU does this automatically on a trap/interrupt, storing the state on the kernel stack.
- The timer must be precise. If it is too slow, a process will run too long before being preempted; if it is too fast, context switching overhead will dominate and throughput will suffer.
- Saving only the "kernel context" in `swtch()` is sufficient because the full user register state was already saved by the CPU when the trap or interrupt occurred. The kernel context saved by `swtch()` is the state of registers that the kernel's scheduler and other code use.

## Sources

- lectures__Week2_2.txt
