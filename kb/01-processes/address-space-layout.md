# Process Address Space Layout

## Definition

A process's address space is a logical view of memory organized into regions: text (code), data (static data), heap (dynamic allocations), and stack (function frames). The OS provides each process with the illusion of a large, contiguous address space; the actual physical memory layout is managed by the virtual memory system.

## When to use

- Explaining how a program's compiled code and data are organized in memory.
- Understanding where global variables, local variables, and dynamically allocated data reside.
- Discussing memory allocation and deallocation (malloc/free, new/delete).
- Reasoning about stack vs. heap and when to use each.
- Debugging memory issues (buffer overflows, stack corruption, heap fragmentation).

## Key ideas

The process address space is divided into four main regions, typically ordered from lowest address to highest (though stack grows downward):

1. **Text (Code) segment**: Contains the executable instructions of the program (read-only). This includes the compiled machine code for all functions.

2. **Data (Static Data) segment**: Contains initialized global and static variables. These values are read from the executable file at load time.

3. **Heap**: Used for dynamic memory allocation (malloc, new). Grows upward (toward higher addresses). The programmer is responsible for managing this memory—allocating with malloc and freeing with free.

4. **Stack**: Used for local variables, function parameters, return addresses, and function call frames. Grows downward (toward lower addresses). Automatically managed—memory is freed when functions return. The stack is Last-In-First-Out (LIFO).

**Example from Week 2_1**: An xv6 process with address space 0-16 KB:
- Text: 0 KB to ~4 KB (code segment).
- Data: ~4 KB to ~6 KB (initialized globals).
- Heap: ~6 KB upward (dynamically allocated, grows up).
- Stack: Top of 16 KB downward (grows down, toward the heap).

The gap between heap and stack allows both to grow without immediate collision; the OS detects a collision (stack overflow) when they meet.

**Key point on virtual memory**: The logical address space shown in Week 2_1 is what the process sees. The actual physical memory layout is managed by the OS's virtual memory system. Each process's address space is isolated; one process cannot see or corrupt another's memory.

## Common exam questions

- **MCQ:** Which region of a process's address space holds the executable machine instructions and is typically marked read-only?
  - [x] Text (code) segment
  - [ ] Data segment
  - [ ] Heap
  - [ ] Stack
  - why: The text segment stores the compiled instructions; it is read-only so a buggy or malicious write cannot modify running code.

- **MCQ:** In the standard xv6-style layout, which two regions grow toward each other across the gap in the middle of the address space?
  - [x] Heap grows upward and stack grows downward
  - [ ] Text grows upward and data grows downward
  - [ ] Stack grows upward and heap grows downward
  - [ ] Data grows upward and heap grows downward
  - why: The heap expands toward higher addresses as malloc is called; the stack expands toward lower addresses as frames are pushed. The gap between them allows each to grow until they collide.

- **MCQ:** Where is a local variable declared inside a C function allocated?
  - [x] On the stack, in the function's call frame
  - [ ] On the heap, via an implicit malloc
  - [ ] In the data segment alongside globals
  - [ ] In the text segment next to the function's code
  - why: Local variables live in the function's stack frame and are reclaimed automatically when the function returns (LIFO).

- **MCQ:** A program calls malloc to allocate a buffer at runtime. Where does that buffer live?
  - [x] Heap
  - [ ] Stack
  - [ ] Text segment
  - [ ] Data segment
  - why: Dynamic allocations from malloc/new come from the heap; the programmer must free them, unlike stack frames which are freed on return.

- **MCQ:** Two processes each see address 0x1000 in their address space. Which statement is true?
  - [x] Each process's 0x1000 maps to different physical memory because address spaces are isolated via virtual memory.
  - [ ] Both processes read and write the same physical byte at 0x1000.
  - [ ] Only one process at a time may use address 0x1000.
  - [ ] The OS rejects the second process's access to 0x1000.
  - why: Virtual memory gives each process its own logical address space; identical virtual addresses are translated to different physical pages, providing isolation.

- **MCQ:** Why is the text segment typically marked read-only?
  - [x] To prevent stray writes or attacks from modifying the running program's instructions.
  - [ ] Because the CPU cannot fetch instructions from writable pages.
  - [ ] To save physical memory by sharing the pages.
  - [ ] Because compilers are unable to emit writable code.
  - why: Making code read-only defends against accidental corruption and many code-injection attacks; the hardware can fetch from read-only pages just fine.

- **MCQ:** A process's stack grows down and collides with the heap. What has happened and how does the OS respond?
  - [x] A stack overflow has occurred; the OS detects the invalid access and typically terminates the process (e.g., segmentation fault).
  - [ ] The heap is automatically relocated to a higher address to make room.
  - [ ] The OS silently merges the two regions and the program continues.
  - [ ] The program is paused and the user is prompted to allocate more memory.
  - why: When the stack grows into the heap (or past its guard page), the OS detects the fault and usually kills the process; before detection, it may silently corrupt heap data.

## Gotchas

- **Stack grows downward**: On most systems, the stack pointer decreases as the stack grows (new frames are at lower addresses). Don't assume stack always grows "up" in address space.
- **No physical contiguity**: Although the address space appears contiguous, virtual memory may scatter it across non-contiguous physical pages. This is transparent to the process.
- **Heap fragmentation**: Unlike the stack, heap allocations are not automatically freed. Poor malloc/free patterns can fragment the heap, wasting space.
- **Stack overflow is silent initially**: A stack overflow may not immediately cause a crash—it corrupts heap data first if the heap has grown high enough. The error manifests later as corruption of heap data structures.
- **64-bit addresses are sparse**: On 64-bit systems, the address space is enormous (2^64 bytes), so the layout is more spread out. Week 4_1 covers 64-bit Linux address space; the 16 KB example is for pedagogical simplicity.

## Sources

- Week2_1.pdf: Address space layout diagram (0-16 KB example), text/data/heap/stack regions.
