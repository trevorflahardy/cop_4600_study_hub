# Fork / Exec / Wait — Output Enumeration Drills

> Confirmed final-exam item: one 10-point "list all possible outputs" problem
> over fork / exec / wait. Every problem below uses the same systematic
> method; memorize it and this question becomes free points.

## How to solve "list all possible outputs" in three steps

1. **Write down the happens-before edges.** For each process, the print order
   inside its own code is a hard constraint (A before B if they appear in
   that order in one process). fork clones the process and gives you two
   independent program orders that can interleave freely.
2. **Add the wait edge.** If the parent calls `wait(NULL)`, every print
   the parent does *after* the wait is forced to come after every print the
   child does *before* it exits. In practice: every child print
   happens-before every parent print that follows the wait call.
3. **Add the exec edge.** After a successful `execlp` (or any exec variant)
   in the child, every statement after the exec call is dead code — it
   never runs. The new program's output (`echo`, `ls`, etc.) is what the
   child prints, and it is program-ordered after any prints that came
   before the exec.

Once the edges are written down, the problem collapses to enumerating the
topological sorts of a small DAG. With four labels and three or four
edges the count is always 1-6.

## Worked example 1 (final exam review deck, problem 1)

```c
int main() {
    int pid = fork();
    if (pid == 0) {
        printf("A\n");
        printf("B\n");
    } else {
        printf("C\n");
        wait(NULL);
        printf("D\n");
    }
    return 0;
}
```

### Happens-before edges

- Child program order: A < B.
- Parent program order: C < D.
- wait edge: B < D (child must finish before wait returns, and D follows
  wait in the parent). Note there is no edge forcing A before anything
  parent-side — C can interleave freely with A and B.

### Enumeration

D must come last (A < B < D and C < D mean all other labels precede D).
Distribute A, B, C in positions 1-3 with A < B:

| # | Output | Check |
|---|--------|-------|
| 1 | A B C D | A<B ok, C<D ok, B<D ok |
| 2 | A C B D | A<B ok, C<D ok, B<D ok |
| 3 | C A B D | A<B ok, C<D ok, B<D ok |

**Answer: 3 possible outputs** — `ACBD`, `ABCD`, `CABD`.

### Why not CBAD, BCAD, BACD?

CBAD and BCAD put B before A — violates child program order.
BACD puts B first but ends with D not after C? BACD has D in position 3,
C in position 4 — violates C < D. Dropped.

## Worked example 2 (final exam review deck, problem 2)

```c
int main() {
    if (fork() == 0) {
        printf("A\n");
    } else {
        printf("B\n");
        wait(NULL);
        printf("C\n");
    }
    return 0;
}
```

### Happens-before edges

- Child: only prints A. No internal order beyond A existing.
- Parent: B < C (program order).
- wait edge: A < C (child must exit before wait returns).

### Enumeration

C must come last. A and B fill slots 1 and 2 freely:

| # | Output | Check |
|---|--------|-------|
| 1 | A B C | A<C ok, B<C ok |
| 2 | B A C | A<C ok, B<C ok |

**Answer: 2 possible outputs** — `ABC`, `BAC`.

### Why not ACB?

A<C is satisfied, B<C is violated (B would be after C). Dropped.

## Worked example 3 (final exam review deck, problem 3)

```c
int main() {
    if (fork() == 0) {
        printf("A\n");
        execlp("echo", "echo", "B", NULL);
        printf("C\n");
    } else {
        wait(NULL);
        printf("D\n");
    }
    return 0;
}
```

### Happens-before edges

- Child: A runs, then the `execlp` call replaces the process image with
  `echo B`, which prints `B`. The `printf("C\n")` after execlp is **dead
  code** — it never runs unless execlp fails. So the child emits A then B
  in order.
- Parent: wait blocks until the child (now running `echo`) exits. Then
  D prints.
- wait edge: B < D (child must exit before wait returns).

### Enumeration

A < B < D is a total order. No freedom.

**Answer: 1 possible output** — `A B D` (one print per line; `echo` adds
its own newline after B).

### Gotcha: "but what about C?"

C only appears if execlp fails (e.g., typo in program name, PATH issue).
On exam problems assume the exec succeeds unless told otherwise. If you
want to earn the partial-credit edge case, add: "If execlp fails, child
prints A then C, yielding `A C D` as an additional output." Do **not**
list this as a first-class answer unless the professor asks.

### Gotcha: stdout buffering

`printf("A\n")` writes to stdout. If stdout is line-buffered (the default
when connected to a terminal), the `\n` flushes A before the exec call
wipes the buffer. If stdout is block-buffered (e.g., output piped to a
file), the buffer might be flushed by the exec call (glibc does flush on
exec via atexit handlers) or might be lost — implementation-defined. For
exam purposes assume line-buffered terminal: A always appears.

## Drill 4 — two children, one wait

```c
int main() {
    printf("S\n");
    if (fork() == 0) {
        printf("A\n");
        return 0;
    }
    if (fork() == 0) {
        printf("B\n");
        return 0;
    }
    wait(NULL);
    printf("E\n");
    return 0;
}
```

### Edges

- S runs once (before any fork), in the parent only.
- After first fork, child-1 prints A.
- After second fork (done by the parent since child-1 already returned),
  child-2 prints B.
- Parent: S < (fork 1) < (fork 2) < wait < E.
- `wait(NULL)` returns when *any* one child exits; it does **not** reap
  both. So only one of {A, B} is guaranteed to precede E.
- Happens-before: S first; A and B unordered w.r.t. each other.

### Enumeration

S is always first. E must come after at least one of {A,B}. The other can
land before or after E.

| # | Output |
|---|--------|
| 1 | S A B E |
| 2 | S B A E |
| 3 | S A E B |
| 4 | S B E A |

**Answer: 4 possible outputs.** Because only one wait call was made, the
second child may still be running when the parent prints E and even when
the parent exits — an orphan/zombie situation. The exam answer still
lists all four.

## Drill 5 — fork in a loop

```c
int main() {
    for (int i = 0; i < 2; i++) {
        fork();
    }
    printf("X\n");
    return 0;
}
```

### Process tree

- Start: 1 process (P0).
- After i=0 fork: 2 processes (P0, P1).
- After i=1 fork: 4 processes (P0, P1, P2, P3). Each of the two existing
  processes forked once more.

### Enumeration

Each of 4 processes prints `X` exactly once. **Answer: "X" appears 4
times**, but the relative order is unconstrained — any of 4! = 24
interleavings is possible.

On the exam, write: "The string `X\n` appears four times; the order
between the four `X` prints is nondeterministic."

## Drill 6 — fork with wait inside child

```c
int main() {
    if (fork() == 0) {
        if (fork() == 0) {
            printf("G\n");
            return 0;
        }
        wait(NULL);
        printf("C\n");
        return 0;
    }
    wait(NULL);
    printf("P\n");
    return 0;
}
```

### Edges

- Grandchild prints G and exits.
- Child waits for grandchild, then prints C. So G < C.
- Parent waits for child, then prints P. Child exits only after C.
  So C < P. Transitively G < P.

### Enumeration

Total order: G < C < P. **Answer: 1 possible output** — `G C P`.

## Drill 7 — exec without wait

```c
int main() {
    if (fork() == 0) {
        printf("A\n");
        execlp("echo", "echo", "B", NULL);
        printf("X\n");
    } else {
        printf("C\n");
    }
    return 0;
}
```

### Edges

- Child: A < B (B from echo after the exec call).
- Parent: C has no ordering vs. child (no wait).

### Enumeration

A < B is the only hard edge. C interleaves freely.

| # | Output |
|---|--------|
| 1 | A B C |
| 2 | A C B |
| 3 | C A B |

**Answer: 3 possible outputs** — `ABC`, `ACB`, `CAB`.

(CBA and BAC are invalid because they violate A < B. BCA invalid because
B comes before A.)

## Drill 8 — two printfs before fork

```c
int main() {
    printf("X\n");
    printf("Y\n");
    if (fork() == 0) {
        printf("Z\n");
    } else {
        wait(NULL);
        printf("W\n");
    }
    return 0;
}
```

### Edges

- X < Y (program order, both before fork, printed once by parent).
- After fork, child inherits no pending prints — X and Y have already
  been flushed by parent. Child only prints Z.
- Parent: wait then W. Z < W (wait edge).

### Enumeration

X < Y < (anything after). Z < W. Parent's next print after fork is W,
and W is gated by wait on Z.

**1 output: `X Y Z W`**.

### Gotcha: buffering duplicates

This is only clean because X and Y were printed with newlines (flushing
line-buffered stdout) before fork. If you drop the `\n`:

```c
printf("X");
printf("Y");
if (fork() == 0) { ... }
```

Then the "XY" is still in stdout's buffer when fork clones the address
space. Both processes carry a copy of "XY" in their buffer and both flush
on exit — so the terminal prints "XY" *twice*. Classic exam trap.

## Drill 9 — fork, wait, exec sequence

```c
int main() {
    if (fork() == 0) {
        execlp("echo", "echo", "child", NULL);
    }
    wait(NULL);
    printf("parent-done\n");
    return 0;
}
```

### Edges

- Child runs echo, prints "child", exits.
- Parent waits, prints "parent-done".
- wait edge: "child" < "parent-done".

### Enumeration

**1 output:**
```
child
parent-done
```

## Drill 10 — nested fork in else branch

```c
int main() {
    if (fork() == 0) {
        printf("A\n");
    } else {
        if (fork() == 0) {
            printf("B\n");
        } else {
            printf("C\n");
            wait(NULL);
            printf("D\n");
        }
    }
    return 0;
}
```

### Process tree

- P0 forks P1 (child of first fork). P1 prints A and exits. P0 goes into
  else and forks P2. P2 prints B and exits. P0 prints C, waits, prints D.
- `wait(NULL)` in P0 reaps the first available child — either P1 or P2,
  whichever exits first. The *other* is not waited on.

### Edges

- A (by P1), B (by P2), C < D (in P0). At least one of {A, B} exits
  before wait returns, so at least one of {A, B} < D.

### Enumeration

C appears once. A and B can interleave with C freely; at least one of
them must precede D. Listing all:

| # | Output | Why valid |
|---|--------|-----------|
| 1 | A B C D | both A and B before D; C < D; fine |
| 2 | B A C D | same |
| 3 | A C B D | A < D (P1 reaped); B < D ok; fine |
| 4 | B C A D | B < D (P2 reaped); A < D ok; fine |
| 5 | C A B D | A, B before D; fine |
| 6 | C B A D | same |
| 7 | A C D B | A < D satisfies wait; B after D ok |
| 8 | B C D A | B < D satisfies wait; A after D ok |
| 9 | C A D B | A < D; B after D |
| 10 | C B D A | B < D; A after D |

**Answer: 10 possible outputs.** This is the hardest shape the professor
is likely to hand you — if you can crank through this one, the others
are free.

## The cheat sheet (write this on the scratch paper first)

1. Draw a box per process; inside each box, list its prints top-to-bottom.
2. For every `wait(NULL)` the parent calls, draw an edge from each child
   print to every parent print *after* the wait.
3. For every exec call in the child, the child's post-exec statements
   are gone — cross them out. The new program's output slots in at the
   exec point.
4. Enumerate topological sorts. If the DAG is almost-linear, count is
   small (1-3); if multiple parent-child pairs are independent, count
   grows like 2^k or k!.

## Common exam questions

- List all possible outputs of the code above, and briefly justify one
  output that is *not* possible.
- Does `wait(NULL)` reap all children, or just one? What happens to the
  other children?
- If `printf("A")` is called with no newline before fork, does "A" print
  once or twice? Why?
- Modify this code so that output is deterministic. (Answer: add wait in
  the parent before its next print.)
- If the parent calls wait twice (once per child), how does the
  possible-output set change?

## Gotchas

- **`wait(NULL)` reaps one child.** If you have N children and want
  determinism, you need N waits.
- **exec nukes post-exec code.** Do not count `printf` lines that come
  *after* the exec call. They never print unless exec fails.
- **Line-buffered vs block-buffered stdout.** `printf("x\n")` to a
  terminal flushes immediately. `printf("x")` to a pipe or file may
  survive fork and get duplicated. Assume line-buffered terminal on the
  exam unless stated otherwise.
- **fork return value conventions.** `== 0` means "I am the child".
  `> 0` means "I am the parent, and the value is the child's PID".
  `< 0` means fork failed. Mixing these up changes which branch runs.
- **`if (fork() == 0)` vs `int pid = fork(); if (pid == 0)`.** They are
  equivalent. The second lets the parent remember the child's PID for
  targeted `waitpid`.
- **Order is not FIFO.** Don't assume parent or child runs first. The
  scheduler picks, and it can preempt either at any print.

## Sources

- Professor's final-exam hint deck (slide 8): three fork / exec / wait
  "list all possible outputs" problems, confirmed as a 10-point item.
- OSTEP chapter 5 (Process API): fork, exec, wait semantics and
  concrete PID traces.
- Week 2_1 lecture deck: p1.c, p2.c, p3.c, p4.c worked examples.
- Midterm 1 practice: fork loop counting, fork ordering with and without
  wait.
