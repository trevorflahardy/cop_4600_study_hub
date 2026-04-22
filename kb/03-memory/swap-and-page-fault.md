# Swap and Page Faults

## Definition

When physical memory is full, the OS uses secondary storage (disk) as "swap space" to extend available memory. When a page is not resident in RAM (present bit = 0), accessing it triggers a page fault, causing the OS to fetch the page from disk and update the page table. The OS uses the unused PFN bits to store the disk swap offset, allowing the page table to locate swapped pages.

## When to use

- Understand how OS extends memory beyond physical RAM.
- Learn what happens when a page fault occurs and how OS recovers.
- Recognize the role of the present bit in distinguishing resident vs. swapped pages.
- See how disk access dominates page fault latency compared to memory access.

## Key ideas

### Present Bit and Page Faults

The present bit in a PTE indicates whether the page is in RAM (1) or on disk (0).

- **Present = 1**: Page is in physical memory; normal translation proceeds.
- **Present = 0**: Page is on disk (or not yet allocated); accessing it triggers a **page fault**, an exception that invokes the OS page-fault handler.

### Swap Space

The OS reserves a region on disk for swapped-out pages. When memory is full and a new page must be loaded, the OS evicts a victim page:
1. If the victim page is dirty (modified), write it to swap.
2. Clear the page frame for the new page.
3. Load the new page from swap into the frame.
4. Update the PTE for the fetched page (set present=1) and the evicted page (set present=0).

### Storing Swap Offsets in PTE

From Quiz 5 (zhang__quizzes__Attendance Quiz 5 S26 Key.txt, page 1):
"When the Present Bit is 0, the bits usually reserved for the Physical Frame Number (PFN) in the PTE can be repurposed to store the disk address of the swapped-out page."

When a page is swapped out (present = 0), the PFN field becomes unused. The OS repurposes these bits to store the disk swap offset:

```
PTE (present = 0):
  [Present: 0] [Protection: ...] [Swap offset: ...]
  
  The swap offset tells OS where on disk to find the page.
```

**Example**: Assume PTE with 20 bits for PFN. If present=0, those 20 bits can hold a swap offset (up to 1 MB offset, or more with larger bit width).

### Page Fault Handler

When a page fault occurs:

1. **CPU raises exception**: Hardware detects present=0 and transfers control to OS.
2. **OS identifies page**: Examines faulting VA and PTE to get swap offset.
3. **OS allocates frame**: Finds a free frame, or evicts a victim page if memory is full.
4. **OS reads from disk**: Initiates disk I/O to read page from swap[offset].
5. **OS updates page table**: Sets PTE present=1 and PFN to the frame number.
6. **OS resumes process**: Returns from exception; process retries the faulted instruction.

**Latency**: Disk access is slow (milliseconds), making page faults expensive. Frequent page faults (thrashing) degrade performance dramatically.

### The Present Bit Requirement

From Quiz 5 (page 1): "When the OS swaps a page out to Swap Space, it must update the corresponding Page Table Entry (PTE) by setting the Present Bit to 0."

If the OS fails to clear the present bit, the next access will:
- Not trigger a page fault.
- Attempt to use the swap offset as a PFN.
- Access invalid physical memory or another process's data.

This corruption is a critical OS bug.

## Pseudocode

```
on_memory_access(virtual_address):
  vpn = virtual_address >> page_offset_bits
  offset = virtual_address & (page_size - 1)
  
  pte = load_pte(vpn)
  
  if not pte.valid:
    raise address_error  // Page never allocated
  
  if not pte.present:
    // PAGE FAULT: page is on disk
    raise page_fault(vpn)
  
  // Page is in memory; normal translation
  pfn = pte.pfn
  physical_address = (pfn << page_offset_bits) | offset
  return memory[physical_address]

on_page_fault(vpn):
  // 1. Find swap offset from PTE
  pte = load_pte(vpn)
  swap_offset = pte.pfn_or_swap_offset  // Reinterpreted as swap offset
  
  // 2. Allocate frame (may evict victim)
  frame = allocate_frame()
  if frame == NULL:
    victim_vpn = choose_victim_page()
    victim_pte = load_pte(victim_vpn)
    if victim_pte.dirty:
      write_to_disk(victim_pte.pfn, swap_offset[victim_vpn])
      victim_pte.dirty = 0
    victim_pte.present = 0
    frame = victim_pte.pfn
  
  // 3. Read page from disk
  read_from_disk(frame, swap_offset)  // I/O operation (slow!)
  
  // 4. Update page table
  pte.present = 1
  pte.pfn = frame
  pte.accessed = 0
  
  // 5. Resume process (retry instruction)
```

## Hand-trace example

**Scenario**: 4-frame physical memory, VA = 0x1100 (VPN 1, offset 0x100), PTE for VPN 1 has present=0 and swap_offset=256.

| Step | Event | Frame State | PTE[1] | Notes |
|------|-------|-------------|--------|-------|
| 1 | Process accesses VA 0x1100 | [Free, Free, Free, Free] | present=0, swap=256 | — |
| 2 | Page fault occurs | [Free, Free, Free, Free] | present=0 | CPU traps to OS |
| 3 | OS reads swap[256] from disk | [Loading frame 0, Free, Free, Free] | present=0 | Disk I/O (slow) |
| 4 | OS updates PTE | [Loaded, Free, Free, Free] | present=1, pfn=0 | Page now in RAM at frame 0 |
| 5 | Process retries access | [Loaded, Free, Free, Free] | present=1, pfn=0 | Translation succeeds: PA = (0*4096) + 0x100 = 0x100 |

Later, if memory fills and victim eviction is needed:

| Step | Event | Frame State | PTE[1] | PTE[victim] | Notes |
|------|-------|-------------|--------|------------|-------|
| 6 | Another fault; memory full | [In use, In use, In use, In use] | present=1 | present=1 | Choose victim (e.g., VPN 3 in frame 2) |
| 7 | Write victim to disk | [In use, In use, Writing frame 2, In use] | present=1 | dirty=1 | Disk I/O to write VPN 3 |
| 8 | OS marks victim swapped | [In use, In use, Free, In use] | present=1 | present=0, swap=512 | Victim evicted; frame 2 is freed |
| 9 | OS reads new page into frame 2 | [In use, In use, Loading new page, In use] | present=1 | — | New page fetched from disk |
| 10 | New page loaded | [In use, In use, In use, In use] | present=1 | present=1 | Memory is full again |

## Common exam questions

- What does the present bit indicate in a PTE?
- Why can the OS reuse the PFN bits for swap offsets when present=0?
- What is a page fault, and what are the steps in handling one?
- Why is disk I/O the dominant cost in page fault handling?
- True or False: A page with present=0 is invalid and should not be accessed.
- If the OS forgets to set present=0 when evicting a page, what could happen?

## Gotchas

- **Present vs. Valid**: Valid bit means the page is allocated (OS has set up a PTE); present bit means it is in RAM. A page can be valid but swapped (present=0).
- **Swap offset overwrites PFN**: When present=0, the PFN bits are repurposed for swap offset. The OS must never mix these up or corruption occurs.
- **Page faults are slow**: Disk access takes milliseconds; 100,000 page faults/second (thrashing) can reduce CPU to near idle. Page fault rate is critical for performance.
- **Dirty bit optimization**: Writing a clean (unmodified) page to disk is waste. The dirty bit tracks which pages need write-back, saving I/O.
- **Coherence on multi-core**: On multi-core systems, if one CPU evicts a page and updates its PTE, other CPUs' TLBs may cache the old translation. TLB shootdown (invalidation) is required.

## Sources

- lectures/Week4_2.pdf: Page faults, page fault handling, swap space, present bit, memory is full, page replacement
- zhang__quizzes__Attendance Quiz 5 S26 Key.txt (page 1): Present bit, swap offset reuse, page fault requirement, disk swap representation
