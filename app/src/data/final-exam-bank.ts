/**
 * Final exam problem bank — OS edition.
 *
 * Hand-authored MCQ / short / scenario questions derived from the
 * professor's final-exam hints (slide 8 review deck, 2026-04-23). The
 * KB compiler does NOT overwrite this file; it is merged into the
 * generated quiz set by kb-loader.
 *
 * Point budget per the professor:
 *   10 pts — fork/exec/wait list-all-outputs
 *   25 pts — CPU virtualization (plus a slice of memory virt)
 *    1-2   — memory virtualization select questions
 *   75 pts — concurrency (locks, CVs, semaphores)
 *   48 pts — persistence, including 16 pts on inconsistency/recovery
 */
import type { KbQuizQuestion } from "@/lib/kb-loader";

export const FINAL_EXAM_BANK: KbQuizQuestion[] = [
  // ==========================================================================
  // FORK / EXEC / WAIT — "list all possible outputs" (10 pts on exam)
  // ==========================================================================
  {
    id: "final::fork-enum-1",
    topicSlug: "07-exam-prep/fork-output-enumeration",
    kind: "short",
    prompt:
      "Given this code, list all possible outputs.\n\n```c\nint main() {\n    int pid = fork();\n    if (pid == 0) {\n        printf(\"A\\n\");\n        printf(\"B\\n\");\n    } else {\n        printf(\"C\\n\");\n        wait(NULL);\n        printf(\"D\\n\");\n    }\n    return 0;\n}\n```",
    answer: "Three outputs: ABCD, ACBD, CABD.",
    explanation:
      "Constraints: A<B (child program order), C<D (parent order), B<D (wait forces child to finish before D). D must be last; A<B constrains the other three labels; C can slot anywhere before D.",
    difficulty: "firm",
    source: "final-bank",
    points: 10,
  },
  {
    id: "final::fork-enum-2",
    topicSlug: "07-exam-prep/fork-output-enumeration",
    kind: "short",
    prompt:
      "Given this code, list all possible outputs.\n\n```c\nint main() {\n    if (fork() == 0) {\n        printf(\"A\\n\");\n    } else {\n        printf(\"B\\n\");\n        wait(NULL);\n        printf(\"C\\n\");\n    }\n    return 0;\n}\n```",
    answer: "Two outputs: ABC, BAC.",
    explanation:
      "Constraints: B<C (parent program order), A<C (wait). A and B can interleave freely; C must be last.",
    difficulty: "gentle",
    source: "final-bank",
    points: 10,
  },
  {
    id: "final::fork-enum-3",
    topicSlug: "07-exam-prep/fork-output-enumeration",
    kind: "short",
    prompt:
      "Given this code, list all possible outputs (assume the exec call succeeds).\n\n```c\nint main() {\n    if (fork() == 0) {\n        printf(\"A\\n\");\n        execlp(\"echo\", \"echo\", \"B\", NULL);\n        printf(\"C\\n\");\n    } else {\n        wait(NULL);\n        printf(\"D\\n\");\n    }\n    return 0;\n}\n```",
    answer: "One output: A B D.",
    explanation:
      "After a successful execlp the printf(\"C\") line is dead code — the child process image is replaced by echo, which prints B. Constraints A<B<D force a total order. If execlp fails, A C D is also possible, but the exam convention assumes success.",
    difficulty: "firm",
    source: "final-bank",
    points: 10,
  },
  {
    id: "final::fork-enum-dead-code",
    topicSlug: "07-exam-prep/fork-output-enumeration",
    kind: "mcq",
    prompt:
      "In the code below, when is the line `printf(\"X\\n\")` executed?\n\n```c\nif (fork() == 0) {\n    execlp(\"echo\", \"echo\", \"hi\", NULL);\n    printf(\"X\\n\");\n}\n```",
    choices: [
      {
        text: "Never, assuming execlp succeeds.",
        correct: true,
        why: "A successful exec replaces the process image; statements after the exec call are unreachable.",
      },
      {
        text: "Always, since exec is synchronous.",
        correct: false,
        why: "exec does not return on success.",
      },
      {
        text: "Only after echo finishes.",
        correct: false,
        why: "echo does not return to the child either; the child is now echo and will exit after echo completes.",
      },
      {
        text: "Only in the parent process.",
        correct: false,
        why: "The parent does not enter the if branch (fork returns a positive pid, not 0).",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 4,
  },
  {
    id: "final::fork-enum-wait-reaps-one",
    topicSlug: "07-exam-prep/fork-output-enumeration",
    kind: "mcq",
    prompt:
      "A parent process forks two children and calls wait(NULL) once. What happens to the second child?",
    choices: [
      {
        text: "The second child may still be running (or become a zombie) after the parent exits.",
        correct: true,
        why: "wait(NULL) reaps exactly one child. The other is not waited on; if the parent exits, the OS reparents it to init.",
      },
      {
        text: "wait(NULL) blocks until both children have exited.",
        correct: false,
        why: "wait(NULL) returns when the first child exits; it does not wait for all.",
      },
      {
        text: "The second child is automatically killed.",
        correct: false,
        why: "Children are independent processes; they are not killed by a missed wait.",
      },
      {
        text: "wait(NULL) returns -1 because it only works on the most recently forked child.",
        correct: false,
        why: "wait(NULL) works regardless of creation order; only -1 is returned when there are no children.",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 4,
  },
  {
    id: "final::fork-buffering-trap",
    topicSlug: "07-exam-prep/fork-output-enumeration",
    kind: "short",
    prompt:
      "Explain why `printf(\"X\"); fork();` can produce the letter X twice on standard output when redirected to a file, even though only one printf call was made.",
    answer:
      "Without a newline and with block-buffered stdout (what happens when stdout is redirected to a file), the 'X' sits in the userspace stdio buffer when fork runs. fork clones the full address space including that buffer. Both processes later flush their copy of the buffer on exit, printing 'X' twice.",
    explanation:
      "Printing '\\n' or calling fflush(stdout) before fork forces a flush, eliminating the duplication.",
    difficulty: "firm",
    source: "final-bank",
    points: 6,
  },

  // ==========================================================================
  // CPU VIRTUALIZATION / SCHEDULING / CONTEXT SWITCH (25 pts)
  // ==========================================================================
  {
    id: "final::cpu-virt-time-sharing",
    topicSlug: "00-foundations/virtualization-overview",
    kind: "mcq",
    prompt:
      "What is the core mechanism by which the OS creates the illusion that many processes each have their own CPU?",
    choices: [
      {
        text: "Time-sharing the single physical CPU via context switches between processes.",
        correct: true,
        why: "The OS saves one process's registers to its PCB, loads another's, and resumes. The timer interrupt guarantees the OS regains control.",
      },
      {
        text: "Assigning each process a dedicated physical core at boot.",
        correct: false,
        why: "That would scale with cores, not processes. Modern systems run hundreds of processes on a handful of cores.",
      },
      {
        text: "Spatial partitioning of the CPU cache between processes.",
        correct: false,
        why: "Cache partitioning is a performance technique, not the mechanism behind CPU virtualization.",
      },
      {
        text: "Copying each process's code to every core.",
        correct: false,
        why: "Code is not replicated per core; one copy exists in memory.",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 4,
  },
  {
    id: "final::cpu-virt-trap-vs-interrupt",
    topicSlug: "00-foundations/traps-interrupts-syscalls",
    kind: "mcq",
    prompt:
      "Which statement about traps vs. interrupts is correct?",
    choices: [
      {
        text: "Traps are synchronous (raised by the currently executing instruction); interrupts are asynchronous (raised by external devices or timers).",
        correct: true,
        why: "System calls and page faults are traps; timer ticks and I/O completions are interrupts.",
      },
      {
        text: "Traps and interrupts are synonyms on x86.",
        correct: false,
        why: "The distinction is real. x86 encodes both, but the sync/async difference matters for handler design.",
      },
      {
        text: "Interrupts run in user mode; traps run in kernel mode.",
        correct: false,
        why: "Both run kernel-mode handlers via the trap table.",
      },
      {
        text: "Traps never change privilege level; interrupts always do.",
        correct: false,
        why: "Both typically transition from user to kernel mode via the same trap table mechanism.",
      },
    ],
    difficulty: "firm",
    source: "final-bank",
    points: 4,
  },
  {
    id: "final::context-switch-state",
    topicSlug: "01-processes/context-switch",
    kind: "short",
    prompt:
      "On a context switch from process A to process B, what state must the OS save for A and restore for B?",
    answer:
      "General-purpose registers, program counter (PC), stack pointer, CPU flags/status register, and (on some architectures) the page table base register. These are saved to A's PCB and loaded from B's PCB. The TLB may also need to be flushed or tagged with B's ASID.",
    explanation:
      "The context switch is expensive because of both the direct save/restore cost and the indirect cost of cache/TLB misses after the switch.",
    difficulty: "firm",
    source: "final-bank",
    points: 6,
  },
  {
    id: "final::scheduling-best-for-interactive",
    topicSlug: "02-scheduling/mlfq",
    kind: "mcq",
    prompt:
      "Which scheduling policy is best suited for a workload mixing short interactive jobs with long CPU-bound batch jobs, without knowing job lengths in advance?",
    choices: [
      {
        text: "MLFQ (Multi-Level Feedback Queue).",
        correct: true,
        why: "MLFQ learns job behavior at runtime: interactive jobs stay in high-priority queues; CPU-bound jobs sink to lower queues. Periodic boosts prevent starvation.",
      },
      {
        text: "SJF (Shortest Job First).",
        correct: false,
        why: "SJF is optimal for turnaround but requires knowing job lengths and suffers poor response time for long jobs.",
      },
      {
        text: "FIFO.",
        correct: false,
        why: "FIFO causes the convoy effect — a long job at the front delays every short job behind it.",
      },
      {
        text: "Round-robin with a 100-second quantum.",
        correct: false,
        why: "A huge quantum degrades to FIFO. Small quanta help response time but only up to context-switch overhead.",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 4,
  },
  {
    id: "final::fork-return-values",
    topicSlug: "01-processes/fork-exec-wait",
    kind: "mcq",
    prompt:
      "What value does a successful fork call return?",
    choices: [
      {
        text: "0 in the child, the child's PID (positive) in the parent.",
        correct: true,
        why: "This asymmetric return is how the two processes discover which one they are.",
      },
      {
        text: "Both processes get 0.",
        correct: false,
        why: "Then neither process could tell which branch to run.",
      },
      {
        text: "The child's PID in both processes.",
        correct: false,
        why: "The child would think it was the parent.",
      },
      {
        text: "-1 in the parent, 0 in the child.",
        correct: false,
        why: "-1 means fork failed; on success the parent receives a positive PID.",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 3,
  },

  // ==========================================================================
  // MEMORY VIRTUALIZATION (1-2 select questions)
  // ==========================================================================
  {
    id: "final::memvirt-tlb-vs-page-fault",
    topicSlug: "03-memory/tlb",
    kind: "mcq",
    prompt:
      "A TLB miss and a page fault look superficially similar — both happen on a memory reference. What is the key difference?",
    choices: [
      {
        text: "A TLB miss means the translation exists in the page table but is not cached; a page fault means the page is not resident (present bit = 0).",
        correct: true,
        why: "TLB miss is resolved by walking the page table (fast). Page fault requires the OS to fetch the page from disk or kill the process (slow).",
      },
      {
        text: "A TLB miss is always followed by a page fault.",
        correct: false,
        why: "Most TLB misses resolve from a valid page table entry without any fault.",
      },
      {
        text: "TLB misses happen in kernel mode; page faults happen in user mode.",
        correct: false,
        why: "Both can happen in either mode.",
      },
      {
        text: "A TLB miss invalidates the page table; a page fault does not.",
        correct: false,
        why: "Neither invalidates the page table; both consult it.",
      },
    ],
    difficulty: "firm",
    source: "final-bank",
    points: 4,
  },
  {
    id: "final::memvirt-hybrid",
    topicSlug: "03-memory/multi-level-page-tables",
    kind: "mcq",
    prompt:
      "Which statement correctly describes the hybrid segmentation + paging approach?",
    choices: [
      {
        text: "Each segment (code, heap, stack) has its own per-segment page table; the segment register supplies the base of the page table to walk.",
        correct: true,
        why: "This shrinks the page table footprint for sparse address spaces since unused segments have no page table entries at all.",
      },
      {
        text: "The entire address space shares one flat page table spanning all segments.",
        correct: false,
        why: "That is pure paging — the thing hybrid aims to avoid for sparse address spaces.",
      },
      {
        text: "Segments replace pages entirely; no page table exists.",
        correct: false,
        why: "That is pure segmentation; it suffers external fragmentation and gives up fixed-size translation.",
      },
      {
        text: "Hybrid means physical memory is segmented and virtual memory is paged.",
        correct: false,
        why: "Both virtual and physical are paged; segmentation describes how virtual address spaces are divided.",
      },
    ],
    difficulty: "tricky",
    source: "final-bank",
    points: 4,
  },
  {
    id: "final::memvirt-va-to-pa",
    topicSlug: "03-memory/paging-math",
    kind: "short",
    prompt:
      "A 32-bit system uses 4 KB pages and a single-level page table. The PTE for virtual address 0x0040100C resides at page table entry index 0x401 and contains physical frame number 0x123. What is the physical address?",
    answer:
      "PA = (PFN << 12) | offset = (0x123 << 12) | 0x00C = 0x00123000 | 0x00C = 0x0012300C.",
    explanation:
      "Page size 4 KB → 12 offset bits. VA = 0x0040100C → VPN = 0x401, offset = 0x00C. PFN from PTE is 0x123. Concatenate PFN and offset.",
    difficulty: "firm",
    source: "final-bank",
    points: 6,
  },
  {
    id: "final::memvirt-per-process-pt",
    topicSlug: "03-memory/paging-basics",
    kind: "mcq",
    prompt:
      "Why does each process have its own page table rather than sharing one system-wide table?",
    choices: [
      {
        text: "Each process has its own virtual address space, so each needs its own VPN→PFN mapping. Swapping page tables on context switch (by changing the page-table base register) is how processes see different memory.",
        correct: true,
        why: "Isolation is the point. Shared page tables would break process isolation and would have no way to give process A and process B different views of virtual address 0x1000.",
      },
      {
        text: "Per-process page tables are smaller than a global one.",
        correct: false,
        why: "Sum of per-process tables can exceed a hypothetical global one; hybrid and multi-level tables fix size, not sharing.",
      },
      {
        text: "Only processes with different privilege levels need separate tables.",
        correct: false,
        why: "Every process has its own VA space regardless of privilege.",
      },
      {
        text: "The TLB would overflow otherwise.",
        correct: false,
        why: "TLB size is bounded regardless of table strategy.",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 4,
  },

  // ==========================================================================
  // CONCURRENCY (75 pts — biggest block)
  // ==========================================================================
  {
    id: "final::cv-while-not-if",
    topicSlug: "04-concurrency/condition-variables",
    kind: "mcq",
    prompt:
      "Why must `pthread_cond_wait` be inside a `while` loop rather than an `if`?",
    choices: [
      {
        text: "Because spurious wakeups exist and another thread may have consumed the condition before this one runs, so the predicate must be re-checked.",
        correct: true,
        why: "Both spurious wakeups (OS wakes a waiter without a matching signal) and multi-waiter races require re-checking the predicate after wait returns.",
      },
      {
        text: "Because pthread_cond_wait may return an error on every call.",
        correct: false,
        why: "Errors are rare and orthogonal to the while-loop rule.",
      },
      {
        text: "Because `if` is syntactically disallowed by pthreads.",
        correct: false,
        why: "`if` compiles fine — it is just wrong in this pattern.",
      },
      {
        text: "Because `while` makes the code faster in the common case.",
        correct: false,
        why: "Performance is not the issue — correctness is.",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 5,
  },
  {
    id: "final::cv-need-mutex",
    topicSlug: "04-concurrency/condition-variables",
    kind: "mcq",
    prompt:
      "Why must the mutex be held when calling pthread_cond_wait?",
    choices: [
      {
        text: "Without the mutex, a race between checking the predicate and calling wait can lose the signal, causing the waiter to sleep forever.",
        correct: true,
        why: "pthread_cond_wait atomically releases the mutex and sleeps; holding the mutex closes the window between the predicate check and the sleep.",
      },
      {
        text: "The mutex protects the condition variable object itself.",
        correct: false,
        why: "The CV is internally synchronized; the mutex protects the predicate and its interaction with the wait.",
      },
      {
        text: "It is required only for POSIX compliance, not correctness.",
        correct: false,
        why: "It is essential for correctness.",
      },
      {
        text: "It ensures the signal returns an error if sent too early.",
        correct: false,
        why: "Signals are not errored on CVs; they may be lost without proper locking.",
      },
    ],
    difficulty: "firm",
    source: "final-bank",
    points: 5,
  },
  {
    id: "final::cv-signal-vs-broadcast",
    topicSlug: "04-concurrency/covering-conditions",
    kind: "scenario",
    prompt:
      "A single CV `cv` is used by two classes of waiters: producers (waiting on `not_full`) and consumers (waiting on `not_empty`). Both classes share the same CV. After a consumer removes an item, it calls `pthread_cond_signal(&cv)`. Why can this cause the program to hang, and how do you fix it?",
    answer:
      "signal wakes exactly one arbitrary waiter. That waiter may be a consumer (who will find count==0 after rechecking and go back to sleep) while the producer that could proceed never wakes. The fix is either `pthread_cond_broadcast(&cv)` (wakes everyone, eligible ones proceed) or use two separate CVs (`not_full` and `not_empty`) so `signal` targets the right class.",
    explanation:
      "This is the covering-conditions scenario. Two CVs + signal is most efficient; one CV + broadcast is simpler but may wake threads unnecessarily.",
    difficulty: "firm",
    source: "final-bank",
    points: 8,
  },
  {
    id: "final::spinlock-fairness",
    topicSlug: "04-concurrency/spinlocks-and-ticket-locks",
    kind: "mcq",
    prompt:
      "Which spinlock variant guarantees FIFO fairness (bounded waiting)?",
    choices: [
      {
        text: "Ticket lock.",
        correct: true,
        why: "Each thread atomically grabs a ticket via FetchAndAdd and waits for its turn. FIFO order is guaranteed by the arrival order of tickets.",
      },
      {
        text: "TAS spinlock.",
        correct: false,
        why: "Raw TAS is first-come, first-served only in the sense of winning the TAS race — no ordering guarantee among contenders.",
      },
      {
        text: "TTAS (test-and-test-and-set).",
        correct: false,
        why: "TTAS reduces coherence traffic but does not impose FIFO order.",
      },
      {
        text: "Any spinlock on SMP hardware.",
        correct: false,
        why: "Fairness is a policy choice, not a hardware consequence.",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 4,
  },
  {
    id: "final::tas-vs-cas",
    topicSlug: "04-concurrency/tas-cas-llsc-primitives",
    kind: "mcq",
    prompt:
      "What is the primary advantage of CAS (compare-and-swap) over TAS (test-and-set) for implementing lock-free data structures?",
    choices: [
      {
        text: "CAS conditionally swaps only if the value matches an expected value, enabling optimistic concurrency for richer operations (e.g., atomic pointer updates in a lock-free stack).",
        correct: true,
        why: "TAS only writes 1. CAS lets you atomically replace a whole word conditionally, which is powerful enough to build stacks, queues, counters.",
      },
      {
        text: "CAS is always faster than TAS.",
        correct: false,
        why: "They have similar latency on most hardware; the difference is expressiveness.",
      },
      {
        text: "CAS avoids needing an atomic instruction at all.",
        correct: false,
        why: "CAS is atomic — implemented via a single instruction or LL/SC loop.",
      },
      {
        text: "CAS guarantees wait-freedom.",
        correct: false,
        why: "CAS enables lock-free, not wait-free; wait-freedom requires bounded steps for every thread.",
      },
    ],
    difficulty: "firm",
    source: "final-bank",
    points: 5,
  },
  {
    id: "final::semaphore-init-values",
    topicSlug: "04-concurrency/producer-consumer-semaphores",
    kind: "mcq",
    prompt:
      "For a bounded buffer with BSIZE slots using semaphores `empty`, `full`, and a binary `mutex`, what are the correct initial values?",
    choices: [
      {
        text: "empty = BSIZE, full = 0, mutex = 1.",
        correct: true,
        why: "Initially all slots are empty, no items present, mutex available.",
      },
      {
        text: "empty = 0, full = BSIZE, mutex = 1.",
        correct: false,
        why: "Swapped; this would let producers think the buffer is full and block immediately.",
      },
      {
        text: "empty = BSIZE, full = BSIZE, mutex = 1.",
        correct: false,
        why: "full cannot start at BSIZE — there are no items yet.",
      },
      {
        text: "empty = 1, full = 1, mutex = 0.",
        correct: false,
        why: "mutex = 0 would deadlock immediately; neither empty nor full match the slot count.",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 5,
  },
  {
    id: "final::semaphore-lock-order",
    topicSlug: "04-concurrency/producer-consumer-semaphores",
    kind: "short",
    prompt:
      "In the producer-consumer pattern using semaphores, why must the producer do `sem_wait(&empty)` *before* `sem_wait(&mutex)` rather than the other way around?",
    answer:
      "If the producer acquires mutex first and then waits on empty when the buffer is full, it blocks while holding the mutex. The consumer cannot enter the critical section to remove an item, so the buffer never drains — deadlock. Acquiring empty first lets the producer block *outside* the mutex, allowing the consumer to make progress.",
    explanation:
      "Rule of thumb: acquire the condition semaphore (empty/full) first, then the mutex; release in reverse order.",
    difficulty: "firm",
    source: "final-bank",
    points: 6,
  },
  {
    id: "final::semaphore-as-mutex",
    topicSlug: "04-concurrency/semaphores",
    kind: "mcq",
    prompt:
      "How do you implement a mutual-exclusion lock using only a semaphore?",
    choices: [
      {
        text: "Initialize the semaphore to 1; lock = sem_wait, unlock = sem_post.",
        correct: true,
        why: "A binary semaphore (init 1) behaves as a mutex. Only one thread at a time can hold the sem.",
      },
      {
        text: "Initialize the semaphore to 0; lock = sem_post, unlock = sem_wait.",
        correct: false,
        why: "Init 0 means the first lock call blocks forever — no one has posted.",
      },
      {
        text: "Initialize to the number of threads; lock = sem_wait, unlock = sem_post.",
        correct: false,
        why: "That would allow all threads in simultaneously — no mutual exclusion.",
      },
      {
        text: "It's impossible; semaphores cannot enforce mutual exclusion.",
        correct: false,
        why: "A binary semaphore IS a mutex.",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 4,
  },
  {
    id: "final::lock-ordering-deadlock",
    topicSlug: "05-deadlock/prevent-circular-wait",
    kind: "scenario",
    prompt:
      "Thread T1 runs `lock(a); lock(b);` and thread T2 runs `lock(b); lock(a);`. Describe a deadlock schedule and give a fix that preserves concurrency as much as possible.",
    answer:
      "Deadlock schedule: T1 acquires a and is preempted. T2 acquires b and is preempted. T1 resumes, tries to lock b — blocks. T2 resumes, tries to lock a — blocks. Circular wait, neither makes progress. Fix: impose a global lock order (e.g., by address): both threads first lock min(&a,&b) then max(&a,&b). No cycle is possible because all threads acquire in the same order.",
    explanation:
      "This breaks the circular-wait condition while still allowing threads to hold multiple locks simultaneously (preserving parallelism for non-conflicting locks).",
    difficulty: "firm",
    source: "final-bank",
    points: 8,
  },
  {
    id: "final::race-condition-counter",
    topicSlug: "04-concurrency/race-conditions",
    kind: "short",
    prompt:
      "Two threads each execute `counter++` 1000 times on a shared integer `counter`. The final value is sometimes less than 2000. Explain the race and give one-line fixes using (a) pthread mutex and (b) atomic fetch-and-add.",
    answer:
      "counter++ decomposes to load; add; store. Two threads can both load the same value, both add 1, and both store the same result — one update is lost. Fix (a): wrap in pthread_mutex_lock(&m); counter++; pthread_mutex_unlock(&m). Fix (b): replace with __atomic_add_fetch(&counter, 1, __ATOMIC_SEQ_CST).",
    explanation:
      "This is the canonical data race used to motivate atomicity. Both fixes serialize the read-modify-write.",
    difficulty: "gentle",
    source: "final-bank",
    points: 5,
  },
  {
    id: "final::dining-philosophers-fix",
    topicSlug: "05-deadlock/dining-philosophers",
    kind: "mcq",
    prompt:
      "Five philosophers, each with `lock(left); lock(right);`. What is the minimal change that prevents deadlock while keeping concurrency?",
    choices: [
      {
        text: "Have one philosopher (e.g., #4) lock right before left — breaks the symmetry so no cycle can form.",
        correct: true,
        why: "Asymmetry breaks the circular-wait condition. Simple, one-line fix.",
      },
      {
        text: "Make the chopsticks non-exclusive (multiple philosophers can hold the same chopstick).",
        correct: false,
        why: "That violates mutual exclusion, the problem's basic requirement.",
      },
      {
        text: "Put all philosophers in one thread.",
        correct: false,
        why: "Serializes everything; no concurrency.",
      },
      {
        text: "Never unlock the chopsticks.",
        correct: false,
        why: "Immediate deadlock on the first philosopher's second chopstick.",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 5,
  },

  // ==========================================================================
  // PERSISTENCE — (48 pts, includes 16 pts on inconsistency/recovery)
  // ==========================================================================
  {
    id: "final::hdd-io-time",
    topicSlug: "06-persistence/03-hdd-mechanics-io-time",
    kind: "short",
    prompt:
      "An HDD has 6 ms average seek, 10000 RPM, and 200 MB/s transfer rate. Compute the total time for one random 4 KB read. Show each component.",
    answer:
      "Seek = 6 ms. Rotation (half rev) = 60000/10000/2 = 3 ms. Transfer = 4 KB / 200 MB/s = 0.02 ms. Total = 6 + 3 + 0.02 = 9.02 ms.",
    explanation:
      "Random reads are dominated by seek + rotation. Transfer is negligible at this block size.",
    difficulty: "gentle",
    source: "final-bank",
    points: 6,
  },
  {
    id: "final::sequential-vs-random",
    topicSlug: "06-persistence/03-hdd-mechanics-io-time",
    kind: "mcq",
    prompt:
      "Why is sequential HDD throughput so much higher than random throughput?",
    choices: [
      {
        text: "Sequential access amortizes one seek and one rotation over many blocks; random access pays both per block.",
        correct: true,
        why: "A single seek+rotation can serve a 1 MB sequential read at full transfer rate, but each random 4 KB read pays the full seek+rotation.",
      },
      {
        text: "Sequential reads use a different disk command that is faster.",
        correct: false,
        why: "Same read command; the difference is geometric — blocks are contiguous on the track.",
      },
      {
        text: "HDDs cache only sequential data.",
        correct: false,
        why: "HDD caches are small and opportunistic; the big effect is geometry.",
      },
      {
        text: "Sequential reads disable rotational delay.",
        correct: false,
        why: "Rotation is a physical constraint; sequential reads just don't re-incur it per block.",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 4,
  },
  {
    id: "final::fd-vs-oft-vs-inode-cache",
    topicSlug: "06-persistence/07-fd-openfile-inode-tables",
    kind: "mcq",
    prompt:
      "After `fork()`, the parent and child each hold a file descriptor (FD) 3 referring to the same open file. Which statement is correct?",
    choices: [
      {
        text: "Both FDs point to the same open-file-table entry, so reads in either process advance the shared offset.",
        correct: true,
        why: "fork duplicates the FD table but both entries reference the same open-file-table entry where the offset lives.",
      },
      {
        text: "Each process has its own independent offset on the file.",
        correct: false,
        why: "Only if each process opens the file separately with open(). fork shares the offset.",
      },
      {
        text: "Only the parent's reads advance the offset; the child reads from offset 0.",
        correct: false,
        why: "Both share the entry and both advance the offset.",
      },
      {
        text: "The inode cache is duplicated per process.",
        correct: false,
        why: "The inode cache is a single kernel-wide structure.",
      },
    ],
    difficulty: "firm",
    source: "final-bank",
    points: 5,
  },
  {
    id: "final::open-path-walk-reads",
    topicSlug: "06-persistence/13-file-operations-io-counts",
    kind: "short",
    prompt:
      "Filesystem has one inode per directory level. Compute the number of disk reads required for `open(\"/a/b/c\")` assuming the root inode is known. Show each read.",
    answer:
      "7 reads: (1) root inode (from inode table), (2) root's data block (find 'a'), (3) a's inode, (4) a's data block (find 'b'), (5) b's inode, (6) b's data block (find 'c'), (7) c's inode. Some textbooks add an 8th implicit superblock read.",
    explanation:
      "This is the canonical path-walk cost and appears on almost every OS final exam under filesystem implementation.",
    difficulty: "firm",
    source: "final-bank",
    points: 7,
  },
  {
    id: "final::write-is-not-one-write",
    topicSlug: "06-persistence/15-crash-consistency",
    kind: "short",
    prompt:
      "The professor emphasized: \"a write to disk is not a single write.\" Explain what this means for a single-block append to a file in a simple inode-based filesystem.",
    answer:
      "Appending one block requires three physical writes: the data block itself (W1), the inode (update block pointer and size — W2), and the data bitmap (mark the allocated block used — W3). If any subset of these three writes completes before a crash, the filesystem is inconsistent (leaked blocks, dangling pointers, or garbage reads). Crash consistency mechanisms (journaling, FSCK) exist precisely because one logical write expands into multiple physical writes.",
    explanation:
      "Memorize the three writes and the resulting failure modes for each subset of completed writes (see Drill 7 in persistence-final-drills.md).",
    difficulty: "firm",
    source: "final-bank",
    points: 8,
  },
  {
    id: "final::journal-modes",
    topicSlug: "06-persistence/17-journaling-modes",
    kind: "mcq",
    prompt:
      "Which journaling mode writes data blocks to the journal as well as to their final locations, giving the strongest crash guarantees at the cost of doubling data writes?",
    choices: [
      {
        text: "Data journaling.",
        correct: true,
        why: "Every block (data and metadata) is written to the journal and then checkpointed to its final home. Slowest, safest.",
      },
      {
        text: "Ordered journaling.",
        correct: false,
        why: "Data is written to its final home first (not in the journal); metadata is journaled. Balance of safety and speed.",
      },
      {
        text: "Metadata journaling.",
        correct: false,
        why: "Only metadata is journaled; data and metadata writes can reorder, so a crash may leave inodes pointing at uninitialized blocks.",
      },
      {
        text: "No journaling.",
        correct: false,
        why: "Then FSCK is the only recovery tool, not journaling.",
      },
    ],
    difficulty: "firm",
    source: "final-bank",
    points: 5,
  },
  {
    id: "final::revoke-record",
    topicSlug: "06-persistence/19-revoke-records-and-block-reuse",
    kind: "scenario",
    prompt:
      "Block B is freed by transaction Tx1 (committed) and reallocated to a new file by transaction Tx2 (also committed). The system crashes. On reboot, the journal is replayed. Without revoke records, what can go wrong, and how do revoke records prevent it?",
    answer:
      "Without revoke records, replay of Tx1 may write the old metadata (or data) for block B back to disk, overwriting the new contents written by Tx2. Revoke records tell recovery: \"do not replay any journal entry touching this block.\" When Tx1 freed block B, a revoke record is inserted; on recovery, the replay logic skips any Tx1 entries for B, preserving Tx2's newer contents.",
    explanation:
      "This is a required question shape for the inconsistency/recovery block (16 pts).",
    difficulty: "tricky",
    source: "final-bank",
    points: 8,
  },
  {
    id: "final::fsync-vs-write",
    topicSlug: "06-persistence/14-write-vs-fsync",
    kind: "mcq",
    prompt:
      "A user-space program calls `write(fd, buf, 256)` and the call returns successfully. The system crashes 100 ms later. Is the data on disk?",
    choices: [
      {
        text: "Probably not — write returns once data is in the kernel page cache; the cache flushes periodically or on fsync. Without fsync, a crash can lose the data.",
        correct: true,
        why: "Durability requires fsync (or O_SYNC on open). Plain write is buffered.",
      },
      {
        text: "Yes, write blocks until the data is durable on disk.",
        correct: false,
        why: "That would make every write cost milliseconds — totally impractical.",
      },
      {
        text: "Yes, because journaling guarantees it.",
        correct: false,
        why: "Journaling protects filesystem integrity, not user-data durability.",
      },
      {
        text: "No, write only records the intent; it never actually touches disk.",
        correct: false,
        why: "The kernel will flush the page cache eventually; it is not a no-op.",
      },
    ],
    difficulty: "firm",
    source: "final-bank",
    points: 5,
  },
  {
    id: "final::ffs-block-group-policy",
    topicSlug: "06-persistence/12-ffs-cylinder-groups",
    kind: "mcq",
    prompt:
      "FFS spreads directories across cylinder groups but co-locates files with their parent directory. Why the asymmetry?",
    choices: [
      {
        text: "Spreading directories preserves per-group free space for subtree locality; co-locating files with their parent amortizes seek when the subtree is accessed.",
        correct: true,
        why: "If all directories piled into one group, that group would fill and subtree locality would fail for newer trees. Files belong near their parent because directory listings usually read related files together.",
      },
      {
        text: "Directories are larger than files and need more space.",
        correct: false,
        why: "Directories are typically small; the policy is about future fairness, not current size.",
      },
      {
        text: "The inode bitmap only permits one directory per group.",
        correct: false,
        why: "No such restriction exists.",
      },
      {
        text: "Spreading directories avoids TLB conflicts.",
        correct: false,
        why: "TLBs are per-CPU for memory; unrelated to filesystem group policy.",
      },
    ],
    difficulty: "firm",
    source: "final-bank",
    points: 4,
  },
  {
    id: "final::disk-scheduling-sstf-starvation",
    topicSlug: "06-persistence/04-disk-scheduling",
    kind: "mcq",
    prompt:
      "Which disk-scheduling algorithm can starve far-away requests?",
    choices: [
      {
        text: "SSTF (Shortest Seek Time First) — always picks the nearest request, so a steady stream of nearby requests leaves far ones unserved.",
        correct: true,
        why: "This is SSTF's classic weakness. SCAN and C-SCAN fix it by sweeping.",
      },
      {
        text: "FCFS.",
        correct: false,
        why: "FCFS serves in arrival order — no starvation, but high seek cost.",
      },
      {
        text: "SCAN (elevator).",
        correct: false,
        why: "SCAN sweeps a direction, reverses, and sweeps back — every request is served within one sweep cycle.",
      },
      {
        text: "C-SCAN.",
        correct: false,
        why: "C-SCAN sweeps in one direction and jumps back — still bounded wait time.",
      },
    ],
    difficulty: "gentle",
    source: "final-bank",
    points: 4,
  },
  {
    id: "final::inode-max-file-size",
    topicSlug: "06-persistence/09-inode-multi-level-index",
    kind: "short",
    prompt:
      "An inode has 12 direct block pointers, 1 single-indirect, and 1 double-indirect. Block size = 4 KB, pointer size = 4 B. Compute the maximum file size.",
    answer:
      "Pointers per block = 4 KB / 4 B = 1024. Direct: 12 × 4 KB = 48 KB. Single-indirect: 1024 × 4 KB = 4 MB. Double-indirect: 1024 × 1024 × 4 KB = 4 GB. Total ≈ 48 KB + 4 MB + 4 GB ≈ 4 GB.",
    explanation:
      "If a triple-indirect pointer is added: 1024^3 × 4 KB = 4 TB, so max ≈ 4 TB.",
    difficulty: "firm",
    source: "final-bank",
    points: 6,
  },
  {
    id: "final::fsck-passes",
    topicSlug: "06-persistence/16-fsck",
    kind: "short",
    prompt:
      "Why did journaling replace FSCK as the primary crash-recovery mechanism in modern filesystems?",
    answer:
      "FSCK runtime is O(filesystem size) — it scans every inode, every block pointer, and every directory to rebuild bitmaps and link counts. For terabyte-scale filesystems this takes hours. Journaling recovery runtime is O(transactions since last checkpoint) — typically a few seconds after a crash because only the uncommitted tail of the log needs replay (or discard). Journaling also prevents the inconsistency by design, rather than repairing it afterward.",
    explanation:
      "FSCK still runs occasionally as a consistency check, but not on every boot.",
    difficulty: "firm",
    source: "final-bank",
    points: 6,
  },
  {
    id: "final::crash-three-writes",
    topicSlug: "06-persistence/15-crash-consistency",
    kind: "mcq",
    prompt:
      "After a crash during a file append, the data block was written but neither the inode nor the data bitmap was updated. What is the resulting filesystem state?",
    choices: [
      {
        text: "The block contents are on disk but the bitmap says free and no inode points to them; the next allocator call will hand out the block and overwrite the unreferenced data. User data is effectively lost but no FS metadata is corrupted.",
        correct: true,
        why: "This is the W1-only crash scenario from Drill 7 in persistence-final-drills.md.",
      },
      {
        text: "The file is fully recoverable.",
        correct: false,
        why: "The inode doesn't know about the block; the user sees no appended data.",
      },
      {
        text: "The filesystem must be reformatted.",
        correct: false,
        why: "FSCK or journaling replay handles this without reformatting.",
      },
      {
        text: "The inode table is corrupted.",
        correct: false,
        why: "The inode was never updated; it is still in its old consistent state.",
      },
    ],
    difficulty: "firm",
    source: "final-bank",
    points: 5,
  },
  {
    id: "final::ordered-journaling-data-safety",
    topicSlug: "06-persistence/17-journaling-modes",
    kind: "mcq",
    prompt:
      "Why does metadata-only journaling still allow user-data corruption after a crash, and how does ordered journaling fix it?",
    choices: [
      {
        text: "In metadata-only journaling, data writes are not ordered w.r.t. metadata writes. A crash can leave the inode pointing at a data block whose user data hasn't yet been written, so reads return garbage. Ordered journaling forces data writes to disk before the metadata transaction is committed.",
        correct: true,
        why: "Ordered mode is the most common default (Linux ext3/ext4 'data=ordered').",
      },
      {
        text: "Metadata-only journaling doesn't journal the inode, only the data bitmap.",
        correct: false,
        why: "It journals all metadata, including inodes. The issue is the data ordering.",
      },
      {
        text: "Ordered journaling is the same as metadata-only; they have the same guarantees.",
        correct: false,
        why: "Ordered adds the data-before-metadata constraint.",
      },
      {
        text: "Both modes lose user data equally.",
        correct: false,
        why: "Ordered is strictly safer for user data.",
      },
    ],
    difficulty: "tricky",
    source: "final-bank",
    points: 5,
  },
];
