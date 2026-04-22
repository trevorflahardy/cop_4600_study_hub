# Inverted Page Tables

## Definition

An inverted page table (IPT) maintains one entry per physical frame (not per virtual page), mapping backward from physical to virtual. Each frame entry stores the VPN and process ID of the page resident in that frame. Address translation requires hashing the VPN to find the frame entry, then dereferencing to get the PFN (which is implicit in the entry's position).

## When to use

- Understand alternative page table designs that save memory in large address spaces.
- Recognize when inverted tables are used (legacy systems, specific architectures).
- Learn the trade-off: saving memory (linear in physical memory size, not VAS size) vs. slower translation (hash lookup instead of direct indexing).

## Key ideas

### Why Inverted?

Standard (forward) page tables have one entry per virtual page, so size = VAS bits. For a 64-bit system with 4 KB pages, the forward PT would have 2^52 entries—impossible.

Inverted tables have one entry per physical frame, so size = physical memory size. For 512 MB PM with 4 KB pages, that is 512 MB / 4 KB = 128K entries—practical.

**Trade-off**: Smaller memory footprint, but slower translation (requires a hash lookup).

### IPT Entry Structure

| Field | Bits | Meaning |
|-------|------|---------|
| VPN | 20+ | Virtual page number of page in this frame |
| PID/ASID | 8-16 | Process ID or address space identifier |
| Valid | 1 | Is this frame in use? |
| Dirty/Accessed | 1-2 | For replacement policy |

Each IPT entry corresponds to a physical frame. Entry index i = frame i (implicit PFN).

### Address Translation via Hash

1. Hash the VPN (and PID) to get a hash index.
2. Search the IPT starting at that hash index for a matching VPN + PID.
3. If found, the entry's position is the PFN (implicit).
4. On collision, traverse linked list or use secondary hash function.

**Pseudocode**:
```
translate_ipt(virtual_address, pid):
  vpn = virtual_address >> offset_bits
  offset = virtual_address & (page_size - 1)
  
  hash_index = hash(vpn, pid)
  
  while true:
    entry = ipt[hash_index]
    if entry.valid and entry.vpn == vpn and entry.pid == pid:
      pfn = hash_index  // Implicit: frame at position hash_index
      physical_address = (pfn << offset_bits) | offset
      return memory[physical_address]
    
    // Collision: linear probing or linked list
    hash_index = (hash_index + 1) % ipt_size
    if hash_index wrapped without finding: raise page_fault
```

### Memory Overhead

Forward PT size = 2^(VA_bits - page_offset_bits) * PTE_size

Inverted PT size = (physical_memory_bytes / page_size) * IPT_entry_size

**Example**:
- 64-bit VA, 4 KB pages, 8-byte PTE: Forward PT = 2^52 * 8 = prohibitive
- 512 MB PM, 4 KB pages, 8-byte IPT entry: Inverted PT = (2^29 / 2^12) * 8 = 2^17 * 8 = 1 MB (practical!)

### Drawbacks

**Slower translation**: Hash lookup is slower than direct array indexing, especially on collisions.

**Hash function quality**: Poor hashing causes collisions, forcing sequential searches through the IPT.

**No page table for each process**: Unlike forward tables (one per process), an IPT is system-wide. It maps all processes' pages, requiring the PID field for disambiguation.

**Shared memory complexity**: Sharing pages between processes requires additional data structures (page sharing table).

## Pseudocode

```
ipt_translate(vpn, pid, offset):
  hash_value = hash(vpn, pid)
  index = hash_value % ipt_size
  
  loop_count = 0
  while loop_count < ipt_size:
    entry = ipt[index]
    
    if entry.valid:
      if entry.vpn == vpn and entry.pid == pid:
        // Hit
        pfn = index
        return (pfn << offset_bits) | offset
    else:
      // Entry is free; page not in memory
      return page_fault
    
    // Collision: linear probing
    index = (index + 1) % ipt_size
    loop_count += 1
  
  // Wrapped around entire IPT
  return page_fault
```

## Hand-trace example

**Scenario**: IPT with 8 entries, simple hash = VPN % 8.

| Index | VPN | PID | Valid | Notes |
|-------|-----|-----|-------|-------|
| 0 | — | — | 0 | Empty |
| 1 | 5 | A | 1 | Process A's page 5 in frame 1 |
| 2 | — | — | 0 | Empty |
| 3 | 3 | B | 1 | Process B's page 3 in frame 3 |
| 4 | 12 | A | 1 | Process A's page 12 in frame 4 (hashes to 4: 12 % 8 = 4) |
| 5 | 5 | B | 1 | Process B's page 5 in frame 5 (collision with A's page 5) |
| 6 | — | — | 0 | Empty |
| 7 | — | — | 0 | Empty |

**Translation** for Process A accessing VA with VPN 5, offset 0x100:

| Step | Calculation | Result |
|------|-------------|--------|
| Hash | hash(5, A) = 5 % 8 | 5 |
| Check ipt[5] | VPN 5, PID B, valid 1 | Mismatch PID (want A, got B) |
| Collision | linear probe to (5+1) % 8 | 6 |
| Check ipt[6] | Valid 0 | Empty; end of chain |
| Result | Not found; page fault? | Wait—**wrong!** Entry 1 has VPN 5, PID A |

**Correction**: The hash function should have found entry 1 directly (5 % 8 = 5, but collision drove us to look at 5, then 6, missing entry 1). This demonstrates hash collision problems. A better hash or open addressing strategy is needed. In this example, Process B's page at entry 5 causes the collision.

**Correct trace** if Process B's page 5 were at a different frame:

| Step | Calculation | Result |
|------|-------------|--------|
| Hash | hash(5, A) = 5 % 8 | 5 |
| Check ipt[5] | VPN 5, PID A, valid 1 | **Hit!** pfn = 5 |
| Physical | (5 << page_offset_bits) \| 0x100 | Frame 5, offset 0x100 |

## Common exam questions

- Why is an inverted page table smaller than a forward page table for 64-bit systems?
- What is the main disadvantage of inverted page tables?
- Explain how hashing is used in IPT translation.
- If physical memory is 512 MB, page size is 4 KB, and each IPT entry is 8 bytes, how large is the IPT?
- True or False: In an inverted page table, each process has its own page table.

## Gotchas

- **Hash table design is critical**: Poor hashing (e.g., VPN % 8 on sparse VPNs) causes many collisions and slow translation. Modern designs use better hash functions (e.g., linear congruential, cryptographic hashes).
- **No per-process PT**: Unlike forward tables (one per process), IPT is system-wide, complicating process isolation and TLB invalidation.
- **Shared pages need auxiliary structure**: Sharing code segments between processes requires an additional mapping structure (e.g., page sharing table or reverse mapping table).
- **IPT size is fixed**: Physical memory size determines IPT size; adding more pages requires rebuilding the hash table.
- **IPT not commonly used in modern systems**: Most modern OS (Linux, Windows) use forward multi-level tables because hash collisions are unpredictable and miss/hit latency varies.

## Sources

- lectures/Week4_2.pdf: Inverted page tables, one entry per physical frame, hash lookup vs. direct indexing
- zhang__quizzes__Attendance Quiz 5 S26 Key.txt (page 3): "Inverted PT size proportional to VA size" is False; "each process has its own PT" is False
