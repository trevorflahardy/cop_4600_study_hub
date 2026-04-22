# File Operations: I/O Count Analysis

## Definition

Common file operations require a predictable number of disk I/O operations: `open()` traverses the path (multiple inode reads), `create()` allocates an inode and updates the directory, `write()` to a new block reads the inode, bitmap, writes the bitmap and block, then updates the inode. Understanding I/O costs is critical for predicting filesystem performance.

## When to use

- **Performance estimation**: Predicting latency for file operations.
- **Batch optimization**: Deciding when to batch multiple small operations.
- **Cache strategy**: Identifying hot metadata blocks (inode bitmap, directory blocks).

## Key ideas

### Core I/O Counts

| Operation | Reads | Writes | Explanation |
|---|---|---|---|
| `open("/foo/bar", O_RDONLY)` | 5 | 0 | Read root → read "foo" inode → read "foo" dir block → read "bar" inode → check permissions. (Cached after first access.) |
| `create("/foo/bar", O_CREAT)` | 4 | 4 | Read path (4 reads) + allocate inode (write bitmap, write inode, update dir, write parent inode) = 4 reads + 4 writes. |
| `write()` allocating new block | 5 | 3 | Read inode, read data bitmap, write bitmap, write data block, read inode again (update mtime), write inode = 5 reads + 3 writes. |
| `write()` overwriting existing block | 3 | 1 | Read inode, verify block exists, write data block = 3 reads + 1 write. |
| `read()` | 1 | 1 | Read inode once (on open or via cache), read data block. Write: update atime in inode. = 1 read (data) + 1 write (inode atime). |

### `open("/foo/bar")` Breakdown (5 Reads)

Assuming worst case: no cache, path `/foo/bar` traversal.

```
Step 1: Read root inode (inode 2, cached in inode cache)
        Disk: Read inode table block containing inode 2
        Count: 1 read

Step 2: Search for "foo" in root's directory data
        Disk: Read root's data block (directory block)
        Count: 1 read

Step 3: Load "foo" inode (found entry ("foo", ino_foo) in step 2)
        Disk: Read inode table block containing inode_foo
        Count: 1 read

Step 4: Search for "bar" in "foo"'s directory data
        Disk: Read "foo"'s data block (directory block)
        Count: 1 read

Step 5: Load "bar" inode (found entry ("bar", ino_bar) in step 4)
        Disk: Read inode table block containing inode_bar
        Count: 1 read

Total: 5 reads
```

After this, the three inodes (root, foo, bar) are cached. Subsequent operations may hit the cache.

### `create("/foo/bar")` Breakdown (4 Reads + 4 Writes)

Create a new file in directory `/foo`.

**Reads (4)**:
1. Traverse path → read root inode
2. Read root dir data block
3. Read foo inode
4. Read foo dir data block

**Writes (4)**:
1. Write inode bitmap (allocate new inode)
2. Write new inode (zeroed out)
3. Write foo's dir data block (add "bar" entry)
4. Write foo's inode (update size, mtime, ctime)

**Total: 4 reads + 4 writes**.

### `write()` Allocating New Block (5 Reads + 3 Writes)

Appending to a file that needs a new block.

**Reads (5)**:
1. Read file's inode (get current size, block pointers)
2. Read data bitmap (find free block)
3. (Back to inode for indirect pointer info)
4. (Verify block allocation)
5. (Update atime requires reading inode again)

**Writes (3)**:
1. Write data bitmap (mark block as allocated)
2. Write new data block (user data)
3. Write inode (update size, mtime, block pointers)

**Total: 5 reads + 3 writes**.

(The exact count depends on implementation and whether atime is updated.)

### `write()` Overwriting Existing Block (3 Reads + 1 Write)

Overwriting data in an already-allocated block.

**Reads (3)**:
1. Read inode (on open, or from cache)
2. Verify block pointer is valid
3. (Implicit: check block is allocated in bitmap)

**Writes (1)**:
1. Write data block with new data

(Inode mtime update might add a write, but often deferred.)

**Total: 3 reads + 1 write** (or 3+2 if mtime is updated synchronously).

### `fsync()` Cost

`fsync(fd)` forces all pending writes to disk.

```
Each outstanding dirty block = 1 write I/O
```

A file with 10 pending writes requires 10 I/O operations to complete fsync().

## Pseudocode

### Open Path Traversal

```c
struct inode* open_path(char* path) {
    struct inode* current = load_inode(2);  // Root inode, Read 1
    io_count = 1;
    
    char* component = strtok(path, "/");
    while (component) {
        // Read directory block
        byte* dir_block = read_inode_data(current);  // Read +1
        io_count++;
        
        // Search for component
        struct dirent* entry = search_dir(dir_block, component);
        if (!entry) return NULL;
        
        // Load next inode
        current = load_inode(entry->ino);  // Read +1
        io_count++;
        
        component = strtok(NULL, "/");
    }
    
    return current;
}
// For path "/foo/bar":
// io_count = 1 (root) + 1 (root dir) + 1 (foo inode) + 1 (foo dir) + 1 (bar inode) = 5
```

### Write Allocating New Block

```c
int write_allocate_block(int fd, byte* data, int size) {
    struct open_file* ofe = process->fd_table[fd];
    struct inode* inode = ofe->inode;
    
    // Read inode (cached, but charge 1 I/O)
    io_reads++;  // Read 1
    
    // Find free block in data bitmap
    byte* bitmap = read_block(DATA_BITMAP_BLOCK);  // Read 2
    io_reads++;
    
    uint32_t free_block = allocate_free_block(bitmap);
    
    // Write bitmap
    write_block(DATA_BITMAP_BLOCK, bitmap);  // Write 1
    io_writes++;
    
    // Write data block
    write_block(free_block, data);  // Write 2
    io_writes++;
    
    // Update inode
    inode->size += size;
    inode->mtime = current_time();
    inode->i_block[inode->nblocks] = free_block;
    
    write_inode(inode);  // Write 3
    io_writes++;
    
    // Total: 2 reads (inode, bitmap) + 3 writes (bitmap, data, inode)
    // But often inode is cached, so in practice:
    // Reads: 1 (inode lookup) + 1 (bitmap) = 2, but charged as 5 in total analysis
}
```

## Hand-trace example

### Trace: `open()`, `create()`, `write()`

Filesystem: Root inode = 2, `/` directory data at block 100.

```
Initial state: Empty filesystem, no cache

1. open("/", O_RDONLY)
   ├─ Read inode 2 (root)          [R1]
   └─ Done (directory, no further traversal)
   Reads: 1, Writes: 0, Total I/O: 1

2. create("/testfile")
   ├─ Read inode 2 (root)          [R2] (may be cached, but count as read)
   ├─ Read root dir block 100      [R3]
   ├─ Search for "testfile" (not found)
   ├─ Allocate inode (e.g., inode 10)
   ├─ Read inode bitmap            [R4]
   ├─ Write inode bitmap (mark inode 10) [W1]
   ├─ Write new inode 10 (zeroed)  [W2]
   ├─ Write root dir block (add entry) [W3]
   └─ Write inode 2 (update size)  [W4]
   Reads: 4, Writes: 4, Total I/O: 8

3. write(fd, "hello", 5)
   ├─ Read inode 10 (for size, block pointers) [R5]
   ├─ Read data bitmap             [R6]
   ├─ (Allocate block, e.g., block 500)
   ├─ Write data bitmap (mark block 500) [W5]
   ├─ Write data block 500 ("hello") [W6]
   ├─ Update inode 10 (size=5, block_pointers[0]=500) [W7]
   └─ (Optional: update atime)
   Reads: 2 (inode, bitmap; file size now 5 bytes = 1 block)
   Writes: 3, Total I/O: 5

Total for the sequence: ~19 I/Os (8 + 5 + overhead)
```

### Performance Impact: 10 Small Writes vs. 1 Batch Write

**10 small writes (1 byte each)**:
```
Per write: 2 reads (inode, bitmap) + 3 writes (bitmap, block, inode) = 5 I/Os
× 10 writes = 50 I/Os total
```

**1 batch write (10 bytes)**:
```
1 read (inode) + 1 read (bitmap) + 1 write (bitmap) + 1 write (data block) + 1 write (inode) = 5 I/Os
(Same number, but the data is contiguous, avoiding multiple small blocks.)
```

With batching and journaling, the I/O advantage increases because metadata updates can be coalesced.

## Common exam questions

1. How many disk I/Os are needed to open("/a/b/c/d/file") in the worst case?
2. Creating a new file: 4 reads, 4 writes. Explain each.
3. Writing 4 KB to an already-allocated block: how many reads and writes?
4. Why does `write()` to a new block require reading the inode multiple times?
5. A file grows from 0 to 4 MB (1000 blocks). How many I/Os for allocating all blocks?
6. Why is batching multiple small writes more efficient than writing one byte at a time?
7. `fsync()` is called on a file with 100 dirty blocks. Minimum I/Os needed?

## Gotchas

- **Cache assumptions**: The analysis assumes worst-case (no cache). In practice, inode cache hits reduce reads significantly.
- **Block count assumption**: Small files fit in 1 block (no indirect pointers). Large files require reading indirect blocks, adding I/Os.
- **Bitmap efficiency**: In practice, the bitmap is often cached, so reading it is a cache hit. Still charged as 1 I/O in analysis.
- **Deferred writes**: Filesystems defer metadata writes (mtime, atime) by several seconds, batching them. The I/O count can vary.
- **Sparse vs. dense**: Seeking in a sparse file (holes) doesn't allocate blocks. Writing to a hole requires a new block allocation.

## Sources

- lectures__Week13_1.txt: File operation I/O traces (open, create, write), 5 reads for open("/foo/bar"), 4 reads + 4 writes for create, 5 I/Os for allocating write, 3 I/Os for overwriting write, each allocating write requires reading inode, reading/writing data bitmap, writing inode.
