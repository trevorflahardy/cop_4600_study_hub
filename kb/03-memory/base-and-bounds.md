# Base-and-Bounds

## Definition

Base-and-bounds is a hardware relocation mechanism that transforms virtual addresses to physical addresses using two registers. The base register holds the starting physical address of a process's memory region; the bounds register limits the size. Physical address = virtual address + base, checked against bounds for validity.

## When to use

- Understand the simplest form of virtual memory with minimal hardware support.
- Learn why bounds checking is essential for protection.
- See how OS context-switches must save and restore base/bounds pairs.
- Recognize why fragmentation limits this approach in multi-process systems.

## Key ideas

### Address Translation

Every virtual address in a process's address space is translated to a physical address by the hardware during execution.

**Formula**:
```
physical_address = virtual_address + base
```

The bounds register ensures the virtual address does not exceed the process's allocated memory:
```
0 <= virtual_address < bounds
```

### Example from Week 4_1.pdf

Base = 32 KB, Bounds = 48 KB. Process occupies physical memory 32 KB to 80 KB (48 KB total).

| Virtual Address | Bounds Check | Physical Address | Valid? |
|-----------------|--------------|------------------|--------|
| 0x0000 (0 KB) | 0 < 48 KB | 0x8000 (32 KB) | Yes |
| 0x2000 (8 KB) | 8 < 48 KB | 0xA000 (40 KB) | Yes |
| 0xC000 (48 KB) | 48 < 48 KB | — | No (protection fault) |
| 0x1000 (4 KB) | 4 < 48 KB | 0x9000 (36 KB) | Yes |

If a program tries to access virtual address 48 KB (or higher), the bounds check fails and the hardware raises a protection fault, allowing the OS to kill the process.

### Protection and Isolation

Each process has its own base and bounds pair stored in the process control block (PCB). When the OS switches to a new process, it loads the new base and bounds values into the hardware registers. This ensures:

1. **Isolation**: Process A cannot access Process B's memory because their base/bounds define non-overlapping regions.
2. **Protection**: Accessing an address beyond the bounds triggers a fault (page fault/segmentation fault).

### Dynamic Relocation

The OS decides where to load each process in physical memory at startup. By setting the base register, the same virtual address space can be placed anywhere in physical memory without recompiling the program. This is called dynamic relocation.

### Fragmentation Problem

When multiple processes coexist, free gaps between allocated regions fragment physical memory. If a large process arrives but no contiguous free block is large enough, the OS cannot load it, even if total free space is sufficient. This external fragmentation is a key weakness of base-and-bounds.

## Pseudocode

```
on_memory_reference(virtual_address):
  - If virtual_address >= bounds_register:
      raise protection_fault  // Hardware exception
  - Else:
      physical_address = virtual_address + base_register
      access_memory(physical_address)

on_context_switch(old_process, new_process):
  - Save old_process.base = base_register
  - Save old_process.bounds = bounds_register
  - Load base_register = new_process.base
  - Load bounds_register = new_process.bounds
  - Resume new_process
```

## Hand-trace example

**Scenario**: Two processes, A and B, with base-and-bounds relocation.

| Time | Event | Process A Base | Process A Bounds | Process B Base | Process B Bounds | Running | Notes |
|------|-------|----------------|------------------|----------------|------------------|---------|-------|
| T0 | OS loads A | 32 KB | 48 KB | — | — | A | A occupies 32 KB–80 KB |
| T1 | A refs VA 0x5000 (20 KB) | 32 KB | 48 KB | — | — | A | PA = 20 KB + 32 KB = 52 KB (valid) |
| T2 | A refs VA 0x1000 (4 KB) | 32 KB | 48 KB | — | — | A | PA = 4 KB + 32 KB = 36 KB (valid) |
| T3 | OS context-switches to B | 32 KB | 48 KB | 80 KB | 32 KB | B | Save A's regs; load B's regs |
| T4 | B refs VA 0x0000 (0 KB) | 32 KB | 48 KB | 80 KB | 32 KB | B | PA = 0 KB + 80 KB = 80 KB (valid); B occupies 80 KB–112 KB |
| T5 | B refs VA 0x7FFF (32 KB) | 32 KB | 48 KB | 80 KB | 32 KB | B | 32 KB >= 32 KB bounds → **protection fault** |
| T6 | OS kills B | 32 KB | 48 KB | — | — | A | Context-switch back to A |

- In step 1, A's VA 0x5000 = 20 KB is within bounds (20 < 48), so it translates to PA 32 KB + 20 KB = 52 KB.
- In step 5, B's VA 0x7FFF = 32 KB exactly equals the bounds, so the check 32 KB < 32 KB fails.

## Common exam questions

- Given base = 32 KB, bounds = 48 KB, and VA = 0x3000 (12 KB), compute the physical address.
- Why does the bounds register contain size (48 KB) rather than the end address (80 KB)?
- How does base-and-bounds ensure memory protection between processes?
- What is external fragmentation, and why is it a problem for base-and-bounds?
- During a context switch, what two values must the OS save and restore?
- If a process references VA 0xFFFF and bounds = 48 KB, what happens?

## Gotchas

- **Bounds is size, not address**: The bounds register holds the maximum valid offset (e.g., 48 KB), not the physical end address (80 KB). Virtual addresses must be strictly less than bounds.
- **Every memory reference requires two register reads**: The hardware must check bounds on every load/store, so base-and-bounds is fast in hardware but adds a subtle serialization cost.
- **Relocation is transparent to the program**: The program always uses VA starting from 0, unaware of its physical location.
- **External fragmentation unsolvable without compaction**: If memory is fragmented, moving processes (compaction) is expensive and stops the system temporarily.
- **Stack grows toward heap**: In real systems, heap grows up and stack grows down within the address space; base-and-bounds does not distinguish direction, making it inefficient for programs with both.

## Sources

- lectures/Week4_1.pdf: Base and bounds register definition, dynamic relocation, physical address formula, protection faults, OS context-switch requirements
