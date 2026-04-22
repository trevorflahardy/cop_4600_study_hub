# Inode Multi-Level Index: Direct, Indirect, Double-Indirect Pointers

## Definition

An inode supports three types of block pointers to accommodate files of varying sizes: **direct pointers** (point directly to data blocks), **single indirect pointers** (point to a block containing more pointers), and **double indirect pointers** (point to a block containing indirect pointers). This allows files to grow from small (kilobytes) to enormous (terabytes) without wasting space in small inodes.

## When to use

- **Understanding file size limits**: Maximum file size achievable with direct + single + double indirect pointers.
- **Block access calculation**: Given a file offset, determine how many pointer dereferences are needed.
- **Inode space efficiency**: Explaining why 12 direct + 1 indirect + 1 double-indirect is a good design.

## Key ideas

### Pointer Layout in Inode

The inode's i_block[15] array is organized as:

```
i_block[0-11]  : 12 direct pointers (point to data blocks)
i_block[12]    : 1 single indirect pointer (points to a block of pointers)
i_block[13]    : 1 double indirect pointer (points to a block of indirect blocks)
i_block[14]    : 1 triple indirect pointer (points to a block of double-indirect blocks)
```

### Direct Pointers (i_block[0-11])

Each entry points directly to a data block. With 12 direct pointers and 4 KB blocks:

```
Direct pointers support: 12 × 4 KB = 48 KB
```

Small files use only i_block[0-11]; no indirection needed.

### Single Indirect Pointer (i_block[12])

Points to an **indirect block**: a 4 KB block containing pointers to data blocks.

With 4-byte pointers: 4 KB / 4 B = 1024 pointers.

```
Single indirect supports: 1024 × 4 KB = 4 MB

Total with 12 direct + 1 indirect:
12 × 4 KB + 1024 × 4 KB = 48 KB + 4 MB ≈ 4.048 MB
```

### Double Indirect Pointer (i_block[13])

Points to a **double-indirect block**: a 4 KB block containing 1024 pointers to indirect blocks.

Each indirect block points to 1024 data blocks.

```
Double indirect supports: 1024 × 1024 × 4 KB = 1024² × 4 KB ≈ 4 GB

Total with 12 direct + 1 indirect + 1 double indirect:
12 × 4 KB + 1024 × 4 KB + 1024² × 4 KB ≈ 4 GB + change
```

### Triple Indirect (Not Commonly Used)

Points to a **triple-indirect block**: 1024 pointers to double-indirect blocks.

```
Triple indirect supports: 1024 × 1024 × 1024 × 4 KB ≈ 4 TB
```

Most filesystems stop at double-indirect. Triple-indirect is rarely needed and adds complexity.

### File Size Limits

| Configuration | Max Size |
|---|---|
| 12 direct only | 48 KB |
| 12 direct + 1 indirect | 4,048 KB ≈ 4 MB |
| 12 direct + 1 indirect + 1 double | 4 GB + 4 MB ≈ 4 GB |
| 12 direct + 1 indirect + 1 double + 1 triple | ≈ 4 TB |

## Pseudocode

### Finding Block Address for File Offset

```c
uint32_t get_block_for_offset(struct inode* inode, uint32_t offset) {
    uint32_t block_size = 4096;
    uint32_t logical_block = offset / block_size;  // Which logical block?
    
    // Case 1: Direct pointers (blocks 0-11)
    if (logical_block < 12) {
        return inode->i_block[logical_block];
    }
    
    // Case 2: Single indirect (blocks 12 - 12+1023)
    logical_block -= 12;
    if (logical_block < 1024) {
        uint32_t indirect_block = inode->i_block[12];
        uint32_t* indirect_pointers = (uint32_t*) disk_read(indirect_block);
        return indirect_pointers[logical_block];
    }
    
    // Case 3: Double indirect (blocks 12+1024 - 12+1024+1024²-1)
    logical_block -= 1024;
    if (logical_block < 1024 * 1024) {
        uint32_t double_block = inode->i_block[13];
        uint32_t* double_pointers = (uint32_t*) disk_read(double_block);
        
        uint32_t indirect_block_idx = logical_block / 1024;
        uint32_t pointer_idx = logical_block % 1024;
        
        uint32_t indirect_block = double_pointers[indirect_block_idx];
        uint32_t* indirect_pointers = (uint32_t*) disk_read(indirect_block);
        
        return indirect_pointers[pointer_idx];
    }
    
    // Out of range
    return 0;  // Error
}
```

### Allocating a Block for Growing File

```c
void allocate_block_for_offset(struct inode* inode, uint32_t offset) {
    uint32_t logical_block = offset / 4096;
    uint32_t data_block = allocate_free_block();  // From data bitmap
    
    if (logical_block < 12) {
        // Direct pointer
        inode->i_block[logical_block] = data_block;
    } else if (logical_block < 12 + 1024) {
        // Single indirect
        uint32_t logical_block_in_indirect = logical_block - 12;
        
        if (inode->i_block[12] == 0) {
            // Need to allocate indirect block first
            inode->i_block[12] = allocate_free_block();
        }
        
        uint32_t indirect_block = inode->i_block[12];
        uint32_t* indirect_pointers = (uint32_t*) disk_read(indirect_block);
        indirect_pointers[logical_block_in_indirect] = data_block;
        disk_write(indirect_block, indirect_pointers);
    } else if (logical_block < 12 + 1024 + 1024 * 1024) {
        // Double indirect
        uint32_t logical_block_in_double = logical_block - 12 - 1024;
        uint32_t indirect_block_idx = logical_block_in_double / 1024;
        uint32_t pointer_idx = logical_block_in_double % 1024;
        
        if (inode->i_block[13] == 0) {
            inode->i_block[13] = allocate_free_block();
        }
        
        uint32_t double_block = inode->i_block[13];
        uint32_t* double_pointers = (uint32_t*) disk_read(double_block);
        
        if (double_pointers[indirect_block_idx] == 0) {
            double_pointers[indirect_block_idx] = allocate_free_block();
            disk_write(double_block, double_pointers);
        }
        
        uint32_t indirect_block = double_pointers[indirect_block_idx];
        uint32_t* indirect_pointers = (uint32_t*) disk_read(indirect_block);
        indirect_pointers[pointer_idx] = data_block;
        disk_write(indirect_block, indirect_pointers);
    }
    
    inode->i_size = max(inode->i_size, offset);
    inode->i_blocks++;
}
```

## Hand-trace example

### File Size to Pointers Mapping

| File Size | Direct | Indirect Depth | Blocks Needed | I/O to Read Offset 100MB |
|---|---|---|---|---|
| 4 KB | i_block[0] | 0 | 1 data block | 1 read (direct) |
| 48 KB | i_block[0-11] | 0 | 12 data blocks | 1 read (direct) |
| 1 MB | i_block[0-11] + indirect[0-200] | 1 | 1 indirect + 250 data | 2 reads (indirect dereference) |
| 4 MB | i_block[0-11] + indirect[0-1023] | 1 | 1 indirect + 1024 data | 2 reads |
| 100 MB | double indirect | 2 | 1 double + 100 indirect + 25,600 data | 3 reads (double dereference) |
| 1 GB | double indirect | 2 | 1 double + 262,144 indirect + all data | 3 reads |

### Example: Reading Byte at Offset 1,000,000 (1 MB)

```
offset = 1,000,000 bytes
logical_block = 1,000,000 / 4096 = 244

Is 244 < 12? No.
Is 244 < 12 + 1024 = 1036? Yes.

Single indirect case:
  logical_block_in_indirect = 244 - 12 = 232
  
  Read i_block[12] (pointer to indirect block)
  Read indirect_block[232] (pointer to data block)
  Read data_block[...]
  
  Total: 3 disk I/Os (inode → indirect block → data block)
```

### Example: Reading Byte at Offset 100 MB (104,857,600)

```
offset = 104,857,600 bytes
logical_block = 104,857,600 / 4096 = 25,600

Is 25,600 < 12? No.
Is 25,600 < 1036? No.
Is 25,600 < 12 + 1024 + 1,048,576? Yes.

Double indirect case:
  logical_block_in_double = 25,600 - 1036 = 24,564
  indirect_block_idx = 24,564 / 1024 = 24
  pointer_idx = 24,564 % 1024 = 4
  
  Read i_block[13] (pointer to double-indirect block)
  Read double_indirect_block[24] (pointer to indirect block)
  Read indirect_block[4] (pointer to data block)
  Read data_block[...]
  
  Total: 4 disk I/Os
```

### Calculation Table: Max File Size

Given: Block size B = 4 KB, pointer size P = 4 B.

Pointers per block: 4 KB / 4 B = 1024 pointers per block.

| Pointers | Max Size | Calculation |
|---|---|---|
| 12 direct | 12 × 4 KB | 48 KB |
| 1 single indirect | 1024 × 4 KB | 4 MB |
| 1 double indirect | 1024 × 1024 × 4 KB | 4 GB |
| 1 triple indirect | 1024³ × 4 KB | 4 TB |
| **Total (12 + 1 + 1)** | **~4 GB** | 48 KB + 4 MB + 4 GB ≈ 4 GB |

## Common exam questions

1. A file is 10 MB. Which block pointers (direct/indirect/double) are in use in the inode?
2. How many disk I/Os are needed to read a byte at offset 100 KB? 100 MB? 1 GB?
3. Why is the design 12 direct + 1 indirect + 1 double-indirect instead of, say, 1 direct + 10 indirect?
4. If an inode has i_block[13] allocated (double-indirect), does that mean the file is > 4 MB?
5. How many pointers fit in a 4 KB indirect block (assuming 4-byte pointers)?
6. A double-indirect block points to 1024 indirect blocks. How many pointers can be accessed through one double-indirect block?
7. Explain why allocating a new block for a 10 MB file requires at most 4 disk reads + 4 writes (including indirect blocks).

## Gotchas

- **"Logical block" confusion**: Logical block 0 is offset 0-4095, block 1 is offset 4096-8191, etc. Don't confuse logical block numbers with offsets.
- **Indirect block overhead**: Creating a 1 MB file might require allocating an indirect block even if only a few kilobytes are used. The entire indirect block is allocated and written.
- **Pointer size**: If pointers are 8 bytes (64-bit), only 512 pointers fit per indirect block, halving the file size limit.
- **Sparse files**: If you seek to offset 100 GB and write 4 bytes, the inode can reference that block without allocating all intermediate blocks (holes in the file).
- **Triple-indirect rarity**: Most real filesystems support triple-indirect but rarely use it. Modern filesystems (ext4, btrfs) use extents or B-trees instead.

## Sources

- lectures__Week13_1.txt: Multi-level index (12 direct + 1 single indirect + 1 double indirect), each indirect block contains 1024 pointers, max file size (12 × 4KB + 1024 × 4KB + 1024² × 4KB ≈ 4 GB), pointer dereferencing for file access.
