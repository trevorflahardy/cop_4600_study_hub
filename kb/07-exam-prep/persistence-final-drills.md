# Persistence — Final Exam Drills (Chapters 41 and 42 focus)

> Confirmed: 48 final-exam points on persistence, with at least 16 of
> those on inconsistency and recovery. The professor told the class to
> "review has all the content that is required" and pointed to chapters
> 41 (FS implementation) and 42 (crash consistency / journaling) as the
> heaviest zones. These drills mirror the shapes most likely to appear.

## Warmup — what lives where

Before attempting the drills, draw this table from memory. If you can't,
reread [07-fd-openfile-inode-tables.md](../06-persistence/07-fd-openfile-inode-tables.md).

| Structure | Lives where | Holds | One-per |
|-----------|-------------|-------|--------|
| File descriptor table | Per-process memory | index → open-file-table pointer | process |
| Open file table | Kernel memory | file offset, flags, inode pointer, ref count | system |
| Inode cache | Kernel memory | in-memory copy of inode + ref count, dirty, lock | system |
| Inode (on-disk) | Disk, inside inode table | mode, size, 12 direct, 1 indirect, 1 double-indirect, timestamps | file |
| Inode table | Disk, near superblock | array of inodes, N per block | filesystem |
| Inode bitmap | Disk | 1 bit per inode: free or allocated | filesystem |
| Data bitmap | Disk | 1 bit per data block: free or allocated | filesystem |
| Superblock | Disk, block 0 (or 1) | filesystem metadata (block size, counts, UUID) | filesystem |

Two implications the exam keeps hammering:

1. **After fork, parent and child share the open file table entry but have
   *separate* FD tables** — they share the seek offset, because offset
   lives in the open-file-table entry, not the FD entry.
2. **dup2(fd1, fd2)** copies the FD-table slot for fd1 into slot fd2; both
   FDs then point at the *same* open-file-table entry (shared offset).

## Drill 1 — I/O time (exam staple)

A hard disk drive has:

- Average seek time: 6 ms
- Rotational speed: 10,000 RPM
- Transfer rate: 200 MB/s
- Block size: 4 KB

Compute (show all work):

1. Average rotational delay.
2. Transfer time for one 4 KB block.
3. Total time to read one random 4 KB block.
4. Total time to read 256 sequential 4 KB blocks (1 MB) from the same
   track after a single seek.
5. Random-read throughput (IOPS) and sequential-read throughput (MB/s).

### Solution

1. **Rotational delay**: 10,000 RPM = 166.67 rev/s → 6 ms/rev → half rev =
   3 ms.
2. **Transfer**: 4 KB at 200 MB/s = 0.004 MB / 200 MB/s = 0.00002 s = 0.02 ms.
3. **Random**: 6 + 3 + 0.02 = **9.02 ms**.
4. **Sequential**: one seek (6 ms) + one rotation (3 ms) + 1 MB / 200 MB/s
   (5 ms transfer) = **14 ms for 1 MB**.
5. **Random-read IOPS**: 1000 ms / 9.02 ms = **≈ 111 IOPS** → 111 × 4 KB =
   **≈ 0.44 MB/s**. **Sequential**: 1 MB / 14 ms = **≈ 71 MB/s**.

### Takeaway

Sequential reads are ~160× faster per byte than random reads on this
drive. Whenever an exam question says "workload is sequential," you can
skip the rotation+seek math for every block after the first.

## Drill 2 — disk scheduling comparison

Disk head is at track 50. Request queue (in order of arrival):
`82, 170, 43, 140, 24, 16, 190`.

Compute total head movement for each algorithm:

1. FCFS
2. SSTF
3. SCAN (heading toward higher tracks first, then reverses at end)
4. C-SCAN (heading toward higher tracks; jumps to 0 at end, continues up)

### Solution

1. **FCFS**: 50→82→170→43→140→24→16→190
   - |50-82| + |82-170| + |170-43| + |43-140| + |140-24| + |24-16| + |16-190|
   - = 32 + 88 + 127 + 97 + 116 + 8 + 174 = **642 tracks**.

2. **SSTF** (always pick nearest): 50→43→24→16→82→140→170→190
   - 7 + 19 + 8 + 66 + 58 + 30 + 20 = **208 tracks**.

3. **SCAN** (going up first): 50→82→140→170→190→(reverse)→43→24→16
   - 32 + 58 + 30 + 20 + (190-16 = 174) = **314 tracks**. (Going up: 140
     track movement. Coming back down from 190 to 16: 174. Total 314.)

4. **C-SCAN**: 50→82→140→170→190→(jump to 0, ignore)→16→24→43
   - Going up: 140. Jump to 0 (some books count this as 190, some don't).
     Commonly counted: jump is free (head repositioned but no requests
     served). Continue up: 16→24→43 = 43.
   - **Total with jump counted as 190**: 140 + 190 + 43 = 373.
   - **Total with jump ignored**: 140 + 43 = 183.
   - Use the convention your lecture uses. Zhang's deck counts the jump.

### Takeaway

SSTF wins on total movement but can starve far requests. SCAN balances
movement vs. fairness. C-SCAN gives more uniform wait time.

## Drill 3 — open("/a/b/c") I/O count (Chapter 41)

Filesystem layout (one block = 4 KB):

- Block 0: superblock
- Block 1: inode bitmap
- Block 2: data bitmap
- Blocks 3-9: inode table (inodes per block = 4)
- Blocks 10+: data blocks

Assume the root inode has a well-known number (e.g., 2). The path
`/a/b/c` means:

- Read root directory data, find entry `a`.
- Read inode of `a`, read its data block, find entry `b`.
- Read inode of `b`, read its data block, find entry `c`.
- Read inode of `c`.

Count the exact I/O operations for `open("/a/b/c")`, then for `read(fd, buf, 4096)`
on the freshly opened file (assume `c` is 4 KB, stored in one direct block).

### Solution

**open path walk:**

| Step | Read | Bytes |
|------|------|-------|
| 1 | root inode (inode table block) | 4 KB |
| 2 | root directory data block | 4 KB |
| 3 | a's inode | 4 KB |
| 4 | a's directory data block | 4 KB |
| 5 | b's inode | 4 KB |
| 6 | b's directory data block | 4 KB |
| 7 | c's inode | 4 KB |

**open() total: 7 reads.** (Some textbooks include the superblock as an
implicit first read, bringing it to 8. Confirm which convention your
professor uses. OSTEP Ch 40 table 40.3 counts 7 for a three-level path.)

**read() total: 1 read** (c's data block). Accessed timestamp on the inode
causes 1 write on close or periodically, but not synchronously.

### Variant

If the file `c` lives at offset 0, is 16 KB long, and uses direct
pointers, `read` for the whole file = **4 data-block reads** (one per 4
KB chunk).

If it's 1 MB, needs indirect block too: 1 indirect + 256 data = **257
reads**.

## Drill 4 — create() I/O count (Chapter 41)

`create("/foo/bar.txt")` where `/foo` already exists but `bar.txt` does
not. List every read and every write. Assume `/foo`'s data block has room
for the new entry (no new data block allocation).

### Solution

**Reads:**

1. Root inode.
2. Root data block (find `foo`).
3. Foo's inode.
4. Foo's data block (check that `bar.txt` is missing).
5. Inode bitmap (find a free inode).

**Writes:**

6. Inode bitmap (mark chosen inode as used).
7. New inode (initialize with default fields).
8. Foo's data block (add entry `bar.txt → new inode num`).
9. Foo's inode (update mtime, maybe size).

**Total: 5 reads, 4 writes.** If `/foo`'s data block is full and a new
directory block must be allocated, add 1 data-bitmap read, 1 data-bitmap
write, 1 data-block write, for **5 reads + 4 writes + 3 more writes**.

## Drill 5 — write() that allocates a block (Chapter 41)

`write(fd, buf, 4096)` on an open file whose logical size grows by one
block. All inode data is already cached in memory (open() already ran).
List the disk I/O for this single write.

### Solution

**Reads:**

1. Data bitmap (find a free block). *If bitmap is cached, skip.*

**Writes:**

2. Data bitmap (mark block used).
3. Inode (update block pointer, size, mtime).
4. Data block (write user data).

**Total: 1 read + 3 writes = 4 I/Os.**

If the write crosses into the indirect block range, add:

- 1 read of the indirect block (if not cached).
- 1 write of the indirect block (store new pointer).

**Total: 2 reads + 4 writes = 6 I/Os.**

## Drill 6 — max file size from inode layout (Chapter 40)

Given a 4 KB block size, 4-byte block pointers, and an inode with 12
direct pointers + 1 single-indirect + 1 double-indirect + 1
triple-indirect:

1. How many pointers per indirect block?
2. How many data blocks can the single-indirect block reach?
3. How many data blocks can the double-indirect reach?
4. How many for triple-indirect?
5. What is the maximum file size?

### Solution

1. **4 KB / 4 B = 1024 pointers per block.**
2. **1024 data blocks** → 4 MB via single-indirect.
3. **1024 × 1024 = 1,048,576 blocks** → 4 GB via double-indirect.
4. **1024³ = 1,073,741,824 blocks** → 4 TB via triple-indirect.
5. **Max size ≈ 12 × 4 KB + 4 MB + 4 GB + 4 TB ≈ 4 TB.**

If your inode has only direct + single + double indirect (Ch 40 Fig
40.3): max ≈ 48 KB + 4 MB + 4 GB ≈ **4 GB**.

## Drill 7 — crash consistency: the three writes (Chapter 42)

A single logical append of one data block requires three physical writes:

- W1: data block
- W2: inode (pointer + size)
- W3: data bitmap

Enumerate the 7 non-empty subsets of writes that could have completed
before a crash. For each, describe the resulting FS inconsistency.

### Solution

| Writes completed | FS state | Consistency problem |
|------------------|----------|---------------------|
| {} | nothing happened | no problem; user's data lost, but no FS corruption |
| {W1} | data on disk but inode doesn't point to it, bitmap says free | leaked data (block contents exist but block is reallocatable → future write will overwrite) |
| {W2} | inode claims block B but B has garbage, bitmap says free | reads will return stale garbage; next allocator may hand B to a new file → worse corruption |
| {W3} | bitmap says B used, but no inode owns it | permanent leak (block marked used forever) |
| {W1, W2} | inode → B with correct data, but bitmap says free | allocator may hand B to another file → later corruption |
| {W1, W3} | data correct, bitmap correct, but no inode owns B | permanent leak |
| {W2, W3} | inode claims B, bitmap matches, but B's contents are stale garbage | reads return garbage |

**Every case violates some invariant.** FSCK can detect and repair some
of these by scanning + rebuilding, but it's slow and may lose data.
Journaling prevents the mid-state from being durable: the transaction
either commits in full (all three on disk plus a TxEnd marker) or does
not commit (replay skips it and file stays as it was).

## Drill 8 — journaling mode walkthrough (Chapter 42)

Given the append scenario in Drill 7, trace what hits disk under each
journaling mode before the TxEnd is written. Assume fixed journal blocks
`J1, J2, J3, JE`.

### Data journaling (most conservative)

- Write data and metadata to journal: J1 (copy of data), J2 (copy of
  inode), J3 (copy of bitmap).
- Write TxBegin and TxEnd.
- **After commit**: checkpoint — write data + inode + bitmap to their
  real locations.

If crash before TxEnd: recovery ignores the transaction. If crash after
TxEnd but before checkpoint: recovery replays J1-J3 to their real
locations. Every block is written **twice** (journal + final home).

### Ordered journaling (Linux ext3 default)

- Write **data** to final location first (outside journal).
- Write **metadata** to journal: J2 (inode), J3 (bitmap).
- TxEnd.
- Checkpoint metadata to final location.

Data is never in the journal. Saves half the I/O. Crash during data write
→ file stays at old state (inode still points at old block). Safe.

### Metadata journaling (least conservative)

- Metadata to journal; data and metadata reach real locations
  independently. Order unspecified.
- Crash can leave inode pointing at unwritten data block → reads return
  garbage.

Use unless you need durability.

### Takeaway

Ordered mode is the standard middle ground. Know the difference cold.

## Drill 9 — revoke records (Chapter 42)

Scenario:

1. File `A` has block B allocated.
2. `A` is deleted; block B is freed in bitmap. This is journaled as
   transaction Tx1 (commits).
3. File `A'` is created and allocates block B. `A'` writes user data to
   B. This is journaled as transaction Tx2 (commits).
4. **Crash** before the journal is cleared.
5. On reboot, recovery replays Tx1 and Tx2.

What goes wrong if there are no revoke records?

### Solution

Without revoke records, recovery replays Tx1 first (which wrote metadata
showing B as free) and then Tx2 (which wrote metadata showing B
allocated to A' with user data). The *replay order* is fine, but if the
journal format records only metadata and Tx1 also includes the old data
block contents (or if recovery replays data blocks from Tx1), then Tx1
overwrites the user data written by Tx2 in step 3. Result: A' now has
garbage or old-A's contents.

**Revoke records**: when B is freed (Tx1), a revoke entry is inserted.
On recovery, any block with a revoke entry is *not* replayed from
earlier transactions. This prevents Tx1 from clobbering Tx2's content.

Exam shorthand: "Revoke records prevent replay of stale journal entries
on reallocated blocks."

## Drill 10 — FSCK pass list (Chapter 42)

FSCK runs after crash, before mount. List its passes in order and what
each fixes.

### Solution

1. **Superblock**: sanity check (magic, size, free counts).
2. **Free blocks (data-bitmap scan)**: walk every inode, mark reachable
   blocks. Compare against data bitmap. Rebuild bitmap.
3. **Inode state**: for each inode, check type, link count, size, and
   reachable blocks. Clear invalid inodes.
4. **Inode links (nlink)**: walk directory tree, count actual references
   to each inode. Fix inode.nlink to match.
5. **Directory checks**: verify `.` and `..` entries, check for loops,
   dangling entries.
6. **Duplicate blocks**: if two inodes claim the same block, pick one
   (usually oldest), zero the other's pointer.
7. **Bad blocks**: verify no inode points at a bad block.

FSCK runtime is **O(filesystem size)**, which is why journaling took
over: recovery by replaying the journal is O(transactions since last
checkpoint).

## Drill 11 — FFS fairness (Chapter 41)

Describe FFS's cylinder-group (block-group) policy for:

1. Where to place a new directory.
2. Where to place a new file relative to its parent directory.
3. Where to place a new block within a large file.

Why does FFS spread out directories but keep files close to their parents?

### Solution

1. **New directory**: pick the cylinder group with (a) the most free
   inodes and (b) the fewest existing directories. This spreads
   directories across the disk for fairness and keeps inode pressure
   balanced.

2. **New file**: pick the same cylinder group as its parent directory.
   Keeps related files close, amortizes seek when walking a directory.

3. **New block in a large file**: stay in the same group until the file
   would eat too much of the group's space (say, past 48 KB or past a
   certain indirect level), then jump to a new group to avoid
   monopolizing one group.

**Why the asymmetry**: directories tend to contain many small files that
are read together, so local placement wins. But if all directories pile
into one group, that group fills up and later files can't be local. By
spreading directories, FFS preserves the ability to be local for many
unrelated subtrees.

## Drill 12 — RAID throughput (Chapter 38)

Given 4 disks, each capable of 100 MB/s sequential throughput:

| RAID level | Sequential read MB/s | Sequential write MB/s | 1-disk failure tolerated? |
|------------|----------------------|-----------------------|---------------------------|
| RAID-0 (striping) | ? | ? | ? |
| RAID-1 (mirroring, 2 pairs) | ? | ? | ? |
| RAID-4 (3 data + 1 parity) | ? | ? | ? |
| RAID-5 (4 disks, rotating parity) | ? | ? | ? |

### Solution

| RAID level | Read | Write | Tolerates failure? |
|-----------|------|-------|--------------------|
| RAID-0 | 400 | 400 | No |
| RAID-1 | 400 (reads fan out to both copies) | 200 (each write goes to both disks in pair) | Yes (one disk per pair) |
| RAID-4 | 300 (parity disk idle on read) | (bottleneck on parity disk) ≈ 100 | Yes |
| RAID-5 | 400 | 400 (parity spread, no bottleneck) on large writes; ≈ 75 on small writes (read-modify-write penalty) | Yes |

### Takeaway

RAID-4 suffers the small-write problem (parity disk is hot). RAID-5
distributes parity so no one disk is a bottleneck.

## Drill 13 — write vs fsync (Chapter 41)

A database writes a record with `write(fd, rec, 256)` and returns success
to the user. The machine crashes 50 ms later. Is the record on disk?

### Solution

**Probably not.** `write()` puts the record in the kernel's page cache
and returns. The page cache is flushed periodically (every 5-30 seconds
on Linux) or when the user calls `fsync(fd)`. If the crash happens
before either, the record is lost.

**Fix**: call `fsync(fd)` before returning success. This blocks until
the data and metadata are on disk.

**Journaling does not fix this** — journaling only protects FS integrity,
not user data durability.

## Drill 14 — short-answer checklist (professor's hinted style)

Answer each in 1-3 sentences:

1. Why does the filesystem keep both a file descriptor table and an open
   file table? Why not just use one?
2. What is the difference between a TLB miss and a page fault? (Crosses
   into memory virt — see Block 3.)
3. What is the difference between FCFS and SSTF disk scheduling?
4. Why does FFS use cylinder groups?
5. Why does fork share the open file table entry between parent and
   child?
6. Why does `while` beat `if` when waiting on a condition variable?
7. What does "a write to disk is not a single write" mean for crash
   consistency?
8. Why do journal transactions need both TxBegin and TxEnd?
9. Why does metadata-only journaling still allow user-data corruption?
10. What is the revoke record, and which corruption does it prevent?

### Suggested answers (self-grade)

1. **FD table** is per-process and holds indices into the open file
   table. **Open file table** is system-wide and holds file offset, flags,
   inode pointer. This lets fork share the offset (child inherits the
   open-file-table entry) while dup2 can share entries within a process.
2. **TLB miss** walks the page table; the translation exists, just not
   cached. **Page fault** means the present bit is 0 — page is on disk or
   not mapped; OS handles by paging in or killing the process.
3. **FCFS** serves in arrival order (fair but high seek). **SSTF** picks
   nearest track (low seek but starves far requests).
4. To preserve locality while spreading directories. Within a group,
   seeks are short; across groups, no single group fills up.
5. So parent and child share the seek offset. `cat >> log; echo x >> log`
   stitched together in a pipeline work correctly only because both
   processes share the same offset.
6. A signaled thread may wake but find the predicate already consumed by
   a third thread; `while` rechecks and sleeps again. `if` runs with a
   false predicate → bug.
7. A logical filesystem change (append, create, delete) requires updates
   to multiple blocks (data, inode, bitmap). Any subset can reach disk
   before a crash, leaving the FS inconsistent.
8. **TxBegin** marks the start; **TxEnd** marks commit. Recovery replays
   only transactions with both markers. A partial transaction (TxBegin
   but no TxEnd) is discarded, leaving the FS unchanged.
9. Data blocks are written outside the journal, in arbitrary order, so a
   crash can leave the inode pointing at a block whose data hasn't been
   written yet (garbage in the file). **Ordered journaling** fixes this
   by forcing data writes before metadata commit.
10. A **revoke record** tells recovery to skip replaying any journal
    entry that touches a block marked revoked. It prevents stale
    metadata for a freed-and-reallocated block from overwriting fresh
    user data on replay.

## Sources

- Professor's final-exam review session (2026-04-23): "review has all the
  content that is required", FD/open-file/inode cache emphasis, ch 41
  and 42, 48 pts persistence, 16 pts inconsistency.
- OSTEP chapter 37 (HDDs), 38 (RAID), 40 (file system implementation),
  41 (FFS), 42 (crash consistency and journaling).
- Zhang TA persistence review deck.
- Past midterm 2 I/O count problems.
