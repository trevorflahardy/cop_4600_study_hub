# Files and Directories: Abstraction Layer

## Definition

A **file** is an opaque linear array of bytes identified by a user-readable name and a low-level inode number. A **directory** is a special file whose content is a list of (name, inode_number) pairs, mapping human-readable filenames to inodes. Both are accessed through a hierarchical namespace tree starting from the root directory.

## When to use

- **File abstraction**: Any persistent data storage (applications, user files, logs, databases).
- **Directory abstraction**: Organizing files into a hierarchy; path traversal (e.g., `/foo/bar/file.txt`).
- **Metadata**: Inspecting file properties (size, owner, permissions) via `stat()`.

## Key ideas

### File Abstraction

A file is opaque to the OS—the OS doesn't interpret the contents. The OS only:
1. Stores the bytes persistently.
2. Returns bytes in the same order.
3. Maintains metadata (owner, size, timestamps).

User calls:
```c
int fd = open("myfile", O_RDONLY);   // Open file; returns descriptor
read(fd, buf, 4096);                 // Read 4 KB from current offset
write(fd, buf, 4096);                // Write 4 KB; advances offset
lseek(fd, 1024, SEEK_SET);           // Jump to byte 1024
close(fd);                            // Close; kernel frees resources
```

### Directory Abstraction

A directory is also a file, but with a special format: a list of entries.

```
(entry_name, inode_number) pairs:
  (".", 10)       // Current directory itself (inode 10)
  ("..", 5)       // Parent directory (inode 5)
  ("foo", 12)     // File "foo" has inode 12
  ("bar", 13)     // File "bar" has inode 13
  ("subdir", 14)  // Subdirectory "subdir" has inode 14
```

When you list a directory, the OS reads its contents and prints the names.

### Directory Tree (Hierarchy)

```
/                        (root inode 2)
├── foo                  (inode 10)
│   ├── file1.txt       (inode 20)
│   └── file2.txt       (inode 21)
├── bar                  (inode 11)
│   ├── data.bin        (inode 30)
│   └── subdir          (inode 12)
│       └── file3.txt   (inode 31)
└── etc                  (inode 40)
    └── config          (inode 41)
```

Absolute path `/foo/bar/file.txt` → traverse root → find "foo" → find "bar" → find "file.txt".

### Inode as Identity

The **inode number** is the true identity of a file. The filename is just a human-readable alias. Two files with the same name in different directories have different inode numbers and are distinct files.

### The `stat` Struct

Returned by `stat(path, &sb)` or `fstat(fd, &sb)`:

```c
struct stat {
    ino_t st_ino;           // Inode number (real identity)
    mode_t st_mode;         // File type (regular, directory, symlink) + permissions
    nlink_t st_nlink;       // Hard link count (number of names pointing to this inode)
    uid_t st_uid;           // Owner user ID
    gid_t st_gid;           // Owner group ID
    off_t st_size;          // File size in bytes
    blksize_t st_blksize;   // Block size for filesystem I/O (typically 4096)
    blkcnt_t st_blocks;     // Number of blocks allocated
    time_t st_atime;        // Last access time
    time_t st_mtime;        // Last modification time
    time_t st_ctime;        // Last status change time
    dev_t st_dev;           // Device ID (which filesystem)
    dev_t st_rdev;          // Device ID (if special file)
};
```

**Key fields**:
- **st_ino**: Unique within the filesystem. Two files with same inode are the same file.
- **st_nlink**: Number of hard links (directory entries) pointing to this inode. File is deleted only when nlink=0 and no open file descriptors remain.
- **st_size**: Total bytes in file.
- **st_mode**: 16-bit field encoding type (regular, directory, symlink, block device, etc.) and permissions (rwxrwxrwx).

## Pseudocode

### Path Traversal (Simplified `open()`)

```c
inode_t* traverse_path(char* path) {
    if (path[0] == '/') {
        current_inode = load_root_inode();  // Root inode number is 2
    } else {
        current_inode = get_current_directory_inode();  // Relative path
    }
    
    char* component = strtok(path, "/");
    while (component) {
        // Read directory contents
        byte* dir_data = read_inode_data(current_inode);
        
        // Search for entry with matching name
        struct dirent* entry = search_dir(dir_data, component);
        if (!entry) {
            return NULL;  // Not found
        }
        
        // Move to next component
        current_inode = entry->ino;
        component = strtok(NULL, "/");
    }
    
    return load_inode(current_inode);
}

struct dirent {
    uint32_t d_ino;       // Inode number
    uint16_t d_reclen;    // Record length
    uint8_t d_namelen;    // Name length
    char d_name[256];     // Filename
};
```

### Reading a Directory

```c
void list_directory(char* path) {
    int fd = open(path, O_RDONLY);
    char buf[4096];
    int nread = read(fd, buf, sizeof(buf));
    
    struct dirent* d = (struct dirent*) buf;
    while ((char*) d < buf + nread) {
        printf("%u %s\n", d->d_ino, d->d_name);
        d = (struct dirent*) ((char*) d + d->d_reclen);
    }
    close(fd);
}
```

## Hand-trace example

### Directory Listing with Inodes

```
$ ls -i /foo
67158084 file1.txt
67158085 file2.txt
67158086 subdir
```

Each entry is a (inode, name) pair. The directory file `/foo` itself (inode 67158083) contains these entries.

### Path Traversal: `open("/foo/bar/file.txt")`

| Step | Action | Inode | Block Read | Notes |
|---|---|---|---|---|
| 1 | Start at root `/` | 2 | Read root inode 2 | Standard root inode |
| 2 | Look for "foo" in root | 2 | Read root's data blocks | Search directory entries |
| 3 | Find "foo" → inode 10 | 10 | Read inode 10 | Load "foo" inode |
| 4 | Read "foo"'s data blocks | 10 | Read directory data | "foo" is a directory |
| 5 | Look for "bar" in "foo" | 10 | (already cached) | Search entries for "bar" |
| 6 | Find "bar" → inode 20 | 20 | Read inode 20 | Load "bar" inode |
| 7 | Read "bar"'s data blocks | 20 | Read directory data | "bar" is a directory |
| 8 | Look for "file.txt" in "bar" | 20 | (already cached) | Search entries for "file.txt" |
| 9 | Find "file.txt" → inode 30 | 30 | Read inode 30 | Load "file.txt" inode |
| 10 | Return file descriptor | 30 | — | Open complete |

**Total reads**: 5 inode reads + data block reads for paths traversed ≈ 5-10 I/Os (cached after first access).

## Common exam questions

- **MCQ:** What is the fundamental identity of a file within a filesystem?
  - [x] Its inode number (filenames are directory aliases)
  - [ ] Its filename, which is globally unique
  - [ ] Its absolute pathname
  - [ ] Its size in bytes
  - why: Filenames can be changed, aliased via hard links, or duplicated in different directories; the inode number uniquely identifies the on-disk file.

- **MCQ:** A directory is stored on disk as:
  - [x] A file whose contents are a list of (name, inode) entries
  - [ ] A hash table managed directly by the disk controller
  - [ ] A B-tree baked into the superblock
  - [ ] A fixed array in the inode bitmap
  - why: Directories are regular files with a special format; listing one means reading its data blocks and parsing dirent records.

- **MCQ:** Two files in different directories share inode number 42 on the same filesystem. What does that mean?
  - [x] They are the same file (hard links), sharing data and metadata
  - [ ] They happen to have the same name, nothing more
  - [ ] They are unrelated files with a naming coincidence
  - [ ] Only one of them is valid; the other is corrupt
  - why: Within one filesystem, inode numbers uniquely identify a file; two directory entries with the same inode are two names for the same file.

- **MCQ:** `unlink("foo")` is called while another process still has `foo` open. What happens immediately?
  - [x] The directory entry is removed and nlink decremented, but the inode and data persist until all FDs close
  - [ ] The file's inode and data blocks are freed immediately
  - [ ] The call fails with EBUSY
  - [ ] The open FD is silently closed
  - why: Deletion only reclaims inode/data when nlink reaches 0 AND no open file descriptors reference the inode.

- **MCQ:** What does `st_nlink` count in the stat struct?
  - [x] The number of hard links (directory entries) pointing to this inode
  - [ ] The number of open file descriptors
  - [ ] The number of bytes in the file
  - [ ] The number of symbolic links targeting the file
  - why: nlink tracks names; the file is a deletion candidate only when nlink drops to zero.

- **MCQ:** To resolve the absolute path `/a/b/c/file`, what does the kernel do?
  - [x] Start at the root inode, read `a`'s entry, load `a`'s inode, read `b`'s entry in `a`, and so on down the chain
  - [ ] Hash the path string and look up the result directly
  - [ ] Search the inode table for a matching path string
  - [ ] Consult the superblock for a precomputed table
  - why: Path traversal walks component by component, reading each directory's data and following inode numbers inward.

- **MCQ:** The root directory of a standard Unix filesystem typically has which inode number?
  - [x] 2
  - [ ] 0
  - [ ] 1
  - [ ] 42
  - why: Inodes 0 and 1 are reserved; the root directory is conventionally placed at inode 2.

## Gotchas

- **Inode uniqueness**: Inode numbers are unique **within a filesystem**, not globally. Different filesystems can have inode 12; they're different files.
- **Directory as file**: Directories are files with a special format. You can't seek() into a directory or write arbitrary data; only the OS can update directory entries.
- **Root inode**: Nearly all Unix filesystems use inode 2 as the root directory (`/`). Inode 1 is typically reserved.
- **Current directory**: Relative paths (e.g., `foo/bar`) are resolved relative to the current working directory, which is stored in the process's PCB.
- **st_nlink and deletion**: Calling `unlink(path)` just removes the directory entry and decrements st_nlink. The inode and data blocks are freed only when st_nlink==0 AND all open file descriptors are closed.

## Sources

- lectures__Week12_2.txt: File abstraction (linear array of bytes, opaque), directory abstraction (list of name-inode pairs), stat struct fields (st_ino, st_nlink, st_size, st_mode, etc.), path traversal, directory tree, inode as identity, absolute vs. relative paths, root inode = 2, 4 KB block size.
