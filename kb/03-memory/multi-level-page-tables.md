# Multi-Level Page Tables

## Definition

Multi-level page tables replace a single large page table with a tree structure, where the top level is a page directory containing pointers to second-level (and deeper) page table nodes. Only allocated portions of the page table are allocated in memory, reducing overhead when the virtual address space is sparsely used.

## When to use

- Reduce page table memory overhead for sparse address spaces.
- Understand how modern 64-bit systems handle huge address spaces (e.g., 2^48 bits).
- Trade address translation latency (extra memory accesses) for memory savings.
- Recognize the scalability advantage over linear page tables.

## Key ideas

### Why Multi-Level?

A linear page table for 32-bit VA with 4 KB pages requires 2^20 = 1M entries, consuming 4 MB per process. For 64-bit VA, the linear table would require 2^52 entries—prohibitively large. Multi-level tables avoid allocating memory for unneeded portions.

**Example**: If a 64-bit process uses only the bottom 1 GB and top 1 GB of address space, a multi-level table allocates only PTEs for those regions, saving memory.

### Two-Level Structure

**Level 1 (Page Directory)**: An array of page directory entries (PDEs), each pointing to a secondary page table (or marked invalid if that range is unused).

**Level 2 (Page Table)**: Traditional page table, with PTEs pointing to physical frames.

### Address Translation in 2-Level PT

The virtual address is split into three components:

```
VA = [Directory Index][Page Table Index][Offset]
```

From exam_1.txt (question 3, page 8):
- 38-bit VA, 16 KiB pages, 4-byte PDE/PTE
- Offset bits = log2(16 KiB) = log2(2^14) = 14 bits
- Remaining bits for indices = 38 - 14 = 24 bits
- Must split 24 bits between directory and PT indices

**Calculation** (from exam_1.txt, page 9):
- PDE size = 4 bytes, so each PDE covers: page_size / pde_size = 16384 / 4 = 4096 entries in a single PT
- Each PT covers 4096 * 16 KB = 64 MB of VA
- Directory entries needed = 2^38 / (64 MB) = 2^38 / 2^26 = 2^12 = 4096
- Directory index bits = 12, PT index bits = 12, offset bits = 14

**Translation Steps**:
1. Extract directory index (top 12 bits) from VA.
2. Load PDE from `page_directory_base + (dir_index * 4)`.
3. Get PT base address from PDE.
4. Extract page table index (middle 12 bits) from VA.
5. Load PTE from `pt_base + (pt_index * 4)`.
6. Get PFN from PTE.
7. Combine PFN with offset to form PA.

**Memory accesses**: 2 (for PTEs) + 1 (for data) = 3 minimum (if both PDEs and PTEs are in TLB, only 1).

### Deeper Hierarchies

Systems with 64-bit VA often use 4, 5, or more levels. With each level, translation latency increases but memory efficiency improves.

From exam_1.txt (question 4, page 9): "With a 5-level page table, how many times is the physical memory accessed?"
- Single-level with TLB hit: 1
- TLB miss: 5 (one PT walk per level) + 1 (data) = up to 11 total memory accesses in worst case

More precisely:
- TLB hit: 1 (data only)
- TLB miss: 5 (five PT levels) + 1 (data) = 6
- But the answer lists: 1, 3, 5, 7, 9, 11 (covering all combinations of TLB hit/miss and instruction fetch)

### Valid Bit Optimization

A key advantage: if a PDE has valid=0, the entire secondary PT is not allocated. This saves memory for large gaps in the address space. The OS only allocates a secondary PT when needed (lazy allocation).

## Pseudocode

```
translate_2level(virtual_address, directory_base):
  dir_index = virtual_address >> (pt_index_bits + offset_bits)
  pt_index = (virtual_address >> offset_bits) & ((1 << pt_index_bits) - 1)
  offset = virtual_address & (page_size - 1)
  
  // Level 1: Page Directory
  pde_address = directory_base + (dir_index * sizeof(PDE))
  pde = load_from_memory(pde_address)  // 1st memory access
  
  if not pde.valid:
    raise page_fault  // Secondary PT not allocated
  
  pt_base = pde.page_table_address
  
  // Level 2: Page Table
  pte_address = pt_base + (pt_index * sizeof(PTE))
  pte = load_from_memory(pte_address)  // 2nd memory access
  
  if not pte.valid:
    raise page_fault
  
  pfn = pte.pfn
  physical_address = (pfn << offset_bits) | offset
  
  return memory[physical_address]  // 3rd memory access
```

## Hand-trace example

**Scenario**: 2-level page table with 16-bit VA, 4-byte page size (2-bit offset), 4-byte PDE/PTE.

| Parameter | Calculation | Value |
|-----------|-------------|-------|
| VA bits | | 16 |
| Offset bits | log2(4) | 2 |
| Index bits | 16 - 2 | 14 |
| Split (symmetric) | 14 / 2 | 7 bits per level |
| Dir entries | 2^7 | 128 |
| PT entries | 2^7 | 128 |
| Max VA per PT | 128 * 4 | 512 bytes |
| Dir base | | 0x1000 |

**Address Translation** for VA = 0x2A5C:

| Step | Calculation | Result | Memory Access |
|------|-------------|--------|----------------|
| Binary | 0x2A5C = 0010101001011100 | — | — |
| Dir index | top 7 bits = 0010101 | 0x15 (21 decimal) | — |
| PT index | middle 7 bits = 0010110 | 0x16 (22 decimal) | — |
| Offset | bottom 2 bits = 00 | 0x00 | — |
| PDE addr | 0x1000 + (0x15 * 4) = 0x1000 + 0x54 | 0x1054 | 1st: Load PDE |
| PDE value | Assume PDE[0x15] = 0x2000 (PT base) | 0x2000 | — |
| PTE addr | 0x2000 + (0x16 * 4) = 0x2000 + 0x58 | 0x2058 | 2nd: Load PTE |
| PTE value | Assume PTE[0x16] = 0x5002 (PFN=5) | 0x5002 | — |
| Physical | (5 << 2) \| 0x00 | 0x14 (20 decimal) | 3rd: Load data |

## Common exam questions

- **MCQ:** For a 38-bit VA with 16 KiB pages and 4-byte PDE/PTE, how many offset bits are there?
  - [x] 14
  - [ ] 12
  - [ ] 13
  - [ ] 16
  - why: Offset bits = log2(16 KiB) = log2(2^14) = 14.
- **MCQ:** Under the same 38-bit VA / 16 KiB page / 4-byte entry setup, how are the index bits split between directory and page table?
  - [x] 12 directory bits and 12 page-table bits
  - [ ] 10 directory bits and 14 page-table bits
  - [ ] 14 directory bits and 10 page-table bits
  - [ ] 11 directory bits and 13 page-table bits
  - why: Each PT fits in one 16 KiB page: 16384 / 4 = 4096 = 2^12 entries, so PT index = 12 bits. Remaining 38 - 14 - 12 = 12 bits become the directory index.
- **MCQ:** Why does a multi-level page table save memory compared to a linear page table for sparse address spaces?
  - [x] Secondary page tables are only allocated for regions of VAS that are actually used; invalid PDEs cost only one entry.
  - [ ] Each PTE is smaller in multi-level page tables.
  - [ ] Multi-level tables are compressed at runtime.
  - [ ] The TLB eliminates the need for most entries.
  - why: If a PDE has valid=0, no secondary PT is allocated for that 2^(PT-bits + offset-bits) range, avoiding wasted memory on unused regions.
- **MCQ:** For a 2-level page table walk on a TLB miss, how many memory accesses are needed to load one data word?
  - [x] 3 (directory, PT, data)
  - [ ] 2 (PT, data)
  - [ ] 4 (directory, PT, TLB, data)
  - [ ] 1 (data only)
  - why: Each level is read from memory (1 PDE + 1 PTE = 2), then the data itself = 3 total. On a TLB hit it drops to 1.
- **MCQ:** What happens during translation when a PDE has valid=0?
  - [x] A page fault is raised and no secondary PT lookup is performed.
  - [ ] The hardware zero-extends the PDE and keeps walking.
  - [ ] The OS silently allocates a secondary PT and retries.
  - [ ] The TLB is flushed and the walk restarts.
  - why: valid=0 means no secondary PT exists for that range; the hardware traps to the OS, which decides whether to allocate or kill the process.
- **MCQ:** For a 5-level page table on a TLB miss loading a data word (no instruction fetch counted), how many memory accesses occur at minimum?
  - [x] 6 (five PT levels + data)
  - [ ] 5 (just the PT levels)
  - [ ] 11 (all combinations)
  - [ ] 3 (only three levels are walked)
  - why: Each of the 5 levels requires 1 memory access, plus 1 for the data itself. Including instruction fetch and TLB hits yields the 1/3/5/7/9/11 set noted in exam_1.

## Gotchas

- **Symmetric vs. asymmetric splits**: Many designs split bits equally (e.g., 12 bits per level for a 32-bit VA with 12-bit offset), but some split asymmetrically (e.g., 10 + 10 + 12).
- **Directory is always allocated**: The top-level directory must be allocated and pinned in memory, unlike secondary PTs which can be lazy-allocated.
- **Increased latency on miss**: Each additional level adds one more memory access on a TLB miss. A 5-level PT with a TLB miss can require 5 + 1 = 6 memory accesses (or more with instruction fetch).
- **TLB still critical**: Even with multi-level tables, a fast TLB is essential to avoid the multi-access penalty on every translation.
- **Sparse allocation not transparent**: The OS must actively deallocate secondary PTs when they become unused, or memory leaks. Modern systems use reference counting or page table reclamation.

## Sources

- lectures/Week4_2.pdf: Multi-level page tables definition, reducing memory overhead, page directory, secondary page tables
- exams__exam_1.txt (page 8-9): 38-bit VA, 16 KiB pages, 2-level PT calculation; 5-level PT memory access counts
