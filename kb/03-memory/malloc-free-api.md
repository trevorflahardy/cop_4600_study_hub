# malloc, calloc, realloc, free

## Definition

C's dynamic memory allocation functions allow heap memory to be requested and released at runtime. `malloc()` allocates uninitialized bytes; `calloc()` allocates and zeros memory; `realloc()` resizes a prior allocation; `free()` releases memory back to the allocator. Proper use requires balancing allocations with deallocations to prevent leaks and dangling pointers.

## When to use

- Use `malloc()` when you need raw, uninitialized memory (e.g., a buffer or array of unknown size).
- Use `calloc()` when you need memory pre-zeroed (e.g., initializing counts or flags to zero).
- Use `realloc()` when a previously allocated block needs to grow or shrink without manual copy-and-free.
- Use `free()` to return heap memory to the OS so other allocations can reuse it.

## Key ideas

### The sizeof() convention

Always use `sizeof()` in malloc calls to ensure portability and avoid hard-coding type sizes. Two key patterns:

- **Pointer allocation**: `int *pi = malloc(10 * sizeof(int));` allocates 40 bytes (on a 32-bit system where `sizeof(int) = 4`), but `sizeof(pi)` is only 4 (the pointer itself, not the data it points to).
- **Array allocation**: `int x[10];` allocates 40 bytes at compile time; `sizeof(x)` correctly returns 40. But once passed to a function, the array decays to a pointer, so `sizeof(x)` in the function gives only the pointer size.

From the lecture (Week 4_1.pdf):
- `sizeof(int*)` = 4 bytes on 32-bit systems
- `sizeof(int[10])` = 40 bytes

### The malloc family

**malloc(size_t size)**  
Allocates `size` bytes on the heap. Returns a void pointer to the block, or NULL on failure. Memory is uninitialized and may contain garbage values.

**calloc(size_t num, size_t size)**  
Allocates `num * size` bytes and initializes all bytes to zero. Useful for flags, counters, or data structures that should start clean.

**realloc(void *ptr, size_t size)**  
Changes the size of a block previously allocated with malloc/calloc/realloc. If the block can grow in-place, the same pointer is returned; otherwise, a new block is allocated, the old data is copied, and the old block is freed. Always assign the return value, as it may differ from the input pointer: `ptr = realloc(ptr, new_size);`

**free(void *ptr)**  
Deallocates the block at `ptr`. The allocator marks that memory as free and may reuse it for future allocations. After free, the pointer becomes invalid (dangling).

### Allocation example (from Week 4_1.pdf)

```c
int *pi = malloc(sizeof(int) * 4);  // Allocate 16 bytes on heap
pi[0] = 10;
pi[1] = 20;
pi[2] = 30;
pi[3] = 40;
free(pi);  // Return memory to allocator
```

After `free(pi)`, the heap memory is returned but `pi` still holds the old address—accessing `pi[0]` is a dangling-pointer access.

### Deallocation and state

When `free()` is called:
1. The allocator marks the block as free in its internal bookkeeping.
2. The block may be merged with adjacent free blocks (coalescing).
3. Future allocations can reuse the freed space.
4. The pointer variable itself is not changed; it still holds the old address (now invalid).

## Pseudocode

```
malloc(size):
  - Search free list for a block >= size
  - If found, mark as allocated, return address
  - If not found, request more memory from OS, return address
  - If OS denies, return NULL

calloc(num, size):
  - Allocate num * size bytes via malloc
  - Zero all bytes
  - Return address

free(ptr):
  - Mark block at ptr as free
  - Coalesce with adjacent free blocks if possible
  - Return (no value)

realloc(ptr, size):
  - If size == 0, free ptr and return NULL
  - If ptr == NULL, act like malloc(size)
  - If current block size >= size, return ptr (may shrink in-place)
  - Otherwise, malloc a new block, memcpy old data, free old block, return new address
```

## Hand-trace example

**Scenario**: Allocate two integers, modify them, free one, then free the other.

| Step | Code | Heap State | pi | pj | Notes |
|------|------|-----------|----|----|-------|
| 1 | `int *pi = malloc(4);` | `[allocated: 0x1000-0x1003]` | 0x1000 | — | 4 bytes allocated at 0x1000 |
| 2 | `int *pj = malloc(4);` | `[allocated: 0x1000-0x1003], [allocated: 0x1004-0x1007]` | 0x1000 | 0x1004 | Another 4 bytes allocated at 0x1004 |
| 3 | `*pi = 42; *pj = 99;` | `[42, garbage, garbage, garbage] [99, garbage, garbage, garbage]` | 0x1000 | 0x1004 | Values stored; heap unchanged in structure |
| 4 | `free(pi);` | `[FREE: 0x1000-0x1003], [allocated: 0x1004-0x1007]` | 0x1000 (dangling) | 0x1004 | Block at 0x1000 marked free; pi still holds address |
| 5 | `free(pj);` | `[FREE: 0x1000-0x1003], [FREE: 0x1004-0x1007]` | 0x1000 (dangling) | 0x1004 (dangling) | Block at 0x1004 marked free; both pointers now dangling |

If step 4 were followed by `int *pk = malloc(4);`, the allocator might return 0x1000 again, reusing the freed block.

## Common exam questions

- **MCQ:** On a 32-bit system with `int *pi`, what are `sizeof(int *)` and `sizeof(int[10])`?
  - [x] 4 and 40
  - [ ] 40 and 40
  - [ ] 4 and 4
  - [ ] 10 and 40
  - why: `sizeof` on a pointer gives pointer size (4 bytes). `sizeof` on a declared array gives total byte size: 10 * 4 = 40.
- **MCQ:** What does `malloc(size)` return on failure?
  - [x] NULL
  - [ ] 0xFFFFFFFF
  - [ ] -1
  - [ ] The address of a zero-filled block
  - why: On failure (e.g., out of memory) malloc returns NULL. Callers must check this before dereferencing.
- **MCQ:** What is the behavior of `int *x = malloc(sizeof(int)); free(x); printf("%d\n", *x);`?
  - [x] Undefined behavior: `x` is a dangling pointer after free.
  - [ ] Always prints 0 because free zeros the block.
  - [ ] Always crashes immediately with a segfault.
  - [ ] Reallocates the same block automatically.
  - why: After free, the allocator may reuse or unmap that memory. The pointer still holds the old address but dereferencing is undefined.
- **MCQ:** Which statement best describes the difference between `malloc` and `calloc`?
  - [x] `calloc` zero-initializes the allocated bytes; `malloc` leaves contents uninitialized.
  - [ ] `calloc` allocates on the stack; `malloc` allocates on the heap.
  - [ ] `malloc` succeeds more reliably than `calloc`.
  - [ ] `calloc` cannot be paired with `free`.
  - why: Both allocate heap memory, but calloc also writes zeros across all num*size bytes.
- **MCQ:** Why must the return value of `realloc(ptr, new_size)` always be assigned back to `ptr`?
  - [x] realloc may move the block to a new address if it cannot grow in place.
  - [ ] realloc always invalidates ptr, so reassignment prevents a compile error.
  - [ ] The C standard forbids calling realloc without an assignment.
  - [ ] It marks the old pointer as dirty for garbage collection.
  - why: If the current block cannot be extended, realloc allocates a new block, copies the data, frees the old, and returns the new address. Ignoring the return value leaks or uses a stale pointer.
- **MCQ:** After `int *pi = malloc(sizeof(int) * 4)` how many bytes are allocated?
  - [x] 16
  - [ ] 4
  - [ ] 8
  - [ ] 40
  - why: sizeof(int) is 4 bytes on the lecture's 32-bit system, so 4 * 4 = 16 bytes.
- **MCQ:** After `free(p)` completes, which statement is true about the pointer variable `p`?
  - [x] `p` still holds its old address but dereferencing it is undefined behavior.
  - [ ] `p` is automatically set to NULL by free.
  - [ ] `p` cannot be reassigned until the block is malloc'd again.
  - [ ] `p` points to a zero-filled region for safety.
  - why: free only updates allocator bookkeeping; the pointer variable is unchanged. Programmers often set `p = NULL` themselves to avoid misuse.

## Gotchas

- **Forgetting to check NULL**: `malloc()` can fail (e.g., out of memory). Always check: `if (ptr == NULL) { /* handle error */ }`.
- **sizeof() on pointers**: `sizeof(ptr)` is the size of the pointer, not the allocated block. Use `sizeof(type) * count` to calculate allocation size.
- **Dangling pointers**: After `free(p)`, `p` still holds the old address. Accessing it is undefined behavior.
- **Double-free**: Calling `free(p)` twice causes undefined behavior. Set `p = NULL` after freeing if you may free again.
- **Mismatched allocation/deallocation**: malloc'd blocks must be freed with `free()`, not `delete` (C++ operator). Similarly, never `free()` a stack variable or static allocation.
- **Off-by-one in allocation**: Forgetting to allocate space for the null terminator in strings (e.g., `malloc(strlen(s))` instead of `malloc(strlen(s) + 1)`).

## Sources

- lectures/Week4_1.pdf: Address space layout, malloc/calloc/realloc/free API, sizeof() behavior, memory freeing state
