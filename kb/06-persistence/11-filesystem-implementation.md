# Filesystem Implementation: Disk Layout and Data Structures

## Definition

A filesystem lays out disk regions in a fixed order: **superblock** (metadata about the filesystem), **inode bitmap** (tracks which inodes are in-use), **data bitmap** (tracks which data blocks are in-use), **inode table** (array of inodes), and **data blocks** (user data and directory contents). Efficient implementation requires careful disk layout design to minimize seeks.

## When to use

- **Understanding filesystem boot**: How the kernel reads the superblock to initialize the filesystem.
- **Analyzing I/O patterns**: Why reading/writing a file requires multiple metadata block accesses.
- **Disk layout visualization**: Understanding the spatial arrangement of inodes and data.
- **Free space management**: How bitmaps track allocation and prevent reuse of in-use blocks.

## Key ideas

### Disk Region Layout

```
┌─────────────────────────────────────────────────────┐
│ Block 0: Superblock                                 │
├─────────────────────────────────────────────────────┤
│ Block 1: Inode Bitmap (which inodes are in-use)    │
├─────────────────────────────────────────────────────┤
│ Block 2: Data Bitmap (which blocks are in-use)     │
├─────────────────────────────────────────────────────┤
│ Blocks 3-7: Inode Table (256-byte inodes, 4 KB = 16 inodes/block) │
├─────────────────────────────────────────────────────┤
│ Blocks 8+: Data Region (user files, directories)   │
└─────────────────────────────────────────────────────┘
```

**Example**: 64-block filesystem (256 KB total), 4 KB blocks.

| Region | Blocks | Purpose |
|---|---|---|
| Superblock | 0 | Metadata (num inodes, num blocks, size, etc.) |
| Inode Bitmap | 1 | 1 bit per inode; 0 = free, 1 = in-use |
| Data Bitmap | 2 | 1 bit per data block; 0 = free, 1 = in-use |
| Inode Table | 3-7 | 256-byte inodes; 16 per block → 80 inodes max |
| Data Blocks | 8-63 | User files and directory contents |

### Superblock Structure

The superblock contains global filesystem metadata:

```c
struct superblock {
    uint32_t num_inodes;        // Total inodes available
    uint32_t num_blocks;        // Total blocks available
    uint32_t block_size;        // Size of each block (e.g., 4096)
    uint32_t inode_size;        // Size of each inode (e.g., 256)
    uint32_t inodes_per_block;  // num_blocks / inode_size / block_size
    uint32_t inode_table_start; // Block address of inode table
    uint32_t data_region_start; // Block address of data region
    // ... more fields
};
```

When mounting a filesystem, the kernel reads block 0 and loads this metadata.

### Bitmaps

**Inode Bitmap**: One bit per inode.
- Bit 0 = inode 0 status
- Bit 1 = inode 1 status
- Etc.

```
Inode Bitmap Block:
Byte 0: 11010110  (inodes 0-7: 0,1,3,5,6,7 are in-use; 2,4 are free)
Byte 1: 10000001  (inodes 8-15: 8,15 are in-use; 9-14 are free)
```

**Data Bitmap**: One bit per data block.
```
Data Bitmap Block:
Byte 0: 11111111  (blocks 0-7: all in-use)
Byte 1: 00001111  (blocks 8-15: blocks 8-11 are in-use; 12-15 are free)
```

### Allocation

To allocate an inode:
1. Read the inode bitmap block.
2. Find the first 0 bit.
3. Set that bit to 1.
4. Write the bitmap back to disk.
5. Zero out the inode and write it to disk.

To allocate a data block:
1. Read the data bitmap block.
2. Find the first 0 bit.
3. Set that bit to 1.
4. Write the bitmap back to disk.

### Directory as a File

Directories are regular files with a special format. The file's data blocks contain:

```
struct directory_entry {
    uint32_t ino;        // Inode number of the entry
    uint16_t reclen;     // Record length
    uint8_t namelen;     // Length of filename
    char name[reclen - 8]; // Filename (variable length)
};
```

A directory "file" is just a sequence of these entries. The OS reads the directory's data blocks to list entries.

## Pseudocode

### Reading Superblock (Mount)

```c
int mount_filesystem(char* device) {
    // Read block 0
    byte* superblock_data = disk_read(0);
    struct superblock* sb = (struct superblock*) superblock_data;
    
    // Validate
    if (sb->num_inodes <= 0 || sb->num_blocks <= 0) {
        return -1;  // Invalid filesystem
    }
    
    // Cache metadata
    fs_context.num_inodes = sb->num_inodes;
    fs_context.num_blocks = sb->num_blocks;
    fs_context.inode_table_start = sb->inode_table_start;
    fs_context.data_region_start = sb->data_region_start;
    
    return 0;
}
```

### Allocating an Inode

```c
uint32_t allocate_inode() {
    // Read inode bitmap
    byte* bitmap = disk_read(INODE_BITMAP_BLOCK);
    
    // Find first free inode
    for (int i = 0; i < num_inodes; i++) {
        int byte_idx = i / 8;
        int bit_idx = i % 8;
        
        if (!(bitmap[byte_idx] & (1 << bit_idx))) {  // Bit is 0
            // Mark as in-use
            bitmap[byte_idx] |= (1 << bit_idx);
            disk_write(INODE_BITMAP_BLOCK, bitmap);
            
            // Zero out inode
            struct inode* new_inode = load_inode(i);
            memset(new_inode, 0, sizeof(struct inode));
            disk_write_inode(i, new_inode);
            
            return i;
        }
    }
    
    return -1;  // No free inodes
}
```

## Hand-trace example

### 64-Block Filesystem Layout Diagram

```
Disk Layout:

Block 0:   [Superblock]
           {num_inodes: 80, num_blocks: 64, block_size: 4096,
            inode_table_start: 3, data_region_start: 8}

Block 1:   [Inode Bitmap]
           Byte 0: 11111111 (inodes 0-7 in-use)
           Byte 1: 11111111 (inodes 8-15 in-use)
           ... (rest zeros for free inodes 16-79)

Block 2:   [Data Bitmap]
           Byte 0: 11111111 (blocks 0-7 in-use)
           Byte 1: 11111111 (blocks 8-15 in-use)
           Byte 2: 00000111 (blocks 16-18 in-use; 19+ free)

Blocks 3-7: [Inode Table]
           16 inodes per block × 5 blocks = 80 inodes
           Inode 0 at block 3, offset 0
           Inode 16 at block 4, offset 0
           ...

Blocks 8-63: [Data Region]
           56 blocks for user files and directories
           (4 in-use in bitmap: blocks 0-18 = in-use; rest free)
```

### File Creation Trace: `create("/foo")`

| Step | Action | Disk Writes | I/O Count |
|---|---|---|---|
| 1 | Read root inode (inode 2, block 3) | None (cached) | Read 1 |
| 2 | Read root directory data (block 8) | None (cached) | Read 1 |
| 3 | Search for "foo" in root | (found in dir block 8) | — |
| 4 | Allocate new inode for "foo" | Read inode bitmap (block 1) | Read 1 |
| 5 | Find free inode (say, inode 5) | Write inode bitmap, set bit 5 | Write 1 |
| 6 | Zero out new inode | Write inode 5 (block 3) | Write 1 |
| 7 | Add directory entry to root | Update root's dir data (block 8) | Write 1 |
| 8 | Update root inode metadata | Write root inode (block 3) | Write 1 |
| **Total** | | | 5 reads, 5 writes |

### Bitmap Bit Manipulations

Allocate inode 5 (byte 0, bit 5):
```
Before: 00010000  (only bit 4 set)
Operation: |= (1 << 5)
After:  00110000  (bits 4 and 5 set)
```

Deallocate (free) inode 4 (byte 0, bit 4):
```
Before: 00110000  (bits 4 and 5 set)
Operation: &= ~(1 << 4)
After:  00100000  (only bit 5 set)
```

## Common exam questions

1. In a filesystem with superblock at block 0, inode bitmap at block 1, data bitmap at block 2, and inode table starting at block 3, where is inode 20 located?
2. Why are bitmaps more efficient than linked lists for tracking free space?
3. To create a file, how many disk I/Os are minimally required (assuming metadata is cached)?
4. If the inode bitmap is corrupted, can the filesystem still boot? Can it still function?
5. Why are directories stored as files with a special format, rather than as a separate data structure?
6. How many inodes can fit in a 4 KB block if each inode is 256 bytes?
7. When allocating a new data block, which bitmap must be consulted and updated?

## Gotchas

- **Bitmap atomicity**: Setting a bit in the bitmap and writing it back is not atomic. A crash in between leaves the filesystem inconsistent (allocated block not yet used, or used block not marked as allocated). This is a major motivation for journaling.
- **Superblock backup copies**: Real filesystems store multiple copies of the superblock at different locations (e.g., blocks 0, 100, 200) to recover from superblock corruption.
- **Directory block exhaustion**: If a directory's data blocks are full, allocating a new entry requires allocating a new data block and updating the directory inode. Multiple I/Os.
- **Inode table size**: The inode table is fixed-size at format time. You cannot increase the max number of inodes after creation.
- **Free space fragmentation**: Over time, the data region becomes fragmented. Finding contiguous free blocks becomes harder, increasing seek distances.

## Sources

- lectures__Week13_1.txt: Disk layout (superblock, inode bitmap, data bitmap, inode table, data region), inode table (256-byte inodes, 16 per 4 KB block), data bitmap and inode bitmap for tracking allocation, creating file requires reading root inode, directory data, allocating new inode (bitmap + write), writing directory entry, updating parent inode metadata.
