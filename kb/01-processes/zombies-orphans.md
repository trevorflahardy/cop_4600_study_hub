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

- **MCQ:** Which description matches a zombie process?
  - [x] A child that has exited but whose parent has not yet called wait(), so its PCB entry still holds the exit status.
  - [ ] A child that is still running after its parent exited.
  - [ ] A process that has been suspended with SIGSTOP.
  - [ ] A kernel thread that is blocked on a spinlock.
  - why: Zombies have already called exit(); their heavy resources are freed but a PCB slot with PID and exit status lingers until the parent reaps them with wait().

- **MCQ:** A parent forks 100 children, each exits immediately, and the parent never calls wait(). What is the main consequence?
  - [x] 100 zombie entries accumulate in the process table, consuming PCB slots.
  - [ ] The 100 children continue running forever in the background.
  - [ ] Their memory is leaked back to the parent.
  - [ ] The OS automatically kills the parent.
  - why: Unreaped children remain as zombies holding PCB slots. Their address spaces are gone, but enough zombies can exhaust the process table.

- **MCQ:** Which process adopts orphaned children and periodically reaps them?
  - [x] init (PID 1)
  - [ ] The kernel scheduler thread
  - [ ] The shell that spawned the original parent
  - [ ] The child's grandparent process
  - why: When a parent exits first, its still-running children are reparented to init (PID 1), which loops on wait() to clean them up when they eventually exit.

- **MCQ:** Can a single process be both a zombie and an orphan at the same instant?
  - [x] No; a zombie has already exited, while an orphan is still running with init as its new parent.
  - [ ] Yes; any exited child with no parent qualifies as both.
  - [ ] Yes; the kernel marks both flags simultaneously.
  - [ ] No, because init is never allowed to have children.
  - why: The states are mutually exclusive in time: orphan means still alive but reparented; zombie means already terminated awaiting reap. An exited orphan is simply a zombie reaped by init.

- **MCQ:** Why does the OS keep a zombie's PCB around instead of freeing it the moment the process exits?
  - [x] To preserve the exit status so the parent can retrieve it via wait() or waitpid().
  - [ ] Because the child's memory cannot be freed until its parent dies.
  - [ ] So that signals sent after exit can still be delivered.
  - [ ] To keep the PID usable by other processes.
  - why: The exit status has to live somewhere until the parent asks for it; the minimal PCB entry is that storage. Once wait() returns it, the PCB is freed.

- **MCQ:** What is the correct way to avoid accumulating zombies when a parent spawns many children?
  - [x] Always call wait() or waitpid() (or install a SIGCHLD handler that reaps them) once per child.
  - [ ] Call fork() with a special no-zombie flag.
  - [ ] Have each child call wait() on itself before exiting.
  - [ ] Send SIGKILL to the children after they exit.
  - why: Each terminated child needs a reaping wait() call; SIGCHLD handlers are the standard way for long-running parents to reap asynchronously.

- **MCQ:** Are orphan processes themselves a resource leak?
  - [x] No; init adopts them and reaps them when they exit, so there is no lingering leak.
  - [ ] Yes; orphans hold memory forever because no parent can free them.
  - [ ] Yes; orphans block the scheduler from selecting other processes.
  - [ ] No; orphans are killed immediately when their parent dies.
  - why: Orphans keep running normally under init. When they eventually exit, init's wait() loop reaps them, preventing any long-term leak.

## Gotchas

- **Zombies are mostly harmless but bad style**: A single zombie is not a disaster, but accumulating zombies is a sign of a buggy parent process. Good practice: always wait() for children or use SIGCHLD handler.
- **Orphans are not a problem**: Unlike zombies, orphans are not a resource leak. Init reaps them. A process becoming an orphan is normal (e.g., backgrounded processes in a shell).
- **Wait() is one-time per child**: A parent must call wait() (or waitpid()) once for each child. If a parent forks 5 children, it must call wait() 5 times (or use a loop).
- **Partial exit status is preserved**: The exit status of a zombie is stored and can be inspected by the parent via wait()'s status argument. If the parent never calls wait(), that information is lost if the parent terminates.
- **Init never becomes a zombie**: Init (PID 1) is special; it cannot be killed and its parent (the kernel) always reaps it, so it never becomes a zombie.

## Sources

- Week2_1.pdf, Midterm 1 Practice Answers, and Midterm1-v2.pdf: Process states including ZOMBIE in xv6, parent-child relationships, wait() cleanup.
- Process state diagrams and lifecycle notes from course materials.
