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

- What is the difference between user mode and kernel mode, and why do we need both?
- What happens when user-mode code attempts to execute a privileged instruction?
- Describe the trap/return-from-trap mechanism.
- How does the privilege mode bit prevent user processes from interfering with each other?
- What is the purpose of checking permissions in the kernel before allowing a system call to proceed?

## Gotchas

- User mode and kernel mode are CPU states, not OS abstractions. The CPU enforces the mode bit in hardware; the OS cannot override it (except for switching privilege levels via trap/return-from-trap).
- A **privilege exception** is distinct from a **trap instruction**. A privilege exception is triggered by attempting a forbidden operation; a trap is an intentional request for the OS to do something. Both transition to kernel mode, but they have different semantics.
- Returning from a trap is not simply jumping to a return address in user code; the kernel must restore the exact CPU state (registers, flags, program counter) that the user process had before the trap, so execution resumes as if nothing happened.
- Some CPUs allow multiple privilege levels (e.g., ring 0 for kernel, ring 3 for user on x86). The detailed model varies, but the principle is the same: restrict user code and enforce the OS's will via hardware.

## Sources

- lectures__Week2_2.txt
