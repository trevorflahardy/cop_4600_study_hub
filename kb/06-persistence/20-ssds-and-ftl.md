# SSDs and Flash Translation Layer (FTL)

## Definition

Solid-state drives (SSDs) use NAND flash memory instead of spinning disks. Flash memory requires **erase-before-write** (cannot flip bits from 1 to 0 without erasing the entire block). The **Flash Translation Layer** (FTL) is firmware that maps logical block addresses (what the OS sees) to physical flash pages, abstracts erase-before-write complexity, implements wear leveling (distributing erases evenly), and handles garbage collection. **TRIM** is a command allowing the OS to inform the FTL that a block is no longer needed.

## When to use

- **Understanding SSD performance**: Why random I/O is much faster on SSDs than HDDs.
- **SSD wear patterns**: How frequent writes cause wear; wear leveling extends lifespan.
- **OS/SSD optimization**: TRIM command, alignment, firmware updates.
- **Comparing HDD vs. SSD**: When and why SSDs dominate in modern systems.

## Key ideas

### NAND Flash Architecture

**Flash memory properties**:
- **Read**: Microseconds (very fast, random access).
- **Write**: Milliseconds (~0.1-1 ms per page, must write entire page at once).
- **Erase**: Tens of milliseconds (~1-10 ms per block, erases entire block of ~256-512 pages).
- **Program/erase cycles**: Limited lifespan (~10,000-100,000 cycles before cell wears out).

**Physical organization**:
```
Chip (one SSD may have multiple chips)
  ├─ Block 0 (256-512 pages)
  │   ├─ Page 0 (4 KB)
  │   ├─ Page 1 (4 KB)
  │   └─ ...
  ├─ Block 1
  │   └─ ...
```

**Critical constraint**: Must erase entire block (e.g., 256 pages × 4 KB = 1 MB) to overwrite a single page.

### Flash Translation Layer (FTL)

FTL is the SSD firmware layer that:

1. **Logical-to-physical mapping**: Maps OS logical block addresses (LBA 0, 1, 2, ...) to physical flash pages.
   ```
   OS sees:   LBA 0, LBA 1, LBA 2, ...
   FTL maps:  LBA 0 → Flash page 5032
              LBA 1 → Flash page 5033
              ...
   ```

2. **Erase management**: When overwriting a page, FTL erases the entire block and remaps the LBA to a new physical page.

3. **Wear leveling**: Distributes erases evenly across all blocks to prevent early failure from hot spots.
   ```
   Block 0: 9,500 erase cycles
   Block 1: 9,501 erase cycles
   ...
   Block N: 9,499 erase cycles
   (Goal: keep cycles balanced, extend drive lifespan)
   ```

4. **Garbage collection**: Reclaims blocks containing only invalid data (previously trimmed or deleted pages).

### Erase-Before-Write Problem

```
Physical page contains: 1111 1111 (all 1s)
OS wants to write:      1010 1010

Direct write doesn't work (can't flip 1→0 without erasing):
  Result: 1010 1010? NO, actual: 1010 1010 might be 1010 1010 if page
  starts empty, but if page already has data, logic is more complex.

FTL solution:
  1. Find a blank page in a blank block
  2. Copy valid data from current block to blank block
  3. Erase current block
  4. Map LBA to new page
  5. Write new data to new page
```

### TRIM Command

OS informs FTL that a block is no longer needed (file deleted, space trimmed).

```c
int ioctl(fd, BLKDISCARD, &range);  // Linux TRIM
```

**FTL response**:
- Mark LBA as "no longer needed"
- Don't copy this data during garbage collection
- Erase the block sooner (reduce write amplification)

**Without TRIM**:
- FTL assumes all blocks have valid data
- Must copy old data even if file was deleted
- Increases erase cycles and reduces SSD lifespan

### Write Amplification

**Definition**: Ratio of writes to SSD cells vs. writes from OS.

**Example**: 4 KB OS write causes:
1. Read valid data from block (10 pages) → 40 KB read
2. Erase block → 1 ms
3. Write valid data + new data to new block (11 pages) → 44 KB write

**Write amplification**: 44 KB written to SSD per 4 KB requested = ~11× amplification.

**Impact**: Increases wear, reduces SSD lifespan, generates heat.

**Mitigation**: TRIM reduces amplification by marking unused data as erasable.

## Pseudocode

### FTL Write Operation

```c
void ftl_write(uint32_t lba, void* data, int size) {
    // 1. Check if LBA is already mapped
    struct mapping* current = lba_to_mapping(lba);
    
    if (current != NULL) {
        // LBA already has data; must erase and remap
        struct block* old_block = get_block(current->physical_page);
        
        // Find a blank page (or garbage collect)
        struct page* blank_page = find_blank_page();
        if (!blank_page) {
            blank_page = garbage_collect();  // Erase and reclaim blocks
        }
        
        // Copy valid data from old block (except the page being overwritten)
        for_each(page in old_block) {
            if (page != current->physical_page) {
                // Valid data; copy to blank block
                copy_to_blank_block(page);
            }
        }
        
        // Erase old block
        erase_block(old_block);
    } else {
        // New LBA; find blank page
        struct page* blank_page = find_blank_page();
        if (!blank_page) {
            blank_page = garbage_collect();
        }
    }
    
    // Write data to blank page
    physical_write(blank_page, data, size);
    
    // Update mapping
    update_mapping(lba, blank_page);
}
```

### Garbage Collection

```c
struct page* garbage_collect() {
    // Find block with most invalid data (least valid data to copy)
    struct block* target_block = find_block_with_least_valid_data();
    
    // Copy valid pages to blank block
    struct block* blank_block = get_blank_block();
    for_each(page in target_block) {
        if (is_valid(page)) {
            // Copy to blank block, update mapping
            struct page* new_page = copy_page(page, blank_block);
            update_mapping(page->lba, new_page);
        }
    }
    
    // Erase target block
    erase_block(target_block);
    
    // Return a blank page from the erased block
    return get_blank_page(target_block);
}
```

## Hand-trace example

### Write Sequence on SSD

**Initial state**:
```
LBA 0 → Physical page 0
LBA 1 → Physical page 1
LBA 2 → Physical page 2
...
Physical block 0 contains pages 0-255 (all full, all valid)
Physical blocks 1-N: blank
```

**Operation 1: OS writes new data to LBA 0**

```
Step 1: Check LBA 0 mapping
  Current: LBA 0 → physical page 0 (in block 0)

Step 2: Erase needed (overwrite); find blank page
  FTL: physical page 256 (in block 1) is blank

Step 3: Copy valid data from block 0 (except page 0)
  Copy pages 1-255 to block 1 (adjacent to new page)
  
Step 4: Erase block 0 (all 256 pages)

Step 5: Write new data to physical page 256

Step 6: Update mapping
  LBA 0 → physical page 256
  LBA 1 → physical page 257
  ... (all remapped to block 1)
  
Result: OS wrote 4 KB, SSD wrote ~1 MB (255 pages copied + erased + new page)
Write amplification: ~256×
```

### TRIM Effect

**Same scenario, with TRIM**:

**Pre-trim state**:
```
LBA 0: data
LBA 1: data
LBA 2-255: data
```

**TRIM LBA 2-255** (delete large file):
```
Mark LBA 2-255 as invalid in FTL
FTL: "These pages can be erased without copying"
```

**Write to LBA 0** (overwrite):
```
Step 1: LBA 0 → physical page 0

Step 2: Erase needed; find blank page (page 256)

Step 3: Copy valid data from block 0
  Check: LBA 1 valid? YES
  Check: LBA 2 valid? NO (trimmed)
  Check: LBA 3 valid? NO (trimmed)
  ...
  Only copy LBA 1 (1 page)

Step 4: Erase block 0

Step 5: Write to page 256

Result: OS wrote 4 KB, SSD wrote ~8 KB (1 page copied + erased + new page)
Write amplification: ~2× (much better!)
```

## Common exam questions

1. Why must SSDs erase entire blocks before overwriting a page?
2. Explain wear leveling. Why is it needed?
3. What does the TRIM command do, and when should the OS use it?
4. Compare random I/O performance: HDD (6 ms) vs. SSD (0.1 ms) for a 4 KB read.
5. Why is write amplification on SSDs significant? How does it relate to SSD lifespan?
6. What is garbage collection? Why is it necessary?
7. If an SSD receives many random writes, which blocks are erased most frequently?

## Gotchas

- **Limited erase cycles**: NAND flash cells wear out after ~10,000-100,000 write/erase cycles. Wear leveling extends lifespan by distributing cycles evenly.
- **TRIM not magic**: TRIM improves performance and longevity only if the OS (and SSD) support it. Legacy systems without TRIM suffer higher write amplification.
- **Overprovisioning**: SSDs keep 7-10% extra capacity (not visible to OS) for wear leveling and garbage collection. This reduces usable capacity but extends lifespan.
- **SSD aging**: As SSD wears out (approaching erase cycle limit), performance degrades. Modern SSDs have firmware that throttles performance to prevent data loss.
- **Firmware bugs**: FTL is complex firmware. Bugs can cause data loss or corruption. Regular firmware updates are recommended.

## Sources

- Lectures on SSDs and FTL: NAND flash pages/blocks/erase-before-write, FTL logical-to-physical mapping, wear leveling (distribute erases), TRIM command (OS tells SSD block is free), garbage collection (reclaim blocks), comparison of HDD vs. SSD latency and throughput.

## Performance Comparison: HDD vs. SSD

| Metric | HDD (Cheetah 15K.5) | SSD (Modern NVMe) |
|---|---|---|
| Random read (4 KB) | 6 ms | 0.1 ms (60× faster) |
| Sequential read (100 MB) | 800 ms | 50 ms (16× faster) |
| Random write (4 KB) | 6 ms | 0.5 ms (12× faster) |
| Sequential write (100 MB) | 800 ms | 50 ms (16× faster) |
| Seek time | 4 ms | 0 ms (no seek) |
| Rotation latency | 2 ms | 0 ms (no rotation) |

**Takeaway**: SSDs eliminate seek and rotation latency, providing consistent sub-millisecond latency. Random I/O performance is dramatically better, making SSDs superior for almost all modern workloads.
