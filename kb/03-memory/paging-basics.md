# Paging Basics

## Definition

Paging divides virtual and physical memory into fixed-size blocks called pages (virtual) and frames (physical). A page table maps virtual page numbers (VPNs) to physical frame numbers (PFNs) via an array of page table entries (PTEs), each containing the PFN and metadata bits (valid, protection, present, dirty, accessed).

## When to use

- Understand the fundamental mechanism behind modern virtual memory.
- Learn how OS manages memory with uniform page size, enabling flexible allocation.
- See how PTEs encode protection and replacement metadata.
- Grasp the trade-off between page table size and address flexibility.

## Key ideas

### Pages and Frames

- **Page**: A fixed-size block of virtual address space (e.g., 4 KB).
- **Frame**: A fixed-size block of physical memory (same size as a page, e.g., 4 KB).
- **Address space** is divided into VPNs; **physical memory** is divided into frames.

From Week 4_2.pdf, a 64-byte address space with 16-byte pages has 4 pages (VPN 0–3), each mappable to one of several frames.

### Virtual-to-Physical Translation

A virtual address is split into two components:

```
Virtual Address = [VPN] [Offset]
```

- **VPN** (virtual page number): The upper bits; index into the page table.
- **Offset**: The lower bits; the position within a page (unchanged in translation).

**Formula**:
```
Physical Address = PTE[VPN].PFN << page_offset_bits | Offset
```

Or more plainly:
```
Physical Address = PTE[VPN].PFN * page_size + Offset
```

**Example**: 64-byte VAS, 16-byte pages, VA = 0x21:
- VPN = 0x21 >> 4 = 2 (upper bits)
- Offset = 0x21 & 0x0F = 1 (lower 4 bits)
- PTE[2] holds PFN (e.g., PFN = 3)
- PA = (3 * 16) + 1 = 49

### Page Table Entry (PTE) Fields

Each PTE is typically 4–8 bytes and contains:

| Field | Bits | Meaning |
|-------|------|---------|
| Valid | 1 | Is this translation valid? (1 = yes, 0 = not yet allocated) |
| Protection | 2–3 | Read/write/execute permissions (R, W, X) |
| Present | 1 | Is the page in physical memory (1) or on disk (0)? |
| Dirty | 1 | Has the page been modified since loaded? (used for swap optimization) |
| Accessed | 1 | Has the page been accessed recently? (used for LRU replacement) |
| PFN | 20+ | Physical frame number (location of the page in RAM) |

From Week 4_2.pdf, x86 PTEs include flags like `PFN`, `G` (global), `D` (dirty), `A` (accessed), and protection bits.

### Address Bits

The number of bits for VPN and offset depends on address width and page size:

```
Offset bits = log2(page_size)
VPN bits = address_bits - offset_bits
```

**Examples**:
- 32-bit VA, 4 KB pages: Offset = 12 bits, VPN = 20 bits → 2^20 = ~1M pages.
- 64-byte VA, 16-byte pages: Offset = 4 bits, VPN = 2 bits → 4 pages.

### Page Table Storage

The page table is an array of PTEs, stored in physical memory. For a 32-bit system with 4 KB pages and 4-byte PTEs:
```
Number of entries = 2^20
PT size = 2^20 * 4 bytes = 4 MB
```

From Week 4_2.pdf, a linear page table can be large; it is stored in memory per process. Modern systems use multi-level page tables to reduce memory overhead.

## Pseudocode

```
translate(virtual_address, page_table_base):
  - vpn = virtual_address >> page_offset_bits
  - offset = virtual_address & (page_size - 1)
  
  - pte_address = page_table_base + (vpn * sizeof(PTE))
  - pte = load_from_memory(pte_address)
  
  - if not pte.valid:
      raise page_fault  // Page not allocated
  
  - if not pte.present:
      raise page_fault  // Page on disk, trigger swap-in
  
  - pfn = pte.pfn
  - physical_address = (pfn << page_offset_bits) | offset
  
  - check_permissions(pte.protection, access_type)
  
  - return physical_address
```

## Hand-trace example

**Scenario**: 64-byte VAS, 16-byte pages, page table base at 0x1000. Accessing VAs 0x05, 0x1F, 0x31.

| VA | VPN | Offset | PTE Addr | PTE Valid | PFN | PA | Access Result |
|----|-----|--------|----------|-----------|-----|----|----|
| 0x05 | 0 | 5 | 0x1000 | 1 | 5 | (5*16)+5=85 | Hit; data at PA 85 |
| 0x1F | 1 | 15 | 0x1004 | 1 | 2 | (2*16)+15=47 | Hit; data at PA 47 |
| 0x31 | 3 | 1 | 0x100C | 0 | — | — | **Page Fault**: VPN 3 not allocated |
| 0x2E | 2 | 14 | 0x1008 | 1 | 7 | (7*16)+14=126 | Hit; data at PA 126 |

- VA 0x05: VPN = 0x05 >> 4 = 0, Offset = 0x05 & 0x0F = 5. PTE at 0x1000 is valid with PFN 5, so PA = 80 + 5 = 85.
- VA 0x31: VPN = 0x31 >> 4 = 3, Offset = 1. PTE at 0x100C is invalid, so page fault.

## Common exam questions

- Given 32-bit VA, 4 KB pages, how many bits are for VPN? How many for offset?
- What does the "present bit" indicate, and why is it separate from "valid"?
- If a PTE has valid=1 and present=0, what does the OS do on a memory reference to that page?
- Explain why offset bits are copied directly from VA to PA (not looked up in a table).
- Given a page table base, VPN, and PTE size, compute the physical address of the PTE.
- How large is a linear page table for 32-bit VA with 4 KB pages and 4-byte PTEs?

## Gotchas

- **Offset is unchanged**: The offset part of the VA is copied directly to the PA. Only VPN is translated; this is why offset bits = log2(page_size).
- **Present vs. Valid**: Valid means the OS allocated the page in the page table; present means it's currently in RAM. A page can be valid but swapped to disk (present=0).
- **Page table is in memory**: Accessing a PTE requires a memory read, adding latency. TLBs cache this.
- **Large page tables**: A 32-bit VA with 4 KB pages requires 4 MB per process just for the page table. Multi-level tables reduce this.
- **Protection is per-page**: All accesses within a 4 KB page share the same permissions. Fine-grained protection requires smaller pages (expensive).

## Sources

- lectures/Week4_2.pdf: Paging definition, pages and frames, VPN and offset, address translation, PTE fields, linear page table size
