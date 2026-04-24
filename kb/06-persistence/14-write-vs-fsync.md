# `write()` vs. `fsync()`: Buffering and Durability

## Definition

`write()` returns after copying data to the kernel page cache (DRAM), without guaranteeing disk persistence. `fsync()` forces the OS to write all pending dirty pages (both data and metadata) to disk and waits for completion. A crash between `write()` and `fsync()` loses data.

## When to use

- **Applications requiring durability**: Databases, transaction logs, critical user data.
- **Understanding performance trade-offs**: `write()` is fast (~microseconds), `fsync()` is slow (~milliseconds).
- **Batching for efficiency**: Issuing multiple writes and a single `fsync()` is more efficient than `fsync()` after each write.

## Key ideas

### `write()` Semantics

```c
int write(int fd, const void* buf, size_t count);
```

**Returns**: Number of bytes written to the page cache.

**Disk persistence**: NOT guaranteed. Data sits in DRAM until:
1. Kernel asynchronously flushes dirty pages (e.g., every 5 seconds).
2. Application calls `fsync(fd)`.
3. File descriptor is closed (often flushes data, but not guaranteed).

**Latency**: ~1-10 microseconds (memory copy).

### `fsync()` Semantics

```c
int fsync(int fd);
```

**Returns**: 0 on success, -1 on error, after all dirty pages are written to disk.

**Guarantee**: All data and metadata for the file are persisted. A crash after `fsync()` returns does not lose this data.

**Latency**: ~5-100 milliseconds (disk I/O).

### Crash Scenario

```
Time    Process         Disk State
t0      write(fd, "A") Page cache: "A"    Disk: empty
t1      write(fd, "B") Page cache: "AB"   Disk: empty
t2      **CRASH**      Page cache: lost   Disk: empty   ← Data lost!

---

With fsync:
t0      write(fd, "A") Page cache: "A"    Disk: empty
t1      write(fd, "B") Page cache: "AB"   Disk: empty
t2      fsync(fd)      Page cache: "AB"   Disk: "AB"    ← Flushed
t3      **CRASH**      Page cache: lost   Disk: "AB"    ← Data safe!
```

### Write-Back vs. Write-Through

**Write-Back Cache** (modern default):
- `write()` returns immediately after buffering.
- Kernel flushes asynchronously or on `fsync()`.
- Risk: Crash before flush loses data.
- Benefit: High throughput (low latency).

**Write-Through Cache** (old, rarely used):
- `write()` doesn't return until data is on disk.
- Safer but very slow.
- Each `write()` is ~milliseconds.

### Buffer Flushing Policies

**Periodic (Default)**:
```
Kernel: Every 5 seconds, flush all dirty pages
        (even without fsync())
```

**Demand**:
```
Application: Explicit fsync() call
            OR close(fd)
```

**On Disk Pressure**:
```
Kernel: When page cache is full, flush least-recently-used
        (eviction to make room for new pages)
```

## Pseudocode

### Buffered `write()`

```c
ssize_t write(int fd, const void* buf, size_t count) {
    struct open_file* ofe = process->fd_table[fd];
    struct inode* inode = ofe->inode;
    
    // Copy to page cache (DRAM), not disk
    void* cache_page = get_page_cache(inode, ofe->offset / PAGE_SIZE);
    
    int offset_in_page = ofe->offset % PAGE_SIZE;
    memcpy(cache_page + offset_in_page, buf, count);
    
    // Mark page as dirty (needs writeback)
    mark_dirty(cache_page);
    
    // Update file size and offset
    ofe->offset += count;
    inode->size = max(inode->size, ofe->offset);
    
    // DO NOT write to disk yet!
    
    return count;  // Return immediately (~microseconds)
}
```

### `fsync()` - Force Writeback

```c
int fsync(int fd) {
    struct open_file* ofe = process->fd_table[fd];
    struct inode* inode = ofe->inode;
    
    // Find all dirty pages for this inode
    list_t dirty_pages = find_dirty_pages(inode);
    
    // Write each dirty page to disk
    for_each_page(dirty_pages, page) {
        uint32_t block = find_block_for_page(inode, page);
        disk_write(block, page);  // Disk I/O
    }
    
    // Write inode metadata to disk
    disk_write_inode(inode);  // Inode I/O
    
    // Wait for all I/Os to complete
    wait_for_disk_completion();
    
    return 0;
}
```

### Batched Writes

```c
void efficient_writes() {
    int fd = open("file.txt", O_WRONLY | O_CREAT);
    
    // Write 1000 records without fsync
    for (int i = 0; i < 1000; i++) {
        char record[1024];
        sprintf(record, "Record %d\n", i);
        write(fd, record, strlen(record));  // Buffered (~1 microsecond each)
    }
    
    // Single fsync at the end
    fsync(fd);  // One disk write (~10ms for all data)
    
    close(fd);
    
    // Total: ~1000 microseconds + ~10ms = ~11ms
    // vs. fsync after each write: ~1000 × 10ms = ~10 seconds!
}
```

## Hand-trace example

### Performance Comparison: Buffered vs. Synchronous

**Setup**: Writing 1000 × 1 KB records. Disk: 10 ms latency per I/O.

| Approach | Per-Write Latency | Total Writes | Total Time | Data Safe After? |
|---|---|---|---|---|
| `write()` only (no fsync) | ~1 μs | 1000 | ~1 ms | NO (data lost on crash) |
| `write()` + single `fsync()` | ~1 μs + 10 ms final | 1000 + 1 | ~11 ms | YES |
| `write()` + `fsync()` after each | ~1 μs + 10 ms | 1000 | ~10 seconds | YES (but overkill) |
| Buffered `write()` + OS flush (5 sec) | ~1 μs | 1000 | ~1 ms | YES (after 5 sec) |

**Winner**: `write()` + single `fsync()` (11 ms, safe, efficient).

### Crash Timeline

```
Time (ms)   Event                           Page Cache      Disk        Data Safe?
0           open("file.txt", O_WRONLY)     empty           empty       —
10          write(fd, "Record 1", 100)    Record 1        empty       NO
20          write(fd, "Record 2", 100)    Record 1-2      empty       NO
30          fsync(fd)                      Record 1-2      Record 1-2  YES
40          write(fd, "Record 3", 100)    Record 1-3      Record 1-2  NO (Record 3 at risk)
50          fsync(fd)                      Record 1-3      Record 1-3  YES
60          **CRASH**
```

After crash: Records 1-3 are on disk (safe). Any writes after the last fsync() are lost.

### Inode Metadata Updates

`fsync()` must also flush inode metadata:

```
write(fd, data, 4096):
  Page cache: {dirty data page, inode with updated size+mtime}
  
fsync(fd):
  Disk write 1: Data page (4 KB)
  Disk write 2: Inode metadata (256 bytes)
  Wait for both to complete
  Return
```

Both the data AND metadata must reach disk for consistency.

## Common exam questions

- **MCQ:** `write()` returns successfully. What does this guarantee about disk persistence?
  - [x] Nothing; the data may still be buffered in the page cache
  - [ ] Data is durably on disk
  - [ ] Data is on disk and a backup copy has been made
  - [ ] The file has been fsync'd automatically
  - why: Default write-back caching returns after copying to DRAM; durability requires an explicit `fsync()` or a kernel flush.

- **MCQ:** A process writes 100 KB to a file without calling `fsync()`, then the machine crashes. What happens to the data?
  - [x] It is likely lost because it was still in the page cache
  - [ ] It is always on disk because write() returned
  - [ ] The filesystem auto-recovers it on reboot
  - [ ] The data is partially corrupted but readable
  - why: Without fsync, no guarantee exists that the dirty pages reached disk before the crash.

- **MCQ:** Typical latency ranges for write() vs. fsync() on a modern HDD-backed file system?
  - [x] write() ~microseconds (memcpy), fsync() ~milliseconds (disk I/O)
  - [ ] write() ~seconds, fsync() instantaneous
  - [ ] Both ~1 ms
  - [ ] write() ~100 ms, fsync() ~1 us
  - why: Buffered writes are just memory copies; fsync must wait for disk I/O to complete, which is orders of magnitude slower.

- **MCQ:** Why does a database call `fsync()` after appending a transaction log record?
  - [x] To guarantee the log record is on stable storage before acknowledging the transaction
  - [ ] Because write() does not write any bytes to memory
  - [ ] To speed up the next write
  - [ ] To update the atime field
  - why: Write-ahead logging only protects against crashes if the log record is durable before the commit is reported; fsync enforces that ordering.

- **MCQ:** Compare `fsync()` per-write vs. one `fsync()` after 1000 writes for 10 ms disk latency.
  - [x] Per-write: ~10 seconds; batched: ~10 ms; batched wins
  - [ ] Both take the same time
  - [ ] Per-write is faster due to locality
  - [ ] Batched loses data; per-write is safer
  - why: Each fsync pays a full round-trip; batching amortizes one disk flush over many writes, slashing end-to-end latency.

- **MCQ:** Which statement correctly describes the write-back page cache policy?
  - [x] write() copies data to memory and returns immediately; dirty pages are flushed later
  - [ ] Every write synchronously hits disk before returning
  - [ ] write() writes to a log and never to the file
  - [ ] Dirty pages are discarded after 1 second
  - why: Write-back improves throughput by deferring I/O, at the cost of a durability window that fsync/sync can close.

- **MCQ:** After `fsync(fd)` returns successfully, how durable is the file?
  - [x] Both data and metadata for that file are on disk, surviving any power loss thereafter
  - [ ] Only data is on disk; metadata is still pending
  - [ ] Only metadata is on disk; data remains cached
  - [ ] Durability depends on the OS scheduler
  - why: fsync flushes both data pages and associated inode metadata, and waits for hardware acknowledgment before returning.

## Gotchas

- **Not all `close()` implementations fsync**: Closing a file descriptor does NOT guarantee `fsync()`. You must call `fsync()` explicitly for safety.
- **Periodic flush timing**: Filesystems flush dirty pages every 5-30 seconds (configurable). Data written at t=0 might not be on disk until t=5. No guarantee.
- **Directory metadata**: Creating a file requires writing directory metadata (directory block, inode bitmap). `fsync(fd)` only flushes the file, not the directory. You may need to `fsync()` the parent directory too.
- **Disk cache**: Modern SSDs and HDDs have their own on-board cache (write-back). `fsync()` tells the OS to write; the disk might return immediately even if its cache hasn't drained to the actual medium. Some applications use `O_DIRECT` to bypass caches entirely.
- **atime updates**: Updating access time (atime) on every read can be expensive. Some filesystems batch atime updates or disable them.

## Sources

- lectures__Week12_2.txt: `fsync()` forces writes to disk, `write()` returns after buffering, crash between `write()` and `fsync()` loses data, typical latency `write()` ~microseconds, `fsync()` ~milliseconds, 5-second batching.
