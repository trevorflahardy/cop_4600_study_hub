# fork / exec / wait — Creating and Running Processes

## Definition

Three syscalls form the foundation of Unix process creation: fork() duplicates the current process, exec() replaces the current process's image with a new program, and wait() blocks until a child process terminates. Together they enable a parent process to spawn, control, and manage child processes.

## When to use

- Creating new processes in user code (starting a web server, launching a worker thread pool, running a command from a shell).
- Understanding how a shell implements command execution and backgrounding.
- Explaining how parent-child process relationships work and how the OS tracks them.
- Implementing process synchronization and communication patterns.
- Debugging process creation issues and race conditions.

## Key ideas

The three syscalls work together in a characteristic pattern:

### fork() — Create a new process

fork() creates an exact copy of the calling process, including address space, registers, and open files. The new process is called the child; the original is the parent.

**Key behavior**:
- fork() returns twice: once in the parent (with the child's PID), once in the child (with 0).
- The child is an independent copy of the parent at the moment of fork().
- If fork() fails, it returns -1 to the parent; the child is not created.

**Example from Week 2_1 (p1.c)**:

```c
int rc = fork();
if (rc < 0) {
    // fork failed
    fprintf(stderr, "fork failed\n");
    exit(1);
} else if (rc == 0) {
    // child process (fork returned 0)
    printf("hello, I am child (pid:%d)\n", (int) getpid());
} else {
    // parent process (fork returned child's PID)
    printf("hello, I am parent of %d (pid:%d)\n", rc, (int) getpid());
}
```

**Concrete PID example from Week 2_1**: Parent PID 29146 calls fork(), child is assigned PID 29147. The parent sees fork() return 29147, the child sees it return 0.

### exec() — Replace the process image

exec() loads a new program into the current process's memory, replacing the text, data, heap, and stack. The process ID remains the same; only the code and data change. If exec() succeeds, it does not return (the new program runs). If it fails, it returns -1 and the old process continues.

**Key behavior**:
- exec() takes a program name and argument array.
- Common variants: execvp (searches PATH), execv (no PATH search), execl (list of args), etc.
- The new process inherits open file descriptors (unless marked close-on-exec).

**Example from Week 2_1 (p3.c)**:

```c
char *myargs[3];
myargs[0] = strdup("wc");     // program name
myargs[1] = strdup("p3.c");   // argument
myargs[2] = NULL;              // end of array
execvp(myargs[0], myargs);     // runs wc p3.c
printf("this shouldn't print out");  // unreached if exec succeeds
```

### wait() — Wait for a child to terminate

wait() blocks the parent until a child process terminates (either by calling exit or by being killed). wait() returns the child's PID. It reaps the child's exit status, removing it from the process table.

**Key behavior**:
- If multiple children exist, wait() returns when any child exits.
- If no children exist, wait() returns -1.
- The parent can retrieve the child's exit status (encoded in the return value).

**Example from Week 2_1 (p2.c)**:

```c
int rc = fork();
if (rc < 0) {
    exit(1);
} else if (rc == 0) {
    printf("hello, I am child (pid:%d)\n", (int) getpid());
} else {
    int wc = wait(NULL);
    printf("hello, I am parent of %d (wc:%d) (pid:%d)\n",
           rc, wc, (int) getpid());
}
```

Output (deterministic order because parent waits):
```
prompt> ./p2
hello world (pid:29266)
hello, I am child (pid:29267)
hello, I am parent of 29267 (wc:29267) (pid:29266)
```

### The complete pattern: fork, exec, wait

A shell typically uses this sequence:
1. fork() to create a child.
2. exec() in the child to load the user's command.
3. wait() in the parent for the child to finish.

## I/O Redirection with fork and file descriptors

The fork-exec pattern is powerful because the child inherits the parent's file descriptors. A shell can redirect output by closing and reopening file descriptor 0 (stdin), 1 (stdout), or 2 (stderr) before exec().

**Example from Week 2_1 (p4.c)**: `ls > out.txt`

```c
int rc = fork();
if (rc == 0) {
    // child: redirect stdout to a file
    close(STDOUT_FILENO);  // close file descriptor 1
    open("./p4.output", O_CREAT|O_WRONLY|O_TRUNC, S_IRWXU);
    // open() returns the lowest available FD (1)
    
    char *myargs[3];
    myargs[0] = strdup("wc");
    myargs[1] = strdup("p4.c");
    myargs[2] = NULL;
    execvp(myargs[0], myargs);  // wc's output goes to file
} else {
    wait(NULL);  // parent waits for child
}
```

The child's stdout is now redirected to "p4.output" because close() freed FD 1 and open() reused it.

## Classic exam puzzle: fork in a loop

A common exam question: what does this print?

```c
for (int i = 0; i < 2; i++) {
    fork();
}
printf("done\n");
```

Answer: "done" prints 4 times (2^2 processes exist at the end).

- After iteration 1: 2 processes (parent + 1 child).
- After iteration 2: 4 processes (each of the 2 existing processes forks).

Each process prints "done" once, so 4 total.

## Common exam questions

- How does fork() return different values in parent and child? Why is this design useful?
- Write code to fork a child, exec a program in the child, and wait for the child in the parent.
- What does `fork()` return on success? What does it return in the child and parent?
- How can a shell implement I/O redirection (e.g., `ls > out.txt`) using fork, close, open, and exec?
- Trace the execution of a fork loop (e.g., two fork() calls in a loop) and count the number of processes created.
- What happens if a parent calls wait() before any child calls exit()? What if wait() is never called?

## Gotchas

- **Non-deterministic order**: Without wait(), parent and child can print in any order. The scheduler decides which runs first. Use wait() to enforce ordering.
- **File descriptor inheritance**: The child inherits all open file descriptors. If the parent opens a file before fork, both parent and child can write to it. This is useful (redirection) but also a source of bugs.
- **Only one fork call per execution**: In the simple fork-exec-wait pattern, fork() is called once per child. Calling fork() in a loop creates a tree of processes (2, 4, 8, ... depending on loop count).
- **exec replaces address space**: After exec(), the process no longer exists in memory. All local variables and heap allocations are gone. Only the PID persists.
- **Exit vs. return**: A process exits when main() returns or when exit() is called. The return value of main (or argument to exit) becomes the exit status.

## Pseudocode

Basic fork-exec-wait pattern:

```c
int main() {
    pid_t pid = fork();
    
    if (pid < 0) {
        // Error
        perror("fork");
        exit(1);
    } else if (pid == 0) {
        // Child: execute new program
        char *args[] = {"program_name", "arg1", "arg2", NULL};
        execvp(args[0], args);
        // If exec succeeds, this line is not reached
        perror("exec");
        exit(1);
    } else {
        // Parent: wait for child
        int status;
        waitpid(pid, &status, 0);
        printf("Child exited with status %d\n", status);
    }
    return 0;
}
```

## Sources

- Week2_1.pdf: fork() definition and return values, examples p1.c (fork without wait—non-deterministic output), p2.c (fork with wait—deterministic output), p3.c (fork-exec-wait with wc), p4.c (fork-exec-wait with I/O redirection), concrete PID example (parent 29146 → child 29147), redirection via close/open.
- Midterm 1 Practice Answers: fork timing and order of output.
- Midterm1-v2.pdf: fork loop (2 iterations prints 4 times), shell redirections.
