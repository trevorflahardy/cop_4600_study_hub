# Segmentation

## Definition

Segmentation divides a process's address space into logically distinct regions (code, heap, stack), each with its own base and bounds pair. This reduces external fragmentation compared to base-and-bounds, since each segment can be placed independently in physical memory. Segments can have different growth directions, permissions, and can be shared across processes.

## When to use

- Understand how logical program structure (code, data, stack) maps to memory.
- See why stack growth direction must be tracked in hardware.
- Learn how code segments can be shared between processes.
- Recognize the trade-off between flexibility and complexity.

## Key ideas

### Segment Structure

A process's address space is split into fixed regions. For a typical program:

- **Code segment** (immutable): Contains instructions; grows toward higher addresses during link-time.
- **Heap segment** (dynamic): Allocated memory via malloc; grows upward (toward higher addresses).
- **Stack segment** (dynamic): Local variables and return addresses; grows downward (toward lower addresses).

From Week 4_2.pdf:

| Segment | Base | Size | Grows Positive? | Example |
|---------|------|------|-----------------|---------|
| Code | 32 KB | 2 KB | Yes | Instructions at 32 KB–34 KB |
| Heap | 34 KB | 2 KB | Yes | Malloc'd blocks at 34 KB–36 KB |
| Stack | 28 KB | 2 KB | No | Locals/returns at 28 KB–30 KB, grows downward |

The "Grows Positive?" bit tells the hardware whether to check `offset < size` (positive growth) or `offset >= 0` (negative growth, i.e., stack).

### Address Translation

The hardware uses the top bits of the virtual address to determine which segment is being accessed, then translates using that segment's base.

**Example** (from Week 4_2.pdf):

Virtual address bits: `[Segment bits][Offset within segment]`

For a 14-bit VA split as `[2 bits segment][12 bits offset]`:
- VA `0x1234` → segment bits = 0x01, offset = 0x234
- If heap segment has base 34 KB, PA = 0x234 + 34 KB

If accessing VA `0x7FF` (offset = 0x7FF = 2047, within heap), the hardware computes the segment base from the top 2 bits and adds the offset.

### Stack Growth Direction

The hardware tracks a "grows positive" bit per segment. For the stack:

- **Grows positive = 0** (negative growth): The stack grows downward (toward lower addresses). The offset can be negative conceptually.
- **Grows positive = 1** (positive growth): The segment grows upward (toward higher addresses).

When the hardware detects a stack access with offset near the end of the segment, it must check the direction bit. For negative-growth (stack):
- VA is valid if `offset >= size`, effectively allowing `size - page_size, size - page_size + 1, ..., size - 1` but not `size`.

### Sharing

Multiple processes can share the same code segment (e.g., libc). The OS maps the same physical code pages to multiple processes' address spaces, saving memory. Since code is read-only, sharing is safe.

### Fragmentation

Segmentation reduces external fragmentation compared to base-and-bounds because:
- Each segment is independently placeable in memory.
- If heap and stack don't grow, that gap is not wasted.
- Only segments themselves are subject to external fragmentation.

However, **internal fragmentation** still occurs within each segment when allocated blocks are smaller than page size, or when the segment size doesn't align to allocation boundaries.

## Pseudocode

```
on_memory_reference(virtual_address):
  - Extract segment_bits from top of VA
  - Fetch segment_base, segment_bounds, grows_positive from segment table
  - Calculate offset = VA - (segment_bits << offset_bits)
  
  - If grows_positive == 1:  // Positive growth (heap, code)
      if offset >= segment_bounds:
          raise protection_fault
  - Else:  // Negative growth (stack)
      if offset < (max_offset - segment_bounds):  // Offset below stack start
          raise protection_fault
  
  - Physical address = segment_base + offset
  - Access memory at physical address
```

## Hand-trace example

**Scenario**: Two-segment system (code at 32 KB, heap at 34 KB, stack at 28 KB). Code grows positive, stack grows negative.

| VA | Segment | Offset | Segment Base | Bounds | Grows Pos? | Offset Valid? | PA | Notes |
|----|---------|--------|--------------|--------|-----------|---------------|----|----|
| 0x0000 (code) | Code | 0x0000 | 32 KB | 2 KB | Yes | 0 < 2 KB ✓ | 32 KB | Read instruction |
| 0x0800 (code) | Code | 0x0800 | 32 KB | 2 KB | Yes | 2048 < 2048 ✗ | — | **Protection fault** |
| 0x1000 (heap) | Heap | 0x1000 | 34 KB | 2 KB | Yes | 4096 < 2048 ✗ | — | **Protection fault** (beyond heap) |
| 0x1100 (heap) | Heap | 0x1100 | 34 KB | 2 KB | Yes | 4352 < 2048 ✗ | — | **Protection fault** |
| 0x2000 (stack) | Stack | 0x2000 | 28 KB | 2 KB | No | 8192 >= (max - 2048) ✗ | — | **Protection fault** (below stack start) |
| 0x3800 (stack) | Stack | 0x3800 | 28 KB | 2 KB | No | 14336 >= 14336 ✓ | 42 KB | Stack access (high addr, grows down) |

The stack example (last row) illustrates how negative growth works: a high offset within the segment's range is valid for a downward-growing stack.

## Common exam questions

- What are the three main segments, and what is stored in each?
- Why does the stack need a "grows positive" bit while the heap does not?
- How does segmentation reduce external fragmentation compared to base-and-bounds?
- Can two processes share a code segment? Why or why not?
- Given a 16-bit VA split as [2 segment bits][14 offset bits], segment table shows: Code base 32 KB, Heap base 34 KB. What is the PA for VA 0x3000 (offset 0x1000 in heap)?
- Why is internal fragmentation still a concern in segmentation?

## Gotchas

- **Negative offsets are implicit**: The stack's "negative growth" does not actually use negative numbers; the hardware checks that the offset is in the valid range for a downward-growing segment.
- **Segment bits must match program structure**: The OS must ensure segment bits match the logical layout (code in segment 0, heap in segment 1, etc.). Misalignment is a configuration bug.
- **Sharing requires trust**: Sharing a code segment is safe only if code is read-only. Write-sharing of data segments is dangerous and must be carefully managed.
- **Compaction still needed for fragmentation**: If a segment has only small free blocks, the segment must be compacted (moved and relinked), which is expensive.
- **More registers and complexity**: Each segment requires base/bounds/grow-bit, multiplying hardware costs compared to single base-and-bounds.

## Sources

- lectures/Week4_2.pdf: Segmentation definition, base and bounds per segment, code/heap/stack segments, growth direction bit, address translation, sharing, internal and external fragmentation
