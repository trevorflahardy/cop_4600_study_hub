# Context Switching

## Definition

A context switch is the mechanism by which the OS saves the state of the currently running process and restores the state of the next process to run, allowing the CPU to be shared among multiple processes. It involves saving general-purpose registers, program counter, and stack pointer to the current process's PCB, then restoring the saved state of the next process.

## When to use

- Understanding how the OS multiplexes many processes onto a single CPU.
- Explaining the overhead of time sharing (performance cost of context switches).
- Reasoning about what happens when a timer interrupt fires or a syscall completes.
- Analyzing the efficiency differences between process switches and thread switches.
- Debugging performance issues caused by excessive context switching.

## Key ideas

### What gets saved and restored

A context switch saves enough state to resume a process exactly where it left off. In xv6 and most systems, this includes:

- **General-purpose registers**: eax, ebx, ecx, edx, esi, edi, ebp (data used by computation).
- **Program counter (eip)**: The address of the next instruction to execute.
- **Stack pointer (esp)**: The address of the top of the stack.

These are saved to the process's PCB or kernel stack. Not all CPU state is saved during a lightweight context switch—only callee-saved registers. Caller-saved registers are the responsibility of the calling convention; the called function is expected to preserve them or the caller won't rely on them after the call.

### When context switches occur

1. **Timer interrupt**: The OS's timer device raises an interrupt every X milliseconds (e.g., 10ms). This forces a context switch even if the process is not done.
2. **Explicit yield**: A process calls a syscall like yield() to voluntarily give up the CPU.
3. **Blocking syscall**: A process calls read(), write(), or another I/O syscall and blocks, allowing another process to run.
4. **Scheduler decision**: After the timer fires or an I/O syscall completes, the OS scheduler chooses which ready process runs next.

### The context switch mechanism in xv6

From Week2_2.pdf, the xv6 `swtch()` function is a low-level assembly routine that:

1. **Saves the current process's registers**: Stores eip, esp, ebx, ecx, edx, esi, edi, ebp into the current process's `struct context`.
2. **Restores the next process's registers**: Loads the same registers from the next process's `struct context`.
3. **Switches kernel stacks**: Updates esp to point to the next process's kernel stack.
4. **Returns**: The ret instruction jumps to the next process's saved eip, resuming it.

**Pseudocode for swtch()**:

```c
void swtch(struct context *old, struct context *new) {
    // Save old process's registers to kernel stack
    // (these are popped from the kernel stack into struct context)
    old->eip = return_address;
    old->esp = current_stack_pointer;
    old->ebx = ebx;
    old->ecx = ecx;
    old->edx = edx;
    old->esi = esi;
    old->edi = edi;
    old->ebp = ebp;
    
    // Restore new process's registers from struct context
    ebp = new->ebp;
    edi = new->edi;
    esi = new->esi;
    edx = new->edx;
    ecx = new->ecx;
    ebx = new->ebx;
    esp = new->esp;  // stack is switched here
    // eip is implicitly restored by the return instruction
    return_address = new->eip;
    ret;  // jump to new process
}
```

From Week2_2.pdf, the actual xv6 swtch() assembly (lines 7-28) does exactly this.

### Cost of context switching

Context switching has several costs:

1. **Direct cost**: Saving and restoring registers takes a few CPU cycles (microseconds). This is minimal.
2. **TLB flush**: The Translation Lookaside Buffer (TLB) caches virtual-to-physical address translations. A context switch (especially to a process with a different page table) invalidates many or all TLB entries, forcing future memory accesses to re-translate addresses. This is slow.
3. **Cache pollution**: The L1 and L2 caches hold the previous process's data and code. The new process's data is not cached, causing many cache misses early in execution.
4. **Indirect cost**: While one process is running, others are not, reducing throughput if there is little parallelizable work.

The TLB and cache costs dominate; they can add milliseconds to the first phase of the new process's execution.

### Process vs. thread context switch

A process context switch involves:
- Saving/restoring user registers (as above).
- Switching page tables (virtual memory mapping changes).
- TLB invalidation.

A thread context switch (within the same process) involves:
- Saving/restoring user registers.
- **No page table switch** (threads share the same address space and page table).
- **No TLB invalidation** (the page table hasn't changed).

**Key insight**: Thread switching is significantly cheaper than process switching because threads share virtual memory. This is why multithreaded programs can have lower context switch overhead than multiprocess programs.

## Context switch protocol (Limited Direct Execution)

From Week2_2.pdf, the full Limited Direct Execution protocol with context switching:

1. **OS boot** (kernel mode): Initialize trap table with syscall and timer interrupt handlers.
2. **Process creation**: OS loads program, sets up PCB, fills kernel stack with initial registers, return-from-trap into user mode.
3. **Running** (user mode): Process executes. On timer interrupt:
   - Hardware saves process's registers to kernel stack.
   - Hardware switches to kernel mode and jumps to timer handler.
4. **Timer handler** (kernel mode): Calls scheduler, which decides whether to continue or switch.
5. **Context switch** (if needed):
   - swtch() saves current registers to old PCB, restores new process's registers from PCB.
   - Stack is switched to new process's kernel stack.
6. **Return from interrupt**: return-from-trap restores registers from kernel stack, switches to user mode, jumps to new process's PC.

## Common exam questions

- **MCQ:** During a context switch in xv6, which pieces of state does swtch() save to the current process's struct context?
  - [x] Callee-saved general-purpose registers, the program counter (eip), and the stack pointer (esp)
  - [ ] Only the program counter, because everything else is in memory
  - [ ] All CPU state including floating-point and segment registers
  - [ ] Only user-mode registers; kernel registers are discarded
  - why: xv6's lightweight swtch() saves eip, esp, and the callee-saved registers (ebx, ecx, edx, esi, edi, ebp). Full state including FP registers is only saved on traps that change privilege level.

- **MCQ:** Why is a thread-to-thread context switch within a single process cheaper than a process-to-process context switch?
  - [x] Threads share the same page table, so no page-table swap or TLB invalidation is needed.
  - [ ] Threads do not have their own registers, so nothing needs to be saved.
  - [ ] Threads always run in kernel mode, skipping the user/kernel transition.
  - [ ] The scheduler skips the run queue when switching threads.
  - why: Threads in the same process share an address space and page table, so the TLB stays valid and the expensive page-table switch is avoided.

- **MCQ:** A timer interrupt fires while a user process is running. What happens first?
  - [x] The hardware switches to kernel mode, saves the interrupted registers, and jumps to the pre-installed timer trap handler.
  - [ ] The OS immediately frees the process's PCB.
  - [ ] The scheduler selects the next process before any registers are saved.
  - [ ] The process's user stack is copied into the kernel.
  - why: Timer interrupts use the Limited Direct Execution trap table installed at boot; hardware saves minimal state and jumps to the kernel handler, which then decides whether to context-switch.

- **MCQ:** What is the dominant cost of a process-to-process context switch on modern hardware?
  - [x] TLB invalidation and cache pollution that slow future memory accesses
  - [ ] The dozen or so register loads and stores in swtch()
  - [ ] The time spent updating the process's PID number
  - [ ] Recompiling the user program on the fly
  - why: Saving/restoring registers is a handful of cycles; flushed TLB entries and cold caches cost many more cycles as the new process's translations and data are reloaded from memory.

- **MCQ:** Why must the program counter be saved when a process is descheduled?
  - [x] So that when the process resumes, execution continues at the exact instruction it left off.
  - [ ] Because the scheduler needs the PC to compute process priority.
  - [ ] So that the OS can count how many instructions each process ran.
  - [ ] To keep the PCB the same size as in older systems.
  - why: Without the saved PC, there would be no way to know where to resume the process; it is the essential pointer into the program's instruction stream.

- **MCQ:** Which event is NOT a typical trigger for a context switch?
  - [x] A user process performing a purely arithmetic computation with no syscall
  - [ ] A timer interrupt firing after the process's time slice
  - [ ] The process making a blocking read syscall
  - [ ] The process explicitly calling yield()
  - why: Pure user-mode computation does not transfer control to the kernel, so it alone cannot cause a context switch. Timer interrupts, blocking syscalls, and yield all enter the kernel and can trigger scheduling.

- **MCQ:** Which best describes TLB invalidation on a process context switch?
  - [x] Cached virtual-to-physical translations for the old address space are dropped so the new process does not use stale mappings.
  - [ ] The TLB is physically powered off to save energy.
  - [ ] The TLB is resized to match the new process's page table.
  - [ ] Kernel mappings are erased and reloaded from disk.
  - why: Because each process has its own page table, entries cached from the old process must be invalidated (or tagged with an ASID) to prevent the new process from translating addresses incorrectly.

## Gotchas

- **Calling conventions matter**: Not all registers are saved during a lightweight context switch. Some are caller-saved (the caller expects them to be clobbered). Only callee-saved registers are guaranteed to be preserved.
- **Kernel stack is separate**: Each process has a kernel stack (used when in kernel mode) and a user stack (used when in user mode). A context switch switches the kernel stack pointer, not the user stack pointer (the user stack pointer is saved as a register value).
- **TLB cost is often overlooked**: Students often underestimate the cost of TLB invalidation and cache flushing compared to the actual register-save cost.
- **swtch() does not save everything**: Full processor state (floating-point registers, segment registers, etc.) is not saved by swtch(). Those are saved only on exceptions/traps that change privilege level, via the trapframe.
- **Stack direction matters**: On x86, the stack grows downward (esp decreases as stack grows). Saving esp and later restoring it correctly resumes the stack frame.

## Pseudocode

Simplified context switch pseudocode:

```c
void context_switch(struct context *old, struct context *new) {
    // Save current process state
    save_registers_to_pcb(old);
    
    // Restore next process state
    restore_registers_from_pcb(new);
    
    // Switch kernel stack
    set_stack_pointer(new->esp);
    
    // Resume next process at saved PC
    jump_to(new->eip);  // equivalent to ret in assembly
}
```

xv6's swtch() is the actual assembly implementation of this.

## Sources

- Week2_2.pdf: Context switching definition, Limited Direct Execution protocol with timer interrupt, context switch sequence, xv6 swtch() assembly code (lines 7-28), saving/restoring registers, kernel stack switching.
- Week2_1.pdf: xv6 `struct context` definition, register fields (eip, esp, ebx, ecx, edx, esi, edi, ebp).
- Memory management unit (MMU) and virtual memory concepts (covered in later lectures but referenced here for TLB).
