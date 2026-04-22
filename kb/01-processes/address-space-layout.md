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

- Describe the four regions of a process's address space and what they contain.
- Why is the stack separate from the heap? What are the advantages and disadvantages of each for memory allocation?
- Draw a diagram of address space layout with text, data, heap, and stack regions. Indicate which direction each grows.
- What happens if the heap grows into the stack (or vice versa)? How does the OS detect and handle this?
- Given a C program with global variables, local variables, and malloc calls, identify where each would be stored in the address space.
- Why is the text segment read-only? What would happen if it were writable?

## Gotchas

- **Stack grows downward**: On most systems, the stack pointer decreases as the stack grows (new frames are at lower addresses). Don't assume stack always grows "up" in address space.
- **No physical contiguity**: Although the address space appears contiguous, virtual memory may scatter it across non-contiguous physical pages. This is transparent to the process.
- **Heap fragmentation**: Unlike the stack, heap allocations are not automatically freed. Poor malloc/free patterns can fragment the heap, wasting space.
- **Stack overflow is silent initially**: A stack overflow may not immediately cause a crash—it corrupts heap data first if the heap has grown high enough. The error manifests later as corruption of heap data structures.
- **64-bit addresses are sparse**: On 64-bit systems, the address space is enormous (2^64 bytes), so the layout is more spread out. Week 4_1 covers 64-bit Linux address space; the 16 KB example is for pedagogical simplicity.

## Sources

- Week2_1.pdf: Address space layout diagram (0-16 KB example), text/data/heap/stack regions.
