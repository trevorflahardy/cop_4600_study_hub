# TLB (Translation Lookaside Buffer)

## Definition

The TLB is a hardware cache of virtual-to-physical address translations, located inside the CPU. It stores recently used VPN-to-PFN mappings (via PTEs) to avoid the expensive main memory lookup on every address translation. A TLB hit returns the physical address in 1 memory access; a miss requires a full page table walk (1-7+ memory accesses depending on page table levels).

## When to use

- Understand why modern CPUs cache address translations.
- Analyze address translation performance with TLB hit/miss scenarios.
- Learn how TLB entries are managed (ASID tagging, eviction policies).
- See how huge pages increase TLB coverage.
- Recognize that TLB miss does not mean page fault.

## Key ideas

### TLB Hit vs. Miss

**TLB Hit**: The VPN (and ASID if present) match an entry in the TLB. The hardware returns the PFN immediately without consulting main memory. Total memory accesses: 1 (just the data/instruction reference).

**TLB Miss**: The VPN is not in the TLB. The hardware performs a page table walk, loading PTEs from main memory to find the PFN. Then it updates the TLB with the new translation. Total memory accesses: 1 (page table) + 1 (data/instruction) = 2 for single-level PT; 3 for two-level PT; etc.

### TLB Miss ≠ Page Fault

From Quiz 5 (zhang__quizzes__Attendance Quiz 5 S26 Key.txt, page 1):
"A TLB Miss just means the translation isn't in the cache; the hardware then checks the Page Table. If the page is in RAM, it's a TLB Miss/Page Table Hit. It only becomes a Page Fault if the page is not in RAM."

- **TLB miss with page table hit**: Page is in RAM; translation is loaded from PT into TLB; reference succeeds.
- **TLB miss with page table miss (page fault)**: Present bit in PTE is 0; page is on disk; OS brings it into RAM; then retry translation.

### ASID (Address Space Identifier)

Without ASID, the TLB must be flushed (cleared) on every context switch to prevent one process from accessing another's translations. With ASID:

From Quiz 5: "The ASID acts as a 'tag' to identify which process owns that translation, allowing the TLB to hold entries from multiple processes simultaneously without causing incorrect lookups."

Each TLB entry includes an ASID field. A hit requires both VPN and ASID to match the current process's ASID. This avoids flushing on context switch, improving performance.

### Spatial and Temporal Locality

The TLB's effectiveness depends on locality:

- **Temporal locality**: If a page was accessed recently, it's likely in the TLB and will be accessed again soon (high hit rate).
- **Spatial locality**: Accessing nearby data in the same page (or adjacent pages) reuses cached translations.

From Week 4_2.pdf, an array loop demonstrates spatial locality: iterating through 10 elements in a small address range causes multiple hits on a small number of TLB entries.

### Huge Pages

Standard pages (4 KB) use 4 KB * 1M TLB entries = 4 GB coverage. Huge pages (2 MB) use 2 MB * N entries = 2 MB * N coverage.

From Quiz 5: "Increasing the Page Size (e.g., from 4KB to 2MB 'Huge Pages') increases the TLB Coverage. TLB Coverage is (Number of Entries × Page Size). By using Huge Pages, the same number of TLB entries can map a significantly larger portion of memory."

**Example**: 128-entry TLB with 4 KB pages covers 128 * 4 KB = 512 KB. With 2 MB pages, it covers 128 * 2 MB = 256 MB (500x improvement).

### TLB Entry Structure

| Field | Bits | Meaning |
|-------|------|---------|
| VPN | 20 (typical) | Virtual page number to match |
| ASID | 8–12 (typical) | Address space ID for process isolation |
| PFN | 20 (typical) | Physical frame number (result of translation) |
| Valid | 1 | Is this entry valid? |
| Dirty/Accessed | 1–2 | For replacement policy |

## Pseudocode

```
on_memory_reference(virtual_address, process_asid):
  vpn = virtual_address >> page_offset_bits
  offset = virtual_address & (page_size - 1)
  
  // Check TLB
  for each entry in TLB:
    if entry.vpn == vpn and entry.asid == process_asid and entry.valid:
      pfn = entry.pfn  // TLB HIT
      physical_address = (pfn << page_offset_bits) | offset
      return memory[physical_address]  // 1 memory access
  
  // TLB MISS: walk page table
  pfn = walk_page_table(vpn)  // Accesses memory for PTE
  
  if pfn == PAGE_FAULT:
    raise page_fault  // Page on disk
  
  // Update TLB (may evict old entry via LRU/clock)
  insert_into_tlb(vpn, process_asid, pfn)
  
  physical_address = (pfn << page_offset_bits) | offset
  return memory[physical_address]  // 1 more memory access
```

## Hand-trace example

**Scenario**: TLB with 2 entries, 4 KB pages, single-level PT. Process X accesses VAs in order; trace TLB state and memory accesses.

| Access # | VA | VPN | ASID | TLB Entry 1 | TLB Entry 2 | TLB Hit? | Mem Accesses |
|-----------|----|----|------|------------|------------|---------|--------------|
| 1 | 0x1234 | 1 | X | — | — | No (empty) | 1 PT + 1 data = 2 |
| 2 | 0x1500 | 1 | X | (1,X,PFN_A,✓) | — | **Yes** | 1 |
| 3 | 0x5678 | 5 | X | (1,X,PFN_A,✓) | (5,X,PFN_B,✓) | **Yes** | 1 |
| 4 | 0x1ABC | 1 | X | (1,X,PFN_A,✓) | (5,X,PFN_B,✓) | **Yes** | 1 |
| 5 | 0x9000 | 9 | X | (9,X,PFN_C,✓) | (5,X,PFN_B,✓) | No (evict 1) | 1 PT + 1 data = 2 |
| 6 | 0x5ABC | 5 | X | (9,X,PFN_C,✓) | (5,X,PFN_B,✓) | **Yes** | 1 |

- Access 1: VPN 1 not in TLB; page table walk (1 memory access) then data access (1) = 2 total. TLB is updated.
- Access 2: VPN 1 in TLB with matching ASID; TLB hit; 1 memory access (data only).
- Access 5: VPN 9 evicts one entry (LRU or random). Page table walk + data access = 2.

**Two-level Page Table Variant** (from Quiz 5, page 2):

| Access Type | TLB Hit | TLB Miss | Notes |
|--------------|---------|----------|-------|
| Non-memory (fetch) | 1 | 3 | Hit: fetch + no exec data. Miss: 2 PT walks + fetch |
| Memory (load/store) | 2 | 4 | Hit: fetch + data. Miss: 2 PT walks + data |

With two-level PT and TLB hit, 1 access (fetch) + 1 access (data) = 2.  
With two-level PT and TLB miss, 1 access (directory) + 1 access (PT) + 1 access (data) = 3 for fetch, or 2 + 1 = 3 for memory ops, plus the instruction fetch: up to 4 total.

## Common exam questions

- What is the difference between a TLB hit and a page table hit?
- Why is ASID important for multi-process systems?
- How does huge pages increase TLB coverage?
- For a 2-level page table with TLB, how many memory accesses are required for a data load on a TLB miss?
- What happens when the TLB is full and a new translation must be added?
- Why does the TLB need a "valid" bit if the page table has one?

## Gotchas

- **TLB miss ≠ page fault**: A TLB miss just means a translation needs to be fetched from memory. The page itself might be in RAM (page table hit) or on disk (page fault).
- **ASID flushing on context switch**: Without ASID, the OS must flush the entire TLB on every context switch. With ASID, flushing is not needed, but ASID must be unique per process and non-zero.
- **TLB is fully associative**: Most TLBs search all entries in parallel to find a match, which is expensive in hardware but necessary for single-cycle hit latency.
- **Replacement policy matters**: LRU and clock are common but costly. Random replacement is simpler and works well in practice.
- **Huge pages complicate OS**: Using huge pages (e.g., 2 MB, 1 GB) reduces TLB misses but makes fragmentation management harder and requires OS support.
- **Coherence with page table**: When the OS modifies a PTE (e.g., during eviction), it must invalidate the corresponding TLB entry via a TLB shootdown on multi-core systems.

## Sources

- lectures/Week4_2.pdf: TLB definition, cache of translations, TLB hit/miss, spatial and temporal locality, TLB effectiveness, usage in array loop example
- zhang__quizzes__Attendance Quiz 5 S26 Key.txt: TLB miss ≠ page fault distinction, ASID tagging, huge pages coverage, memory access counts for 2-level PT with TLB
