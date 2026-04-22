# FSCK: Filesystem Consistency Checker

## Definition

FSCK (filesystem checker) is a post-crash recovery tool that scans the entire filesystem to detect and repair inconsistencies. It checks superblocks, free blocks, inode states, link counts, duplicates, bad pointers, and directories. While effective, FSCK is slow (proportional to disk size) and cannot recover all corruption types (especially data integrity).

## When to use

- **After unclean shutdown**: Power loss, kernel panic, forced reboot.
- **Corrupted filesystem**: Detected corruption or missing files.
- **Pre-mounting filesystem**: Most systems run FSCK before mounting after an unclean shutdown.

## Key ideas

### FSCK Phases

**Phase 1: Superblock**
```
Check if superblock looks reasonable.
  - File system size > number of blocks allocated?
  - Number of inodes > 0?
  - Block size is power of 2?
  
If superblock is corrupt, use an alternate copy (FFS stores multiple).
```

**Phase 2: Free Blocks**
```
Scan all inodes, indirect blocks, and directory entries.
Collect all reachable blocks (blocks referenced by some inode).

Compare against data bitmap:
  - Blocks reachable but marked as free → repair bitmap
  - Blocks unreachable but marked as allocated → (space leak, handled in phase 5)
```

**Phase 3: Inode State**
```
For each allocated inode:
  - Check type (regular, directory, symlink, etc.)
  - Check if type is consistent with file size
  - Check if inode looks corrupted
  
If inode is suspect or corrupted:
  - Clear the inode (mark as unallocated)
  - Update inode bitmap
```

**Phase 4: Inode Links**
```
Verify link count (nlink) of each inode.
  
Scan directory tree:
  - Count how many directory entries point to each inode
  - Compare against nlink
  
If mismatch:
  - Update nlink in inode (or delete orphaned inodes)
```

**Phase 5: Duplicates and Orphans**
```
Detect blocks referenced by multiple inodes:
  - If one inode is obviously bad, clear it
  - Otherwise, copy the block to multiple inodes
  
Detect blocks allocated but not referenced:
  - Orphaned blocks (allocated in bitmap, not in any inode)
  - Move orphaned inodes to lost+found directory
```

**Phase 6: Directory Checks**
```
Ensure directory entries are valid:
  - "." and ".." entries exist and are correct
  - All inodes referenced in directories are allocated
  - No directory is linked to more than once (prevents cycles)
```

### Example Check: Free Blocks

```c
// Collect reachable blocks
set<uint32_t> reachable_blocks;

for (uint32_t ino = 0; ino < num_inodes; ino++) {
    if (!is_allocated(inode_bitmap, ino)) continue;
    
    struct inode* inode = load_inode(ino);
    
    // Add all blocks referenced by inode
    for (int i = 0; i < inode->num_blocks; i++) {
        reachable_blocks.insert(inode->block[i]);
    }
    
    // Add indirect block pointers
    if (inode->single_indirect) {
        reachable_blocks.insert(inode->single_indirect);
        // ... and blocks it points to
    }
}

// Compare with bitmap
for (uint32_t block = 0; block < num_blocks; block++) {
    bool allocated = is_allocated(data_bitmap, block);
    bool reachable = reachable_blocks.contains(block);
    
    if (reachable && !allocated) {
        // Fix: Mark as allocated
        data_bitmap[block / 8] |= (1 << (block % 8));
        printf("Fixed: Block %d marked as allocated\n", block);
    } else if (!reachable && allocated) {
        // Fix: Orphaned block (or space leak)
        // Often left alone (FSCK in phase 5 handles this)
    }
}
```

## Pseudocode

### FSCK Main Loop

```c
int fsck(char* device) {
    // Load superblock
    struct superblock* sb = load_superblock(device);
    
    // Phase 1: Check superblock
    if (sb->num_inodes <= 0 || sb->num_blocks <= 0) {
        printf("ERROR: Invalid superblock\n");
        return -1;
    }
    
    // Phase 2: Check free blocks
    check_free_blocks(sb);
    
    // Phase 3: Check inode state
    check_inode_state(sb);
    
    // Phase 4: Check inode links
    check_inode_links(sb);
    
    // Phase 5: Check duplicates and orphans
    check_duplicates_and_orphans(sb);
    
    // Phase 6: Check directories
    check_directories(sb);
    
    // Write repairs
    if (repairs_made) {
        write_bitmaps_and_inodes(device);
        printf("Filesystem repaired\n");
    }
    
    return 0;
}

void check_inode_links(struct superblock* sb) {
    // Count how many times each inode is referenced
    int* refcount = calloc(sb->num_inodes, sizeof(int));
    
    // Scan all directories
    scan_directories(sb, refcount);
    
    // Compare with nlink field
    for (uint32_t ino = 0; ino < sb->num_inodes; ino++) {
        if (!is_allocated(inode_bitmap, ino)) continue;
        
        struct inode* inode = load_inode(ino);
        
        if (refcount[ino] != inode->nlink) {
            printf("ERROR: Inode %d has nlink=%d but %d references\n",
                   ino, inode->nlink, refcount[ino]);
            
            // Fix: Update nlink
            inode->nlink = refcount[ino];
            disk_write_inode(ino, inode);
        }
    }
    
    free(refcount);
}
```

## Hand-trace example

### FSCK on Corrupted Filesystem

Initial state (after crash):
```
Inode 5: size=4 KB, block[0]=100, nlink=2
Inode 6: size=8 KB, block[0]=100, nlink=1  ← Duplicate block!
Inode 7: size=4 KB, block[0]=200, nlink=0  ← Orphaned inode

Directory entries:
  file5 (name) → inode 5
  file5_dup (name) → inode 5  ← Second hard link
  file6 (name) → inode 6

Data bitmap: blocks 100, 200 allocated
Inode bitmap: inodes 5, 6, 7 allocated
```

**FSCK Phase 4: Link Count Check**

```
Scan directories:
  file5 (inode 5): count = 2
  file5_dup (inode 5): count = 2 (cumulative)
  file6 (inode 6): count = 1
  (Inode 7 not in any directory)

Check against nlink:
  Inode 5: nlink=2, found=2 ✓ OK
  Inode 6: nlink=1, found=1 ✓ OK
  Inode 7: nlink=0, found=0 → Orphan!
```

**FSCK Phase 5: Orphan Handling**

```
Inode 7 is allocated but not in any directory.
  - Move inode 7 to lost+found directory
  - Create entry: lost+found/inode_7 → inode 7
  - Update inode 7 nlink = 1
```

**FSCK Phase 5: Duplicate Block Check**

```
Block 100:
  Inode 5 references it
  Inode 6 references it
  → Duplicate! One inode is bad or both reference the same physical block
  
Decision: Copy block 100 to a new block for inode 6 (or clear inode 6 if bad)
  - Allocate block 201
  - Copy block 100 → block 201
  - Update inode 6: block[0]=201
  - Update data bitmap: mark block 201 as allocated
```

**After FSCK**:
```
Inode 5: size=4 KB, block[0]=100, nlink=2 (unchanged, valid)
Inode 6: size=8 KB, block[0]=201, nlink=1 (block was duplicated, now fixed)
Inode 7: size=4 KB, block[0]=200, nlink=1 (moved to lost+found)

Filesystem consistent ✓
```

## Common exam questions

1. What are the six phases of FSCK?
2. FSCK detects a block allocated in bitmap but not in any inode. What is this called, and what does FSCK do?
3. Why is FSCK slow? How does it scale with disk size?
4. Can FSCK recover all data after a crash? What types of corruption can it NOT fix?
5. FSCK finds an inode pointing to a free block. What does it do?
6. Explain the difference between "orphaned inode" and "orphaned block."
7. After FSCK repairs a filesystem, are you guaranteed the data is correct?

## Gotchas

- **FSCK cannot recover data integrity**: If an inode points to garbage data (scenario 2/6 from crash consistency), FSCK sees no inconsistency. It repairs metadata, not data.
- **FSCK lost+found**: Orphaned inodes are moved to lost+found. The user must manually review and rename them.
- **FSCK time**: On a 10 TB disk with millions of inodes, FSCK can take hours. This was a major motivation for journaling.
- **No intermediate snapshots**: FSCK scans from block 0 to the end. If the disk fails mid-scan, the scan is invalidated and must restart.
- **Double-indirect blocks**: FSCK must follow multi-level indirection, adding I/O overhead.

## Sources

- lectures__Week14_1.txt: FSCK overview (superblock, free blocks, inode state, inode links, duplicates, bad blocks, directory checks), limitations (too slow, cannot fix all problems, only ensures metadata consistency), tools like fsck (ext4 fsck) or similar.
