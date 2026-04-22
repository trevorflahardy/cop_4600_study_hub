# Memory API Errors

## Definition

Memory API errors occur when programs misuse malloc/free, leading to corruption, crashes, or silent data loss. The four core error types are memory leaks (allocated but never freed), dangling pointers (use-after-free), double-free (freeing the same block twice), and uninitialized reads (accessing allocated but unset memory).

## When to use

- Recognize memory leaks during code review to identify resource cleanup issues.
- Identify dangling pointers when debugging crashes or unpredictable behavior.
- Catch double-free bugs that corrupt the allocator's internal state.
- Spot uninitialized reads that depend on garbage heap values.

## Key ideas

### Memory Leak

A memory leak occurs when allocated heap memory is never freed, and the program loses all pointers to that block. Over time, leaks exhaust available memory, causing the program to crash.

**Example** (from Week 4_1.pdf):
```c
int *a = malloc(sizeof(int) * 10);
int *b = malloc(sizeof(int) * 10);
a = b;  // BUG: overwrote a without freeing the first block
free(b);
// The first 10-int block is lost forever
```

The first allocated block at address, say, 0x1000 is overwritten in pointer `a` when `a` is reassigned to `b`'s value. That block is never freed, leaking 40 bytes.

### Dangling Pointer

A dangling pointer is a reference to heap memory that has been freed. Accessing a dangling pointer causes undefined behavior: the block may have been reallocated to another variable, or the OS may have reclaimed the physical memory entirely.

**Example** (from Week 4_1.pdf):
```c
int *x = malloc(sizeof(int));
*x = 42;
free(x);
printf("%d\n", *x);  // BUG: x is now a dangling pointer
```

After `free(x)`, the block is returned to the allocator. Dereferencing `x` may read garbage, crash, or if the block was reallocated, read another process's data.

### Double-Free

Freeing the same pointer twice corrupts the allocator's free-list bookkeeping, potentially causing crashes or heap corruption on subsequent allocations.

**Example** (from Week 4_1.pdf):
```c
int *x = malloc(sizeof(int));
free(x);
free(x);  // BUG: undefined behavior
```

The first `free(x)` marks the block as free. The second `free(x)` attempts to free already-free memory, corrupting internal allocator structures.

### Uninitialized Read

Accessing heap memory before writing to it reads whatever garbage value was left there. This is unpredictable and leads to bugs that are hard to reproduce.

**Example** (from Week 4_1.pdf):
```c
int *x = malloc(sizeof(int));
printf("%d\n", *x);  // BUG: uninitialized read
```

The allocated block contains whatever bits were in that memory location before the allocation. The printed value is garbage and varies between runs.

## Pseudocode

```
detect_leak():
  - Allocate block
  - Lose all pointers to block
  - Block remains on heap until program ends
  - OS reclaims memory on process termination

detect_dangling_pointer():
  - Free a block
  - Keep a pointer to the now-freed block
  - Access via pointer
  - Behavior: undefined (may read stale data, crash, etc.)

detect_double_free():
  - Free a block
  - Free the same block again
  - Allocator state corrupted

detect_uninitialized_read():
  - Allocate a block
  - Read from block without writing first
  - Value is whatever garbage was in that memory
```

## Hand-trace example

**Scenario**: Demonstrate all four errors in a single trace.

| Step | Code | Heap State | x | Notes |
|------|------|-----------|---|-------|
| 1 | `int *x = malloc(4);` | `[allocated: 0x1000-0x1003]` | 0x1000 | Allocated 4 bytes |
| 2 | `printf("%d\n", *x);` | `[allocated: 0x1000-0x1003, garbage]` | 0x1000 | **UNINITIALIZED READ**: prints garbage value |
| 3 | `int *y = malloc(4);` | `[allocated: 0x1000-0x1003], [allocated: 0x1004-0x1007]` | 0x1000 | y allocated at 0x1004 |
| 4 | `x = y;` | `[allocated: 0x1000-0x1003], [allocated: 0x1004-0x1007]` | 0x1004 | Pointer x overwritten; 0x1000 lost—**MEMORY LEAK** |
| 5 | `free(x);` | `[allocated: 0x1000-0x1003], [FREE: 0x1004-0x1007]` | 0x1004 (dangling) | Freed block at 0x1004 |
| 6 | `*x = 99;` | `[allocated: 0x1000-0x1003], [FREE: 0x1004-0x1007, 99...]` | 0x1004 (dangling) | **DANGLING POINTER WRITE**: corrupts freed block |
| 7 | `free(y);` | — | — | y == 0x1004; frees the same block |
| 8 | `free(x);` | — | — | x == 0x1004; **DOUBLE-FREE**: undefined behavior |

- Leak: Block at 0x1000 allocated in step 1, pointer overwritten in step 4, never freed.
- Dangling: x points to 0x1004 after step 5, access in step 6 is undefined.
- Double-free: Both step 7 (`free(y)`) and step 8 (`free(x)`) free the same address.
- Uninitialized: Step 2 reads garbage before any write.

## Common exam questions

- What is a memory leak, and how does it manifest in long-running programs?
- Explain the difference between a memory leak and a dangling pointer.
- Why is a double-free error dangerous to the allocator?
- What happens when you dereference a dangling pointer?
- How can you avoid dangling pointers after calling free()?
- What is an uninitialized read, and why is it a security concern?
- Identify the errors in: `int *p = malloc(100); int *q = p; free(p); *q = 5;`

## Gotchas

- **Invisible leaks**: A program may leak memory silently for years until it runs out of heap space. Use memory profilers (valgrind, AddressSanitizer) to detect leaks in testing.
- **Dangling pointers are hard to spot**: The code may compile and run for a while before the freed block is reallocated, masking the error.
- **Allocator-specific double-free behavior**: Some allocators crash immediately on double-free (good for testing), while others may silently corrupt state (bad for production).
- **Uninitialized reads are non-deterministic**: The garbage value depends on what was in memory before, making bugs hard to reproduce.
- **Scope doesn't prevent leaks**: A local pointer that leaks is still a leak; the block persists on the heap even after the function returns.
- **C doesn't have destructors**: Unlike C++, C has no automatic cleanup mechanism; every malloc must be paired with an explicit free.

## Sources

- lectures/Week4_1.pdf: Memory leak, dangling pointer, double-free, uninitialized read examples and definitions
