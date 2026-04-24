# Shell I/O Redirection

## Definition

Shell I/O redirection is the mechanism by which a shell implements commands like `ls > out.txt` (output redirection), `cat < in.txt` (input redirection), and `prog1 | prog2` (piping). It works by forking a child process, closing and reopening file descriptors to point to files or pipes before exec(), then running the desired program. The closed FDs are reused by open() at the lowest available number.

## When to use

- Understanding how shells execute commands with redirected input/output.
- Implementing shell-like programs or job control systems.
- Explaining how pipes work at the process level.
- Debugging file descriptor issues (e.g., unintended redirection in child processes).
- Writing code that inherits and manages file descriptors correctly.

## Key ideas

### File descriptors (FDs)

Each process has a file descriptor table with slots for open files. Standard FDs are:
- **0 (stdin)**: Standard input (keyboard by default).
- **1 (stdout)**: Standard output (terminal by default).
- **2 (stderr)**: Standard error (terminal by default).

Additional FDs (3, 4, 5, ...) are allocated by open() calls and represent open files, pipes, sockets, etc.

### Redirecting output: `command > file`

When a shell executes `ls > out.txt`:

1. **fork()**: Create a child process.
2. **close(STDOUT_FILENO)**: Close FD 1 (stdout), freeing its slot.
3. **open("out.txt", ...)**: Open the file. open() returns the lowest available FD, which is 1 (since we just closed it).
4. **exec("ls", ...)**: Run ls. All output to stdout (FD 1) now goes to out.txt.
5. **parent calls wait()**: Parent waits for child to finish.

**Example from Week2_1 (p4.c)**:

```c
int rc = fork();
if (rc == 0) {
    // child
    close(STDOUT_FILENO);  // close FD 1
    open("./p4.output", O_CREAT|O_WRONLY|O_TRUNC, S_IRWXU);
    // open() returns 1 (lowest free slot)
    
    char *myargs[3];
    myargs[0] = strdup("wc");
    myargs[1] = strdup("p4.c");
    myargs[2] = NULL;
    execvp(myargs[0], myargs);
} else {
    // parent
    wait(NULL);
}
```

Output (from p4.c execution):
```
prompt> ./p4
prompt> cat p4.output
32 109 846 p4.c
```

The `wc` command's output (normally printed to terminal) is redirected to p4.output.

### Redirecting input: `command < file`

To implement `cat < in.txt`:

1. **fork()**: Create child.
2. **close(STDIN_FILENO)**: Close FD 0 (stdin).
3. **open("in.txt", O_RDONLY)**: Open for reading. FD 0 is reused.
4. **exec("cat", ...)**: cat reads from FD 0, which now points to in.txt.

### Piping: `prog1 | prog2`

Piping is more complex. It requires a pipe (created with pipe()), which is a unidirectional communication channel with a read end and a write end.

To implement `ls | wc`:

1. **pipe(fds)**: Create a pipe. fds[0] is the read end, fds[1] is the write end.
2. **fork()**: Create first child (ls).
   - In first child: close(STDOUT_FILENO), then dup2(fds[1], STDOUT_FILENO) to redirect stdout to pipe write end.
   - Close both pipe FDs in child (fds[0] and fds[1]—they're now duped).
   - exec("ls", ...).
3. **fork()**: Create second child (wc).
   - In second child: close(STDIN_FILENO), then dup2(fds[0], STDIN_FILENO) to redirect stdin to pipe read end.
   - Close both pipe FDs in child.
   - exec("wc", ...).
4. **Parent**: Close both pipe FDs (parent doesn't need them; only the children do).
5. **wait()**: Wait for both children.

The pipe buffer connects ls's output to wc's input.

### Key syscalls for redirection

- **close(fd)**: Close file descriptor fd, freeing its slot.
- **open(path, flags, ...)**: Open a file and return the lowest available FD. Used to reuse the closed FD.
- **pipe(fds)**: Create a pipe, storing read FD in fds[0] and write FD in fds[1].
- **dup2(old_fd, new_fd)**: Duplicate old_fd to new_fd, closing new_fd if necessary. Used to redirect FDs without closing and reopening.

dup2() is often easier than close-then-open because it's atomic.

### Why close/open or dup2 works

The file descriptor table maps small integers (0, 1, 2, ...) to open file objects. When an FD is closed, its entry is marked free. When open() or dup2() allocates an FD, it takes the first free slot. This is why closing FD 1 and then opening a file results in FD 1 pointing to the new file.

### Inheritance and independence

When a process forks, the child inherits the parent's file descriptor table. Both parent and child have FD 1 pointing to the terminal initially. When the child closes FD 1 and opens a file, the child's FD 1 points to the file, but the parent's FD 1 still points to the terminal. After exec(), the process's FDs are unchanged (unless marked close-on-exec).

## Common exam questions

- **MCQ:** To implement `ls > out.txt`, after fork() what sequence does the child run before launching ls?
  - [x] close(STDOUT_FILENO), then open("out.txt", ...), then the execvp call
  - [ ] open("out.txt", ...), then execvp, then close(STDOUT_FILENO)
  - [ ] pipe(fds), then execvp, then wait()
  - [ ] execvp first, then close/open to swap the FD afterward
  - why: Closing FD 1 frees its slot; open() then returns the lowest free FD (1), so stdout points to the file before the program is loaded with the execvp call.

- **MCQ:** Why does calling close(1) followed by open("out.txt", ...) reliably make FD 1 refer to out.txt?
  - [x] POSIX guarantees open() returns the lowest unused file descriptor, which is 1 after the close.
  - [ ] open() is hard-coded to return 1 whenever stdout has been redirected.
  - [ ] The kernel assigns FD numbers in round-robin order starting at 1.
  - [ ] The C library rewrites the FD number to match stdout.
  - why: The lowest-free-FD rule is what makes close/open redirection work; after closing 1, slot 1 is the lowest free, so open() takes it.

- **MCQ:** What are the three standard file descriptors present when a process starts?
  - [x] 0 = stdin, 1 = stdout, 2 = stderr
  - [ ] 0 = stderr, 1 = stdin, 2 = stdout
  - [ ] 1 = stdin, 2 = stdout, 3 = stderr
  - [ ] 0 = stdout, 1 = stderr, 2 = stdin
  - why: POSIX reserves FD 0 for standard input, FD 1 for standard output, and FD 2 for standard error.

- **MCQ:** For `ls | wc`, what must happen in the ls child before its execvp call?
  - [x] dup2 the pipe's write end onto FD 1, then close both original pipe FDs
  - [ ] dup2 the pipe's read end onto FD 0, then close both original pipe FDs
  - [ ] close FD 1 and FD 2, leaving the pipe untouched
  - [ ] open a new pipe file in /tmp and redirect stdout to it
  - why: ls writes to stdout, so its FD 1 must point at the pipe's write end; dup2 does this atomically, and closing the originals avoids keeping stray pipe FDs open.

- **MCQ:** After a parent creates a pipe and forks two children, why should the parent close both pipe FDs?
  - [x] If the parent keeps the write end open, the reader never sees EOF and can block forever.
  - [ ] Closing them speeds up the children's exec calls.
  - [ ] The kernel deletes the pipe when all FDs are closed in one process.
  - [ ] It prevents the parent from being reparented to init.
  - why: A pipe's read end returns EOF only when all write-end FDs (across all processes) are closed. A parent holding the write end stalls the reader.

- **MCQ:** A process forks; the child closes FD 1 and opens a file so its FD 1 points to that file. What about the parent's FD 1?
  - [x] Unchanged; the parent's FD 1 still points to whatever it pointed to before the fork (e.g., the terminal).
  - [ ] Also redirected, because FD tables are shared after fork.
  - [ ] Closed, because closing in one process closes in both.
  - [ ] Duplicated to the file, but read-only for the parent.
  - why: fork() gives the child its own copy of the file descriptor table. Changes in the child do not affect the parent's table.

- **MCQ:** Which single syscall atomically redirects new_fd to refer to the same file as old_fd, closing new_fd if necessary?
  - [x] dup2(old_fd, new_fd)
  - [ ] close(new_fd) followed by open(old_fd)
  - [ ] pipe(new_fd)
  - [ ] fork() followed by close()
  - why: dup2 is the canonical atomic-redirection primitive; close-then-open works for files but is not atomic and cannot target an arbitrary existing descriptor.

## Gotchas

- **FD 0, 1, 2 are special**: They're the standard streams. Redirecting them changes where the process's I/O goes. Don't accidentally overwrite them unless you intend to.
- **open() reuses the lowest free FD**: This is a POSIX guarantee. Don't rely on open() returning a specific FD unless you've carefully managed the FD table.
- **Pipe FDs must be closed in parent**: If a parent creates a pipe and both children finish but the parent still holds the write end, the read end will block forever waiting for EOF. Always close pipe FDs in the parent.
- **Order of dup2() matters**: If you dup2(fds[1], STDOUT_FILENO) while FD 1 is already the terminal, it closes the terminal and replaces it with the pipe. Do this after forking, not before.
- **Pipes are small buffers**: A pipe typically buffers 64 KB (varies by OS). If a writer fills the pipe faster than the reader empties it, the writer blocks. This is the "backpressure" that ensures pipes work correctly.

## Hand-trace example

Tracing `ls > out.txt`:

```
Parent (shell):
  1. fork() → child_pid = 1234
  2. if (child_pid > 0) wait(1234)
  → Parent blocks until child exits

Child (PID 1234):
  1. close(STDOUT_FILENO)
     FD table: [stdin, (free), stderr, ...]
  2. open("out.txt", O_CREAT|O_WRONLY|O_TRUNC)
     Returns 1 (lowest free)
     FD table: [stdin, out.txt, stderr, ...]
  3. exec("ls", ["ls", NULL])
     ls's printf("file.txt\n") writes to FD 1 → out.txt

Output on terminal: nothing (child's stdout redirected)
File created: out.txt with contents "file.txt\n" and other file listings
```

## Pseudocode

Simple output redirection:

```c
int main() {
    pid_t pid = fork();
    
    if (pid < 0) {
        perror("fork");
        exit(1);
    } else if (pid == 0) {
        // Child
        close(STDOUT_FILENO);
        int fd = open("output.txt", O_CREAT | O_WRONLY | O_TRUNC, 0666);
        if (fd < 0) {
            perror("open");
            exit(1);
        }
        // fd is now 1 (lowest free FD)
        
        char *args[] = {"/bin/ls", "-l", NULL};
        execvp(args[0], args);
        perror("exec");
        exit(1);
    } else {
        // Parent
        int status;
        waitpid(pid, &status, 0);
        printf("Child exited with status %d\n", status);
    }
    return 0;
}
```

Piping (simplified):

```c
int main() {
    int fds[2];
    pipe(fds);  // fds[0] = read, fds[1] = write
    
    pid_t pid1 = fork();
    if (pid1 == 0) {
        // Child 1: ls
        close(fds[0]);  // close read end
        dup2(fds[1], STDOUT_FILENO);  // stdout → pipe write
        close(fds[1]);
        execvp("ls", (char *[]){"ls", NULL});
    }
    
    pid_t pid2 = fork();
    if (pid2 == 0) {
        // Child 2: wc
        close(fds[1]);  // close write end
        dup2(fds[0], STDIN_FILENO);  // stdin ← pipe read
        close(fds[0]);
        execvp("wc", (char *[]){"wc", "-l", NULL});
    }
    
    // Parent: close both ends and wait
    close(fds[0]);
    close(fds[1]);
    waitpid(pid1, NULL, 0);
    waitpid(pid2, NULL, 0);
    return 0;
}
```

## Sources

- Week2_1.pdf: p4.c (fork-exec-wait with output redirection via close/open), example output showing redirection working, explanation of close(STDOUT_FILENO) and open() reusing the FD.
- Shell redirection and piping are covered in operating systems courses; also see man pages for open(), close(), pipe(), dup2().
