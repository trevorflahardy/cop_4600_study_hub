# Zombies and Orphans

## Definition

A zombie is a child process that has exited but whose parent has not yet called wait() to retrieve its exit status; the child's PCB remains in the process table. An orphan is a child process whose parent has exited (or been killed) before the child; the init process adopts orphans and reaps them.

## When to use

- Understanding process lifecycle and cleanup responsibilities.
- Debugging long-running parent processes that accumulate zombie children (a common system problem).
- Reasoning about process termination and parent-child relationships.
- Explaining why a shell or daemon should always wait for children.
- Analyzing system process listings (ps output) to identify resource leaks.

## Key ideas

### Zombie processes

After a process calls exit() or is killed by a signal, its process state transitions to zombie. The process has ceased execution and released most resources (memory, file descriptors), but the OS keeps a minimal entry in the process table. This PCB slot contains:
- The process ID (PID)
- The exit status (how the process terminated)
- The parent's PID

The PCB remains until the parent calls wait() or waitpid() to retrieve the exit status. Once wait() is called, the child's PCB is finally removed from the table.

**Why zombies exist**: The OS must preserve the exit status somewhere until the parent asks for it. The PCB is that storage location.

**Resource impact**: A zombie consumes a PCB entry (usually limited resources). If many zombies accumulate, the process table can fill up, and the OS cannot create new processes. However, zombies do not consume memory or other heavyweight resources.

**Example scenario from exam prep materials**: A parent process forks 100 children, each child exits immediately, but the parent never calls wait(). The process table grows to 100+ zombie entries.

### Orphan processes

If a parent process exits before its children do, the children become orphans. However, the OS does not allow children to become truly parentless. Instead, init (PID 1, the first process created by the kernel) adopts orphans. Init periodically calls wait() to reap them.

**Key point**: A process that is a zombie cannot be an orphan (it has already exited). Conversely, an orphan is not necessarily a zombie—it is still running but has a new parent (init).

**Example**: A parent process forks a child, then the parent crashes without calling wait(). The child (still running) is reparented to init. When the child exits, init's next wait() call reaps it.

### Visual distinction

| | Zombie | Orphan |
|---|--------|--------|
| **State** | Has exited; waiting for parent to wait() | Still running; parent exited |
| **Memory** | Minimal (PCB only) | Normal (full address space) |
| **Problem** | PCB table filling up | None—init takes over |
| **Cleanup** | Parent calls wait() | Init periodically calls wait() |

## Process state transitions and cleanup

In xv6 (from process-abstraction notes), the process state enum includes ZOMBIE. The full lifecycle is:

1. **UNUSED**: PCB slot is free.
2. **EMBRYO**: Process is being created (fork() in progress).
3. **SLEEPING/BLOCKED**: Process is blocked on I/O or synchronization.
4. **RUNNABLE/READY**: Process is ready to run.
5. **RUNNING**: Process is executing.
6. **ZOMBIE**: Process has exited, parent has not yet wait()-ed.

A child enters ZOMBIE after exit() is called. It remains there until the parent calls wait(), which causes:
- The parent to be unblocked (if it was waiting).
- The child's PCB to be freed (state → UNUSED).

## Common exam questions

- What is a zombie process? How does it form?
- What happens if a process forks 10 children and never calls wait()? Describe the state of the process table.
- What is an orphan process? How does the OS handle orphans?
- Can a process be both a zombie and an orphan? Explain.
- Why does the OS keep zombie processes around instead of immediately freeing them?
- What happens if the init process (PID 1) exits? (Trick question: init should never exit in a well-functioning system; if it does, the system crashes.)
- How can you detect zombie processes in a running system? (ps command output—show Z state.)

## Gotchas

- **Zombies are mostly harmless but bad style**: A single zombie is not a disaster, but accumulating zombies is a sign of a buggy parent process. Good practice: always wait() for children or use SIGCHLD handler.
- **Orphans are not a problem**: Unlike zombies, orphans are not a resource leak. Init reaps them. A process becoming an orphan is normal (e.g., backgrounded processes in a shell).
- **Wait() is one-time per child**: A parent must call wait() (or waitpid()) once for each child. If a parent forks 5 children, it must call wait() 5 times (or use a loop).
- **Partial exit status is preserved**: The exit status of a zombie is stored and can be inspected by the parent via wait()'s status argument. If the parent never calls wait(), that information is lost if the parent terminates.
- **Init never becomes a zombie**: Init (PID 1) is special; it cannot be killed and its parent (the kernel) always reaps it, so it never becomes a zombie.

## Sources

- Week2_1.pdf, Midterm 1 Practice Answers, and Midterm1-v2.pdf: Process states including ZOMBIE in xv6, parent-child relationships, wait() cleanup.
- Process state diagrams and lifecycle notes from course materials.
