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

- What are the two mechanisms that Limited Direct Execution uses to keep the OS in control?
- Why is a timer interrupt necessary, given that system calls already allow the OS to regain control?
- Describe the sequence of events when a timer interrupt fires while a user process is running.
- What does the OS save and restore during a context switch?
- How does the xv6 `swtch()` routine work at a high level?
- What is the overhead of a system call compared to a regular function call?

## Gotchas

- Disabling interrupts during critical OS code is correct, but only during narrow windows. If the OS disables interrupts for too long, the timer interrupt is lost, and the OS may not get a chance to schedule a different process for a long time.
- A context switch is expensive: it requires saving and restoring many registers, flushing the TLB (translation lookaside buffer), and incurring cache misses. This is why frequent context switching (too many processes, too many timer interrupts) degrades performance.
- The user process's full register state must be saved before jumping to the trap handler; otherwise, the resumed process will see garbage values in its registers. The CPU does this automatically on a trap/interrupt, storing the state on the kernel stack.
- The timer must be precise. If it is too slow, a process will run too long before being preempted; if it is too fast, context switching overhead will dominate and throughput will suffer.
- Saving only the "kernel context" in `swtch()` is sufficient because the full user register state was already saved by the CPU when the trap or interrupt occurred. The kernel context saved by `swtch()` is the state of registers that the kernel's scheduler and other code use.

## Sources

- lectures__Week2_2.txt
