# Inodes: On-Disk Structure and Calculation

## Definition

An **inode** (index node) is the on-disk data structure storing all metadata about a file or directory: ownership, permissions, size, timestamps, link count, and pointers to data blocks. Each inode is 256 bytes, uniquely identified by an inode number within a filesystem. The inode number is computed from the inode's position in the inode table on disk.

## When to use

- **Understanding file metadata**: Size, owner, permissions, timestamps, hard link count.
- **Inode allocation**: Computing disk location of an inode given its number.
- **File operations**: How metadata is read/written during open, read, write, stat.
- **Disk layout**: Where inodes are stored relative to data blocks.

## Key ideas

### On-Disk Inode Structure (EXT2 Format)

Each inode is 256 bytes and contains:

```c
struct inode {
    uint16_t i_mode;              // 2 B: File type + permissions (rwxrwxrwx)
    uint16_t i_uid;               // 2 B: Owner user ID
    uint32_t i_size;              // 4 B: File size in bytes
    uint32_t i_atime;             // 4 B: Last access time (unix timestamp)
    uint32_t i_ctime;             // 4 B: Creation/change time (unix timestamp)
    uint32_t i_mtime;             // 4 B: Last modification time
    uint32_t i_dtime;             // 4 B: Deletion time (0 if not deleted)
    uint16_t i_gid;               // 2 B: Owner group ID
    uint16_t i_links_count;       // 2 B: Hard link count (nlink)
    uint32_t i_blocks;            // 4 B: Number of 512-byte blocks allocated
    uint32_t i_flags;             // 4 B: Filesystem-specific flags
    uint32_t i_osd1;              // 4 B: OS-dependent field
    uint32_t i_block[15];          // 60 B: Block pointers (12 direct + 3 indirect)
    uint32_t i_generation;        // 4 B: File version (NFS)
    uint32_t i_file_acl;          // 4 B: Access control list
    uint32_t i_dir_acl;           // 4 B: Directory ACL
    uint32_t i_faddr;             // 4 B: Fragment address
    uint32_t i_osd2[3];           // 12 B: More OS-dependent fields
    // Total: 256 bytes
};
```

**Key fields**:
- **i_mode**: High 4 bits = file type (regular, directory, symlink, block device, etc.); low 12 bits = permissions (rwx rwx rwx).
- **i_links_count**: Decremented by `unlink()`. File deleted when nlink==0 and no open file descriptors.
- **i_block[15]**: First 15 entries are block pointers.
  - **i_block[0-11]**: Direct pointers (point to data blocks).
  - **i_block[12]**: Single indirect (points to a block containing 1024 pointers).
  - **i_block[13]**: Double indirect (points to a block containing 1024 indirect pointers).
  - **i_block[14]**: Triple indirect (points to a block containing 1024 double-indirect pointers).

### Inode Number to Disk Location

Given an inode number `ino`, compute its position in the inode table:

```
inode_offset = ino * sizeof(inode)      // Bytes from start of inode table
inode_block = inode_offset / block_size // Which block in inode table
inode_offset_in_block = inode_offset % block_size
```

**Example**: Inode 32, block size 4 KB, inode size 256 B.

```
inode_offset = 32 * 256 = 8192 bytes
inode_block = 8192 / 4096 = 2 (third block of inode table)
inode_offset_in_block = 8192 % 4096 = 0 (start of block 2)
```

### Inode Allocation Bitmap

The inode bitmap tracks which inodes are allocated (in-use). One bit per inode:
- 0 = free
- 1 = allocated

A 4 KB inode bitmap can track 32,768 inodes (4 KB * 8 bits/byte).

## Pseudocode

### Computing Inode Disk Address

```c
struct inode_location {
    uint32_t block_number;      // Block in inode table
    uint32_t offset_in_block;   // Byte offset within block
};

struct inode_location get_inode_location(uint32_t ino, uint32_t block_size) {
    struct inode_location loc;
    uint32_t inode_size = 256;
    uint32_t bytes_offset = ino * inode_size;
    
    loc.block_number = bytes_offset / block_size;
    loc.offset_in_block = bytes_offset % block_size;
    
    return loc;
}

// Usage:
// struct inode_location loc = get_inode_location(32, 4096);
// loc.block_number = 2, loc.offset_in_block = 0
```

### Loading an Inode

```c
struct inode* load_inode(uint32_t ino) {
    struct inode_location loc = get_inode_location(ino, 4096);
    
    // Read the block containing the inode
    byte* block_data = disk_read(inode_table_start + loc.block_number);
    
    // Extract inode from block
    struct inode* inode = (struct inode*) (block_data + loc.offset_in_block);
    
    return inode;
}
```

### Allocating a New Inode

```c
uint32_t allocate_inode() {
    // Find first free inode in bitmap
    byte* inode_bitmap = disk_read(INODE_BITMAP_BLOCK);
    
    for (int i = 0; i < num_inodes; i++) {
        int byte_idx = i / 8;
        int bit_idx = i % 8;
        
        if (!(inode_bitmap[byte_idx] & (1 << bit_idx))) {  // Bit is 0 (free)
            // Mark as allocated
            inode_bitmap[byte_idx] |= (1 << bit_idx);
            disk_write(INODE_BITMAP_BLOCK, inode_bitmap);
            
            // Zero out the inode
            struct inode* new_inode = load_inode(i);
            memset(new_inode, 0, sizeof(struct inode));
            disk_write_inode(i, new_inode);
            
            return i;  // Return inode number
        }
    }
    
    return -1;  // No free inodes
}
```

## Hand-trace example

### Inode Allocation and Layout

Given: Block size = 4 KB, inode size = 256 B, inode table starts at block 3.

**16 inodes per block**: 4096 B / 256 B = 16 inodes per block.

| Inode # | Block | Offset | Absolute Block Address |
|---|---|---|---|
| 0 | 3 | 0 | 3 |
| 1 | 3 | 256 | 3 |
| ... | ... | ... | ... |
| 15 | 3 | 3840 | 3 |
| 16 | 4 | 0 | 4 |
| 17 | 4 | 256 | 4 |
| ... | ... | ... | ... |
| 31 | 4 | 3840 | 4 |
| 32 | 5 | 0 | 5 |

**Formula**:
```
block_in_inode_table = ino / 16
offset_in_block = (ino % 16) * 256
absolute_block = 3 + block_in_inode_table
```

### Example: Locating Inode 67

```
ino = 67
block_in_inode_table = 67 / 16 = 4 (blocks 3, 4 are first 32 inodes; block 7 has inode 67)
offset_in_block = (67 % 16) * 256 = 3 * 256 = 768 bytes
absolute_block = 3 + 4 = 7

Disk location: block 7, offset 768
```

### Inode Structure Example

Inode 20 (regular file, 4 KB, owned by user 1000):

```
i_mode:       0x81A4  (33188 = regular file, rwxr--r--, 0644 octal)
i_uid:        1000    (user 1000)
i_size:       4096    (4 KB file)
i_atime:      1620000000
i_mtime:      1620000000
i_ctime:      1620000000
i_dtime:      0       (not deleted)
i_gid:        1000    (group 1000)
i_links_count: 1      (one hard link)
i_blocks:     8       (8 * 512 = 4096 bytes allocated)
i_block[0]:   100     (first data block is block 100)
i_block[1-11]: 0      (rest are unused)
i_block[12-14]: 0     (no indirect blocks needed for 4 KB)
```

### File Size to Data Block Count

Given i_size, how many data blocks are allocated?

```
i_blocks = ceil(i_size / 512)

For a 4 KB (4096 B) file:
i_blocks = ceil(4096 / 512) = 8 blocks (512 B each)

For a 8 KB file:
i_blocks = ceil(8192 / 512) = 16 blocks

For a 3 KB file:
i_blocks = ceil(3072 / 512) = 6 blocks
```

Note: `i_blocks` counts 512-byte blocks, not filesystem blocks (4 KB).

## Common exam questions

1. If an inode is 256 bytes and a block is 4 KB, how many inodes fit in one block?
2. Inode 100, block size 4 KB, inode table starts at block 10. Where on disk is inode 100?
3. The i_block array has 15 entries. Which are direct pointers, which are indirect, which are double-indirect?
4. A file has i_size = 10,000 bytes. How many entries in i_block[0-11] are needed?
5. What does i_links_count represent? When is it decremented?
6. If i_links_count = 2, can the file be deleted with one `unlink()` call?
7. A file has i_blocks = 16. What is its approximate size?

## Gotchas

- **i_blocks in 512-byte units**: Many students forget that i_blocks counts 512-byte sectors, not filesystem blocks. A 4 KB file has i_blocks=8, not i_blocks=1.
- **Inode numbering starts at 0 (or 1)**: The root inode is typically inode 2. Inodes 0 and 1 are reserved. Some filesystems use 1-based numbering.
- **Direct pointers only**: For small files (<12 blocks = 48 KB), only i_block[0-11] are used. No indirect blocks needed.
- **Allocation and deallocation**: The inode bitmap tracks allocation, but freeing requires also updating i_links_count and possibly the data bitmap.
- **Hard link count**: Creating a hard link increments i_links_count. The inode and data blocks persist as long as i_links_count > 0.

## Sources

- lectures__Week13_1.txt: Inode structure, mode/uid/size/timestamps/nlink/blocks fields, 256-byte inodes, 16 per 4 KB block, inode table layout, inode number to disk location, multi-level index pointers (12 direct + 1 single indirect + 1 double indirect), 4 KB block size.
