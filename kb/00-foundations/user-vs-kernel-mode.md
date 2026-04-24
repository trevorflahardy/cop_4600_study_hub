# User Mode vs Kernel Mode

## Definition

Modern processors support two privilege levels: **user mode** and **kernel mode**. User mode restricts which instructions a process can execute (no direct hardware access, no memory protection changes); kernel mode allows full access. The OS kernel runs in kernel mode; user applications run in user mode. This division enforces hardware protection and prevents buggy or malicious user code from corrupting the system.

## When to use

- When explaining why a segmentation fault does not crash other processes.
- When discussing how a privileged instruction is used to transition into the kernel.
- When introducing the trap/return-from-trap mechanism.
- When analyzing what happens when a user process tries to access protected memory or execute a privileged instruction.
- When explaining the overhead cost of system calls (mode switch is expensive).

## Key ideas

The CPU has a **privilege mode bit** that controls which instructions are allowed. In user mode, the CPU blocks privileged instructions such as:

- Loading the page table base register (PTBR) or modifying other memory protection registers.
- Disabling or enabling interrupts.
- Directly accessing I/O ports or hardware devices.
- Changing the privilege mode itself.

If user-mode code attempts any of these, the CPU raises a **privilege exception**, and control immediately passes to the OS kernel.

**Kernel mode** is when the OS is executing; in kernel mode, all instructions are allowed. The kernel can change page tables, tweak interrupts, and manipulate hardware registers. User code never runs in kernel mode.

**The transition mechanism** uses a privileged instruction called the **trap** (or system call instruction). When a user process needs an OS service (e.g., to read a file, or allocate memory), it executes a trap instruction with an argument specifying which service it wants. This causes an immediate mode switch to kernel mode and jumps the CPU's program counter into the kernel's trap handler. The kernel checks the request, enforces policy (e.g., "does this process have permission to open that file?"), performs the operation, and then executes a **return-from-trap** instruction, which switches the CPU back to user mode and resumes the user process.

This enforced boundary prevents user processes from directly manipulating hardware or bypassing OS resource management. A buggy or malicious user process cannot disable interrupts, rewrite its own page table, or access kernel data structures.

## Common exam questions

- **MCQ:** What primarily distinguishes kernel mode from user mode?
  - [x] In kernel mode, privileged instructions (modifying page tables, disabling interrupts, I/O port access) are allowed; in user mode they are blocked by hardware
  - [ ] Kernel mode runs at a higher clock speed than user mode
  - [ ] User mode uses virtual addresses and kernel mode uses physical addresses only
  - [ ] Kernel mode can only be entered by the bootloader, never by a running process
  - why: The CPU privilege-mode bit gates a specific set of instructions. User mode is deliberately restricted so untrusted code cannot touch hardware directly; the kernel runs with the bit set to allow full access.

- **MCQ:** What happens when user-mode code attempts to execute a privileged instruction?
  - [x] The CPU raises a privilege exception that traps into the kernel
  - [ ] The instruction silently succeeds
  - [ ] The CPU reboots to prevent data corruption
  - [ ] The user process is automatically promoted to kernel mode
  - why: Privileged instructions are enforced by hardware: attempting one in user mode raises an exception so the kernel can decide how to handle the offense (typically terminate the process).

- **MCQ:** Which instruction is responsible for switching the CPU from kernel mode back to user mode after handling a system call?
  - [x] return-from-trap (e.g., `iret` / `sysret`)
  - [ ] `call`
  - [ ] `ret`
  - [ ] `jmp`
  - why: Ordinary `ret` and `jmp` do not change privilege level. Only a return-from-trap style instruction pops the saved CPU state and drops privilege atomically.

- **MCQ:** Which of the following is NOT a privileged instruction on typical CPUs?
  - [ ] Loading the page table base register
  - [ ] Disabling interrupts
  - [ ] Accessing an I/O port directly
  - [x] Adding two values in general-purpose registers
  - why: Arithmetic on registers is unprivileged and allowed in user mode. The other three manipulate hardware state the OS must control and are blocked in user mode.

- **MCQ:** Why does the kernel validate arguments and permissions even after a trap hands control to it?
  - [x] A malicious or buggy user process may pass invalid pointers or request operations it is not entitled to perform
  - [ ] The trap instruction does not actually switch privilege modes
  - [ ] User mode validates arguments but kernel mode must re-check them for speed
  - [ ] Permission checks are required by the C compiler
  - why: Crossing the trap boundary does not make arguments trustworthy. The kernel must defensively verify every pointer, file descriptor, and permission to uphold isolation.

- **MCQ:** A privilege exception and a trap instruction both transition the CPU to kernel mode. How do they differ semantically?
  - [x] A trap is an intentional request by user code; a privilege exception is triggered by an attempted forbidden operation
  - [ ] A privilege exception runs in user mode and a trap runs in kernel mode
  - [ ] Traps use the trap table, privilege exceptions do not
  - [ ] They are identical in every respect
  - why: Both vector through the trap table to a kernel handler, but one is cooperative (syscall) and the other is the CPU catching misbehavior. The kernel responds differently to each.

- **MCQ:** How does dual-mode operation enable process isolation?
  - [x] User processes cannot directly modify page tables or access other processes' memory because those actions require kernel mode
  - [ ] Each user process runs on a physically different CPU core
  - [ ] The kernel copies user memory to disk between every context switch
  - [ ] User mode has no access to RAM at all
  - why: Because memory protection and page-table changes are privileged, a user process is structurally unable to reach into another process's memory. All cross-process effects must go through the kernel.

- Explain, step by step, what happens from the moment a user process executes a trap instruction to the moment it resumes at the instruction after the trap.

## Gotchas

- User mode and kernel mode are CPU states, not OS abstractions. The CPU enforces the mode bit in hardware; the OS cannot override it (except for switching privilege levels via trap/return-from-trap).
- A **privilege exception** is distinct from a **trap instruction**. A privilege exception is triggered by attempting a forbidden operation; a trap is an intentional request for the OS to do something. Both transition to kernel mode, but they have different semantics.
- Returning from a trap is not simply jumping to a return address in user code; the kernel must restore the exact CPU state (registers, flags, program counter) that the user process had before the trap, so execution resumes as if nothing happened.
- Some CPUs allow multiple privilege levels (e.g., ring 0 for kernel, ring 3 for user on x86). The detailed model varies, but the principle is the same: restrict user code and enforce the OS's will via hardware.

## Sources

- lectures__Week2_2.txt
