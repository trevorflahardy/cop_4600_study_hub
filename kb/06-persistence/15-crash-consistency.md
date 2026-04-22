# Crash Consistency: Six Scenarios and Corruption Types

## Definition

When a crash occurs during a multi-block filesystem update, intermediate states can leave the filesystem inconsistent. Six crash scenarios arise when appending a block to a file: writing only the data block (garbage read), only the inode (dangling pointer), only the bitmap (space leak), or combinations thereof. Each results in a specific inconsistency.

## When to use

- **Understanding why journaling exists**: Motivation for write-ahead logging.
- **FSCK heuristics**: What inconsistencies FSCK must detect and repair.
- **Crash resilience design**: Why atomic multi-block operations are hard.

## Key ideas

### The Three-Write Problem

Appending a block to a file requires three updates:
1. **Data block (Db)**: New user data.
2. **Inode (I[v2])**: Updated block pointer, size, mtime.
3. **Bitmap (B[v2])**: Mark block as allocated.

These three writes are not atomic. A crash after 1 or 2 writes causes inconsistency.

### Crash Scenario 1: Only Data Block Written

```
Before: inode 2 → block 4; bitmap: block 4 allocated
Writes: Db written
Crash!

After crash:
  Disk: block 5 contains new data (orphaned)
  Inode: still points to block 4 (old content)
  Bitmap: block 5 marked as free
  
Consistency: CONSISTENT (data is written but unreachable)
Safety: Data lost; OK (from FS perspective; no corruption)
```

### Scenario 2: Only Inode Written

```
Before: inode 2 → block 4; bitmap: block 4 allocated
Writes: I[v2] written (now points to block 5)
Crash!

After crash:
  Disk: inode 2 points to block 5
  Block 5: contains garbage (old data at that location)
  Bitmap: block 5 marked as free
  
Consistency: INCONSISTENT (inode points to garbage)
Safety: **Corruption** (reads garbage instead of intended data)
Problem: FS sees file as valid; user reads garbage
```

### Scenario 3: Only Bitmap Written

```
Before: inode 2 → block 4; bitmap: block 4 allocated
Writes: B[v2] written (block 5 marked as allocated)
Crash!

After crash:
  Disk: inode 2 still points to block 4
  Bitmap: block 5 marked as allocated (in-use)
  Block 5: never written; contains garbage
  
Consistency: INCONSISTENT (space leak)
Safety: Safe (no corruption), but wasteful (block 5 is never reused)
Problem: FS space is wasted
```

### Scenario 4: Data + Inode Written (Bitmap Not)

```
Before: inode 2 → block 4; bitmap: block 4 allocated
Writes: Db + I[v2] written
Crash!

After crash:
  Disk: inode 2 points to block 5 (correct)
  Block 5: contains new data (correct)
  Bitmap: block 5 marked as free (incorrect!)
  
Consistency: INCONSISTENT (inode-bitmap mismatch)
Safety: Data is safe, but bitmap is wrong
Problem: FSCK will flag block 5 as free; if reused, corruption
```

### Scenario 5: Data + Bitmap Written (Inode Not)

```
Before: inode 2 → block 4; bitmap: block 4 allocated
Writes: Db + B[v2] written
Crash!

After crash:
  Disk: inode 2 still points to block 4 (old)
  Block 5: contains new data (orphaned)
  Bitmap: block 5 marked as allocated (correct)
  
Consistency: INCONSISTENT (orphaned block)
Safety: Data is lost (not reflected in inode)
Problem: FSCK will find block 5 allocated but not in any inode; move to lost+found
```

### Scenario 6: Inode + Bitmap Written (Data Not)

```
Before: inode 2 → block 4; bitmap: block 4 allocated
Writes: I[v2] + B[v2] written
Crash!

After crash:
  Disk: inode 2 points to block 5 (new)
  Block 5: contains garbage (old data)
  Bitmap: block 5 marked as allocated (correct)
  
Consistency: INCONSISTENT (inode points to garbage)
Safety: **Corruption** (reads garbage)
Problem: FS looks consistent to FSCK; data is corrupted
```

## Summary Table

| Scenario | Written | Crash After | Inode | Bitmap | Block | Corruption | Recovery |
|---|---|---|---|---|---|---|---|
| 1 | Data only | All 3 writes | Old | Free | New data (orphaned) | None | Lost (OK) |
| 2 | Inode only | Bitmap not | New (bad ptr) | Free | Garbage | YES (garbage read) | FSCK: inode-bitmap mismatch |
| 3 | Bitmap only | Inode, Data not | Old | Allocated | Not written | None (space leak) | FSCK: allocated block not in any inode |
| 4 | Data + Inode | Bitmap only | New (good) | Free (wrong) | New data (good) | Potential (block reuse) | FSCK: inode-bitmap mismatch |
| 5 | Data + Bitmap | Inode only | Old | Allocated | New data (orphaned) | None | FSCK: orphaned block in lost+found |
| 6 | Inode + Bitmap | Data only | New (bad ptr) | Allocated | Garbage | YES (garbage read) | FSCK: inode points to unread block |

## Pseudocode

### The Three Writes (Synchronous)

```c
int write_block_synchronous(struct inode* inode, byte* data, int size) {
    // Find free block
    uint32_t free_block = find_free_block();
    
    // Write 1: Data block
    disk_write(free_block, data);
    disk_wait();  // Ensure write complete
    
    // Write 2: Inode (block pointer + size)
    inode->block_pointer[inode->num_blocks] = free_block;
    inode->size += size;
    disk_write_inode(inode);
    disk_wait();  // Ensure write complete
    
    // Write 3: Bitmap (mark block as allocated)
    bitmap[free_block / 8] |= (1 << (free_block % 8));
    disk_write(BITMAP_BLOCK, bitmap);
    disk_wait();  // Ensure write complete
    
    return 0;
}
```

If crash occurs between any two writes, inconsistency results.

### FSCK Detection

```c
void fsck_check_consistency() {
    // Scan all allocated inodes
    for (uint32_t ino = 0; ino < num_inodes; ino++) {
        if (!is_allocated(inode_bitmap, ino)) continue;
        
        struct inode* inode = load_inode(ino);
        
        // Check all block pointers
        for (int i = 0; i < inode->num_blocks; i++) {
            uint32_t block = inode->block_pointer[i];
            
            // Scenario 2/6: Inode points to free block
            if (!is_allocated(data_bitmap, block)) {
                printf("ERROR: Inode %d points to unallocated block %d\n", ino, block);
                // Fix: Clear pointer or repair
            }
        }
    }
    
    // Check for orphaned blocks (allocated but not in any inode)
    for (uint32_t block = 0; block < num_blocks; block++) {
        if (!is_allocated(data_bitmap, block)) continue;
        
        bool found_in_inode = false;
        for (uint32_t ino = 0; ino < num_inodes; ino++) {
            struct inode* inode = load_inode(ino);
            for (int i = 0; i < inode->num_blocks; i++) {
                if (inode->block_pointer[i] == block) {
                    found_in_inode = true;
                    break;
                }
            }
            if (found_in_inode) break;
        }
        
        if (!found_in_inode) {
            printf("ERROR: Block %d allocated but not in any inode\n", block);
            // Fix: Move to lost+found or deallocate
        }
    }
}
```

## Hand-trace example

### Append 4 KB to File

Initial state:
```
Inode 10: size=4 KB, block_ptr[0]=100, block_ptr[1]=0
Block 100: "old data" (first 4 KB)
Block 200: Free
Bitmap: bits 100 (allocated), 200 (free)
```

Goal: Append 4 KB, making size=8 KB, using block 200.

**Writes to execute**:
1. Write block 200 with "new data"
2. Update inode 10 (set block_ptr[1]=200, size=8 KB)
3. Update bitmap (set bit 200 as allocated)

**Scenario 2 crash** (only write 2 executes):
```
After crash:
Inode 10: size=8 KB, block_ptr[0]=100, block_ptr[1]=200
Block 100: "old data"
Block 200: **garbage** (was never written)
Bitmap: bits 100 (allocated), 200 (free)

Reading inode 10 sees size=8 KB but reads block 200 (garbage).
FSCK: block 200 is free but inode points to it → inconsistent
```

**Scenario 4 crash** (writes 1 and 2 execute):
```
After crash:
Inode 10: size=8 KB, block_ptr[0]=100, block_ptr[1]=200
Block 100: "old data"
Block 200: "new data" (written correctly)
Bitmap: bits 100 (allocated), 200 (free) ← WRONG!

Reading inode 10 sees size=8 KB and reads block 200 (correct "new data").
FSCK: block 200 is free but inode points to it → inode-bitmap mismatch
If block 200 is reallocated to another file, both files claim it → corruption.
```

## Common exam questions

1. List the six crash scenarios when appending a block to a file.
2. Which scenario causes garbage data to be read? Which is safest?
3. What does FSCK do if it finds a block allocated in the bitmap but not in any inode?
4. Why is scenario 4 (data + inode, no bitmap) dangerous?
5. Can FSCK repair all scenarios? Which are unrecoverable?
6. Explain why the three writes must happen in a specific order to minimize corruption.
7. How does journaling prevent these six scenarios?

## Gotchas

- **FSCK limitations**: FSCK can detect inode-bitmap mismatches, but cannot distinguish between "data that should be there" and "garbage." It rebuilds consistency but may lose data.
- **Invisible corruption**: Scenario 2 and 6 look internally consistent to FSCK (inode is valid, metadata matches). The only symptom is garbage data, which the user may not notice immediately.
- **Bitmap-first vs. inode-first**: The order of writes matters. Writing bitmap first risks allocating a block to two files (if inode update crashes). Writing inode first risks orphaning blocks.
- **Replication**: Real filesystems might write inode or bitmap twice (to different blocks) to reduce crash window. FFS doesn't do this; hence FSCK.
- **Sector atomicity**: HDDs guarantee 512-byte writes are atomic. Larger blocks (4 KB) are NOT atomic. A crash mid-block-write leaves the block partially written.

## Sources

- lectures__Week14_1.txt: Six crash scenarios (data only, inode only, bitmap only, data+inode, data+bitmap, inode+bitmap), inconsistency types (garbage read, space leak, dangling pointer), FSCK overview (checks superblock, free blocks, inode state, inode links, duplicates, bad pointers, directories).
