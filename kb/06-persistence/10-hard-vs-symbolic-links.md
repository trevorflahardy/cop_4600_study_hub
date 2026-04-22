# Hard Links vs. Symbolic (Soft) Links

## Definition

A **hard link** creates a new directory entry pointing to the same inode (same file). Both names share the inode and data blocks; deleting one name doesn't affect the other unless it's the last hard link. A **symbolic link** (symlink) is a separate file containing a pathname string; it's a different inode that indirectly references another file's name. Symlinks can cross filesystems and reference nonexistent files (dangling references).

## When to use

- **Hard links**: Aliasing a file without copying (same inode, shared nlink counter). Requires both names to be on the same filesystem.
- **Symbolic links**: Creating shortcuts or aliases that work across filesystems, or referencing files by path without inode knowledge.
- **Aliasing directories**: Impossible with hard links (would create cycles); use symlinks instead.

## Key ideas

### Hard Links

A hard link is another directory entry (name) pointing to the same inode.

```
Directory entry 1: ("file", inode 42)
Directory entry 2: ("file2", inode 42)
Both refer to inode 42 (same data blocks, same metadata).
```

When you create a hard link:
1. Increment the inode's **nlink** (link count).
2. Add a new directory entry in the directory file.
3. No new inode is allocated.

When you delete (unlink) a file:
1. Remove the directory entry.
2. Decrement **nlink**.
3. If nlink becomes 0 (and no open file descriptors), free the inode and data blocks.

**Constraints**:
- Both names must be on the same filesystem (same inode number space).
- Cannot create hard links to directories (would create cycles).

### Symbolic Links

A symbolic link is a separate file containing a pathname.

```
Inode 100 (symlink):
  type: symlink
  size: 4 bytes (length of pathname)
  data: "foo/" (the pathname it references)

Inode 42 (regular file):
  type: regular
  size: 1024
  data: ...file contents...
```

When you read through the symlink, the OS resolves the pathname to find the target inode.

**Resolving `/path/to/link`** (where `link` is a symlink):
1. Look up `/path/to/link` → finds inode 100 (symlink).
2. Read inode 100's data → get pathname "foo/".
3. Resolve "foo/" from the symlink's directory → find target inode.

**Constraints**:
- Symlinks can reference files on different filesystems.
- Symlinks can be dangling (target doesn't exist).
- Symlink size = length of pathname (typically 1-256 bytes).

## Pseudocode

### Creating a Hard Link

```c
int link(char* old_path, char* new_path) {
    // 1. Look up old file's inode
    struct inode* inode = path_to_inode(old_path);
    if (!inode) return -1;
    
    // 2. Find parent directory of new path
    char* new_parent_path = dirname(new_path);
    struct inode* parent_dir = path_to_inode(new_parent_path);
    if (!parent_dir) return -1;
    
    // 3. Add new directory entry to parent
    // (same inode number, new name)
    add_directory_entry(parent_dir, basename(new_path), inode->ino);
    
    // 4. Increment link count
    inode->nlink++;
    
    // 5. Write updated inode and directory to disk
    disk_write_inode(inode);
    disk_write_inode(parent_dir);
    
    return 0;
}
```

### Creating a Symbolic Link

```c
int symlink(char* target_path, char* link_path) {
    // 1. Find parent directory of link
    struct inode* parent_dir = path_to_inode(dirname(link_path));
    
    // 2. Allocate new inode for symlink
    uint32_t link_ino = allocate_inode();
    struct inode* link_inode = load_inode(link_ino);
    
    // 3. Set inode type to symlink
    link_inode->mode = S_IFLNK | 0777;  // Symlink type
    
    // 4. Store target path as data
    link_inode->size = strlen(target_path);
    uint32_t data_block = allocate_block();
    link_inode->i_block[0] = data_block;
    disk_write_block(data_block, target_path);  // Write path string
    
    // 5. Add directory entry for symlink
    add_directory_entry(parent_dir, basename(link_path), link_ino);
    
    // 6. Write inodes to disk
    disk_write_inode(link_inode);
    disk_write_inode(parent_dir);
    
    return 0;
}
```

### Unlinking (Deleting)

```c
int unlink(char* path) {
    // 1. Find inode
    struct inode* inode = path_to_inode(path);
    
    // 2. Remove directory entry
    struct inode* parent = path_to_inode(dirname(path));
    remove_directory_entry(parent, basename(path));
    
    // 3. Decrement link count
    inode->nlink--;
    
    // 4. If nlink == 0 and no open FDs, free inode and data
    if (inode->nlink == 0) {
        if (num_open_file_descriptors(inode->ino) == 0) {
            free_inode(inode);
            free_data_blocks(inode);
        }
    }
    
    return 0;
}
```

## Hand-trace example

### Hard Link Example (from lecture)

Initial state: Inode 67158084, nlink = 1.

```bash
$ echo "hello" > file
$ stat file
Inode: 67158084 Links: 1

$ ln file file2
$ stat file
Inode: 67158084 Links: 2
$ stat file2
Inode: 67158084 Links: 2
```

| Operation | file nlink | file2 nlink | Inode 67158084 nlink | File Data |
|---|---|---|---|---|
| Create "file" | 1 | — | 1 | "hello" |
| `ln file file2` | 1 | 1 | 2 | "hello" |
| `rm file` | — | 1 | 1 | "hello" (still accessible via file2) |
| `rm file2` | — | — | 0 (freed) | (deleted) |

After first `rm`, inode still exists (nlink=1). After second `rm`, inode is deleted.

### Hard Link Chain

```bash
$ ln file file2    # nlink becomes 2
$ ln file2 file3   # nlink becomes 3
$ rm file          # nlink becomes 2 (file still accessible via file2, file3)
$ rm file2         # nlink becomes 1 (file3 still has it)
$ rm file3         # nlink becomes 0 (inode freed)
```

| Step | Command | nlink | Explanation |
|---|---|---|---|
| 0 | Create "file" | 1 | |
| 1 | `ln file file2` | 2 | Two names now point to inode 67158084 |
| 2 | `ln file2 file3` | 3 | Three names |
| 3 | `rm file` | 2 | Removed one name; inode still has file2, file3 |
| 4 | `rm file2` | 1 | Removed second name; inode still has file3 |
| 5 | `rm file3` | 0 | Removed last name; inode and data are freed |

### Symbolic Link Example

```bash
$ echo "content" > target
$ ln -s target link
$ cat link
content
```

| File | Inode | Type | Size | Content/Data |
|---|---|---|---|---|
| target | 100 | regular | 8 | "content" |
| link | 101 | symlink | 6 | "target" (pathname string) |

When resolving `/path/to/link`:
1. Look up "link" → find inode 101 (symlink).
2. Read inode 101's data → get string "target".
3. Resolve "target" from the current directory → find inode 100.
4. Read inode 100 → get "content".

### Dangling Symlink

```bash
$ ln -s nonexistent link2
$ cat link2
cat: link2: No such file or directory
```

Inode 102 (symlink) contains "nonexistent", but resolving "nonexistent" fails (no such inode exists).

## Common exam questions

1. You create a hard link to a file, then delete the original. What happens to the file?
2. Can you create a hard link to a directory? Why or why not?
3. A file has nlink=1 and you create a hard link. What is nlink now?
4. If you delete a file with nlink=3, how many unlink() calls are needed to actually delete it?
5. A symlink points to a file on a different filesystem. Is this possible with hard links?
6. What is the inode size of a 4-byte symlink vs. a 4-byte regular file?
7. After `rm file`, the file still has nlink=1. What is preventing it from being deleted?

## Gotchas

- **Hard link cycle prevention**: The OS prevents hard links to directories because it would create cycles (e.g., `/a/b` hardlinked to `/a/b/c/parent`), breaking the tree structure. Symlinks don't have this issue because they reference pathnames, not inodes.
- **nlink counter**: Hard links share the nlink field. You must unlink() once for each hard link to free the inode. nlink != 1 doesn't mean the file is safe from deletion; it just means multiple names exist.
- **Symlink vs. hard link storage**: A symlink is a separate inode. Symbolic linking uses extra inodes and disk space. Hard linking uses zero extra space (just a directory entry).
- **Cross-filesystem limitation of hard links**: Hard links require the same inode number space (same filesystem). Symlinks work across filesystems.
- **Open file persistence**: If a process has a file open (FD exists) and the file is unlink()'ed, the file persists until the process closes the FD. The inode is not freed while open.

## Sources

- lectures__Week12_2.txt: Hard links (link count trace with inode 67158084, nlink 1→2→3→1), unlink() and nlink decrement, symlinks (separate files with pathname string, can cross filesystems), dangling symlinks, hard links cannot reference directories.
