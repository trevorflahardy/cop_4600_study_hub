# File Descriptor, Open File, and Inode Tables: Three-Level Indirection

## Definition

The OS maintains three separate tables to manage open files: a **per-process file descriptor table** (small integers 0-1023), a **system-wide open file table** (offset, flags, reference count), and the **in-memory inode cache**. This three-level indirection allows multiple processes to share the same file, and multiple file descriptors to refer to the same open file (e.g., via `dup()`).

## When to use

- **Understanding `dup()` and `dup2()`**: Multiple file descriptors can share the same open file entry and offset.
- **File descriptor inheritance**: Child processes inherit parent's file descriptors (same open file table entries).
- **Understanding file offset**: Separate processes opening the same file have independent offsets.
- **Debugging I/O issues**: Understanding which table stores what (flags, offset, permissions).

## Key ideas

### Three-Level Indirection Model

```
Per-Process FD Table          System-Wide Open File Table      In-Memory Inode Cache
(process 1)
+-----------+                +------------------+              +----------+
| fd 0 → 1  |                | offset: 100      |              | inode 5  |
| fd 1 → 3  |                | flags: O_RDONLY  |              | size: 8K |
| fd 2 → 5  |                | ref_count: 2     |              | data ptr |
+-----------+                +------------------+              +----------+
                             | offset: 0        |
                             | flags: O_WRONLY  |
                             | ref_count: 1     |
                             +------------------+

(process 2)
+-----------+                | offset: 512      |
| fd 0 → 2  |                | flags: O_RDWR    |
| fd 1 → 4  |                | ref_count: 1     |
+-----------+                +------------------+
```

### Level 1: File Descriptor Table (Per-Process)

Each process has a small array (typically 1024 entries) mapping small integers (0-1023) to open file table entries.

```c
struct file_descriptor_table {
    struct open_file* entries[1024];  // NULL if closed, pointer if open
};
```

**Standard descriptors**:
- 0 = stdin
- 1 = stdout
- 2 = stderr

**Scope**: Process-specific. Closing fd 3 in process A doesn't affect process B's fd 3.

### Level 2: Open File Table Entry (System-Wide)

A global kernel table tracking the state of each open file. Multiple processes can refer to the same entry.

```c
struct open_file {
    struct inode* inode;         // In-memory inode (Level 3)
    int flags;                   // O_RDONLY, O_WRONLY, O_RDWR, O_APPEND, etc.
    off_t offset;                // Current read/write position
    int ref_count;               // Number of file descriptors pointing here
};
```

**Key insight**: The **offset is stored here**, not in the inode. So:
- Two processes can open the same file independently, each with its own offset.
- But `dup(fd)` creates a new FD entry pointing to the same open file entry, so both FDs share the same offset.

### Level 3: In-Memory Inode Cache

The OS caches inodes in memory for fast access. The inode contains permanent file metadata.

```c
struct inode {
    uint32_t ino;               // Inode number
    uint16_t mode;              // Permissions + file type
    uint16_t nlink;             // Hard link count
    uint32_t size;              // File size in bytes
    uint32_t uid, gid;          // Owner
    uint32_t atime, mtime, ctime; // Timestamps
    uint32_t block_pointers[15]; // Data block addresses
    // ... more fields
};
```

An inode in memory can be referenced by multiple open file entries.

## Pseudocode

### Opening a File (Simplified)

```c
int open(char* path, int flags) {
    // 1. Find inode for path
    struct inode* inode = path_to_inode(path);
    if (!inode) return -1;
    
    // 2. Create open file table entry
    struct open_file* ofe = malloc(sizeof(struct open_file));
    ofe->inode = inode;
    ofe->flags = flags;
    ofe->offset = (flags & O_APPEND) ? inode->size : 0;  // Append mode
    ofe->ref_count = 1;
    
    // Add to system-wide open file table
    int ofe_index = add_to_open_file_table(ofe);
    
    // 3. Find free FD in process's FD table
    int fd = find_free_fd();
    process->fd_table[fd] = ofe;
    
    return fd;
}
```

### `dup()` - Duplicate FD (Share Offset)

```c
int dup(int oldfd) {
    struct open_file* ofe = process->fd_table[oldfd];
    
    // Find new FD in same process
    int newfd = find_free_fd();
    
    // Both FDs point to same open file entry
    process->fd_table[newfd] = ofe;
    
    // Increment reference count
    ofe->ref_count++;
    
    return newfd;
}
```

**Effect**: Both `oldfd` and `newfd` refer to the same open file entry. `read()` on one advances the offset for both.

### `read()` - Read with Offset

```c
int read(int fd, void* buf, int count) {
    struct open_file* ofe = process->fd_table[fd];
    struct inode* inode = ofe->inode;
    
    // Check bounds
    if (ofe->offset >= inode->size) return 0;  // EOF
    
    // Read data from inode's blocks
    int bytes_read = 0;
    while (count > 0 && ofe->offset < inode->size) {
        // Find block for offset
        uint32_t block_num = ofe->offset / BLOCK_SIZE;
        uint32_t block_addr = inode->block_pointers[block_num];
        
        // Read block and copy to buf
        byte* block_data = read_block(block_addr);
        int offset_in_block = ofe->offset % BLOCK_SIZE;
        int to_copy = min(count, BLOCK_SIZE - offset_in_block);
        memcpy(buf, block_data + offset_in_block, to_copy);
        
        // Advance
        buf += to_copy;
        count -= to_copy;
        ofe->offset += to_copy;
        bytes_read += to_copy;
    }
    
    return bytes_read;
}
```

### Closing a FD

```c
int close(int fd) {
    struct open_file* ofe = process->fd_table[fd];
    
    // Decrement reference count
    ofe->ref_count--;
    
    // If no more references, free the open file entry
    if (ofe->ref_count == 0) {
        // If file was marked for deletion, reclaim inode
        if (ofe->inode->nlink == 0) {
            free_inode(ofe->inode);
        }
        free(ofe);
    }
    
    // Clear FD table entry
    process->fd_table[fd] = NULL;
    
    return 0;
}
```

## Hand-trace example

### `dup()` Example

```c
int fd1 = open("file.txt", O_RDONLY);  // fd1 = 3
read(fd1, buf, 100);                    // offset in OFE = 100
int fd2 = dup(fd1);                     // fd2 = 4
read(fd2, buf, 50);                     // offset in OFE = 150 (same!)
// Both fd1 and fd2 see offset 150 because they share the OFE
```

| After | fd 3 Points To | fd 4 Points To | OFE Offset | ref_count |
|---|---|---|---|---|
| `open()` | OFE[5] | — | 0 | 1 |
| `read(fd1, 100)` | OFE[5] | — | 100 | 1 |
| `dup(fd1)` | OFE[5] | OFE[5] | 100 | 2 |
| `read(fd2, 50)` | OFE[5] | OFE[5] | 150 | 2 |
| `close(fd1)` | — | OFE[5] | 150 | 1 |
| `close(fd2)` | — | — | — (freed) | 0 |

### Two Processes Opening Same File

```c
// Process A
int fdA = open("file.txt", O_RDONLY);  // fdA = 3
read(fdA, buf, 100);                    // OFE_A offset = 100

// Process B (same file)
int fdB = open("file.txt", O_RDONLY);  // fdB = 3 (same FD number, different OFE)
read(fdB, buf, 50);                     // OFE_B offset = 50 (different OFE!)
```

| Process | FD | OFE | Offset | Inode |
|---|---|---|---|---|
| A | 3 | OFE_A | 100 | Inode 20 |
| B | 3 | OFE_B | 50 | Inode 20 |

Both processes share the same inode, but have independent offsets and open file entries.

## Common exam questions

- **MCQ:** Where is the current read/write offset of an open file stored?
  - [x] In the system-wide open file table entry
  - [ ] In the per-process file descriptor table
  - [ ] In the inode on disk
  - [ ] In the process's PCB only
  - why: Storing the offset in the OFE lets two processes have independent offsets for the same file while still letting dup()'d FDs share one offset.

- **MCQ:** Process A calls `open("foo")` and process B independently calls `open("foo")`. Which statement is true?
  - [x] Each gets its own open file table entry with its own offset, but both share the same inode
  - [ ] They share the same FD number and offset
  - [ ] They share one open file entry with ref_count=2
  - [ ] Only one of them succeeds
  - why: Independent `open()` calls allocate separate OFEs; the offset in each is advanced independently by reads/writes.

- **MCQ:** A process runs `fd1 = open("f")`, reads 100 bytes, then `fd2 = dup(fd1)` and reads 50 bytes from fd2. What is the offset seen through fd1 afterward?
  - [x] 150 bytes (fd1 and fd2 share the same OFE)
  - [ ] 100 bytes (fd1 still has its own offset)
  - [ ] 50 bytes (dup resets the offset)
  - [ ] 0 bytes
  - why: `dup()` creates a new FD pointing to the same OFE; reads through either FD advance the shared offset.

- **MCQ:** A process calls `dup(3)` twice. How many FD table entries now point at the OFE originally referenced by fd 3?
  - [x] 3
  - [ ] 2
  - [ ] 1
  - [ ] 4
  - why: The original plus two new FDs all reference the same OFE; the OFE's ref_count becomes 3.

- **MCQ:** When is a file's inode actually freed on disk?
  - [x] When nlink reaches 0 AND no open file descriptors still reference the inode
  - [ ] Immediately when `unlink()` is called
  - [ ] Only after the next reboot
  - [ ] Only if `fsync()` is called
  - why: Both the directory-entry count (nlink) and the in-memory reference count must hit zero; until then the inode lingers.

- **MCQ:** Which table is per-process rather than system-wide?
  - [x] The file descriptor table
  - [ ] The open file table
  - [ ] The in-memory inode cache
  - [ ] The superblock
  - why: FD numbers 0-1023 are private to each process; the OFE and inode cache are kernel-global.

- **MCQ:** Opening with O_APPEND sets what initial offset?
  - [x] The file's current size, so every write lands at end-of-file
  - [ ] 0
  - [ ] The previous OFE's offset
  - [ ] Undefined; writes may go anywhere
  - why: O_APPEND tells the kernel to position the offset at EOF so each write extends the file atomically.

## Gotchas

- **FD vs. OFE confusion**: FD numbers (0-1023) are per-process. OFE indices are system-wide. Don't conflate them.
- **Shared offset after `dup()`**: Many students forget that `dup()` creates a new FD pointing to the **same** OFE, so offsets are shared. This is different from opening the same file twice.
- **Close and inode survival**: Calling `close()` doesn't delete the file. The file is deleted only if `nlink==0` AND `ref_count==0` in all OFEs.
- **Offset in O_APPEND mode**: When opening with O_APPEND, the initial offset is set to the file size. Each write appends (not affected by prior reads).
- **Standard FDs**: stdin/stdout/stderr (0/1/2) are opened by the kernel and inherited by every process. Redirecting them changes which files FDs 0/1/2 point to.

## Sources

- lectures__Week12_2.txt: Three-level indirection (per-process FD table → system-wide open file table with offset/flags → in-memory inode cache), `dup()` sharing offset, file descriptor semantics, 4 KB block size, inode references.
