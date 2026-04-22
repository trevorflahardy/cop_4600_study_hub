# Cumulative Persistence Problems

## Overview

This problem set covers disk I/O, scheduling, RAID, the Fast File System (FFS), inode indexing, filesystem journaling, and recovery. Problems include HDD timing calculations, scheduling algorithms, RAID comparisons, inode pointer arithmetic, and transaction replay. These topics dominate the persistence unit of the course and appear frequently on final exams.

## Problem 1: HDD I/O Time Calculation

**Setup:**
A hard disk drive with:
- Average seek time: 4 ms
- Rotational speed: 7200 RPM
- Transfer rate: 100 MB/s
- Request: read a 4 KB block from a random location

**Task:**
1. Calculate the rotational delay (time for half a revolution, worst case).
2. Calculate the transfer time for 4 KB.
3. Calculate the total I/O time for a random read.
4. Estimate the random-read IOPS (I/O operations per second).

**Solution:**

1. **Rotational delay (worst case):**
   - 7200 RPM = 7200 / 60 = 120 revolutions per second
   - Time per revolution = 1000 ms / 120 = 8.33 ms
   - Worst-case rotational delay (half revolution): 8.33 / 2 = 4.17 ms
   - (Typical average delay used in calculations: 4.17 ms)

2. **Transfer time for 4 KB:**
   - 4 KB = 4096 bytes = 0.004 MB
   - At 100 MB/s: 0.004 MB / (100 MB/s) = 0.00004 s = 0.04 ms

3. **Total I/O time:**
   - Seek: 4 ms
   - Rotational: 4.17 ms
   - Transfer: 0.04 ms
   - **Total: 4 + 4.17 + 0.04 = 8.21 ms**

4. **Random-read IOPS:**
   - IOPS = 1 / (8.21 ms) = 1 / 0.00821 s ≈ 121.8 IOPS (roughly 120)

**Why it matters:**
Disk I/O dominates file system performance. Understanding these timings explains why sequential access (one seek, many transfers) is vastly faster than random access. This motivates disk scheduling (SCAN, C-SCAN) and filesystem layouts (FFS cylinder groups).

---

## Problem 2: Optimal Sequential Chunk Size

**Setup:**
A filesystem must balance two overheads when reading large files sequentially:
- Positioning overhead (seek + rotational delay): ~10 ms per request
- Transfer bandwidth: 40 MB/s

Goal: maximize the time spent transferring data relative to positioning overhead.

**Task:**
Calculate the optimal chunk size to achieve 50% of peak bandwidth utilization.

**Solution:**

Peak throughput = 40 MB/s

Utilization = transfer_time / (transfer_time + positioning_time)

For 50% utilization:
transfer_time / (transfer_time + positioning_time) = 0.5
transfer_time = positioning_time

Let chunk_size = C bytes. Then:
transfer_time = C / (40 MB/s) = C / (40 × 10^6 bytes/s)
positioning_time = 10 ms = 0.01 s

Setting them equal:
C / (40 × 10^6) = 0.01
C = 40 × 10^6 × 0.01 = 400,000 bytes = 400 KB

**Verification:**
- Transfer 400 KB at 40 MB/s: 400 KB / (40 MB/s) = 0.01 s = 10 ms
- Positioning: 10 ms
- Utilization: 10 / (10 + 10) = 50%

**Answer: 400 KB (or 409.6 KB if accounting for binary prefixes)**

**Why it matters:**
This calculation shows why filesystems choose specific block/cluster sizes (4 KB base, but prefetch larger chunks). It illustrates the trade-off between I/O overhead and throughput, fundamental to filesystem design.

---

## Problem 3: RAID Comparison

**Setup:**
Compare RAID levels for a 5-disk system (4 data disks + 1 parity/spare, or equivalent).

**Task:**
Create a table comparing RAID 0, RAID 1 (mirroring), RAID 4 (block-level parity), and RAID 5 (striped parity) across these metrics:
- Capacity (fraction of total disk)
- Read bandwidth (relative to single disk)
- Write bandwidth (relative to single disk)
- Reliability (survive how many disk failures?)

**Solution:**

| Metric | RAID 0 | RAID 1 (mirror) | RAID 4 | RAID 5 |
|--------|--------|-----------------|--------|--------|
| **Capacity** | 5/5 (100%) | 2.5/5 (50%) | 4/5 (80%) | 4/5 (80%) |
| **Read BW** | 5x (stripe across all) | 2x (data disks read in parallel) | 4x (parity not read for seq access) | 4x (stripe across 4 disks) |
| **Write BW (large)** | 5x | 2.5x (mirror all writes) | 2x (parity bottleneck: read 4 data + parity, compute, write parity + updated data) | 4x (parity distributed) |
| **Write BW (small, 4KB)** | 5x | 2.5x | 1x (full RMW: read 4 data + parity = 5 reads, compute, write parity + data = 2 writes) | 1x (RMW on 2 disks, but serialized across stripe) |
| **Reliability** | 0 (one disk failure = loss) | 1 disk | 1 disk | 1 disk |

**Detailed explanation:**

- **RAID 0:** Simple striping, no redundancy. Capacity is maximum, but any disk failure is catastrophic. Reads and writes achieve peak bandwidth.

- **RAID 1 (mirroring):** Data duplicated across 2 disks. Capacity halved. Read bandwidth is 2x (both copies read in parallel, or load-balanced). Write bandwidth is 2.5x (you write to 2.5 disks on average? Actually, 2x, because each logical write is mirrored to 2 disks). Survives 1 disk failure per mirror pair.

- **RAID 4 (block-level parity):** One parity disk, 4 data disks. Capacity 80% (4 of 5). Reads from data disks only (4x). Writes require parity computation: read the old data block and old parity block, XOR with new data, write new parity and new data block. Small writes (4 KB) = 2 reads (data + parity) + 2 writes (data + parity) = 4 I/Os. Parity disk becomes a bottleneck (all writes touch it). Large writes = 5 I/Os, but amortized across more data. Survives 1 disk failure.

- **RAID 5 (striped parity):** Parity is distributed across all disks. Capacity 80% (4 of 5). Reads 4x. Writes similar RMW overhead as RAID 4, but parity writes are distributed, so no single bottleneck. Small writes = 4 I/Os. Large writes = distributed, scaling with stripe width. Survives 1 disk failure.

**Why it matters:**
RAID selection depends on the workload. RAID 0 for performance (no redundancy). RAID 1 for safety (expensive in capacity). RAID 4/5 for balanced reliability and performance. RAID 5 is standard in storage arrays because write distribution avoids the parity disk bottleneck.

---

## Problem 4: Fast File System (FFS) Cylinder Groups

**Setup:**
FFS organizes a disk into cylinder groups, each containing:
- Inode bitmap
- Block bitmap
- Inode blocks
- Data blocks

Goal: reduce seek time by co-locating inodes and data.

**Task:**
1. Explain FFS's directory and file block placement strategy.
2. Calculate the seek overhead reduction compared to a naive filesystem.

**Solution:**

1. **FFS placement strategy:**

   **Directory placement:** When creating a new directory, place its inode in the cylinder group with the most free inodes. This spreads directories across the disk, improving parallelism (two directories on two different cylinder groups can be accessed concurrently on different arms).

   **File placement:** When creating a file, place its inode in the same cylinder group as its parent directory (or in a nearby group if the directory's group is full). Place the file's data blocks in the same cylinder group as its inode. This minimizes seeks: to read a file, the inode and data are in the same group.

   **Block allocation:** Within a group, try to place consecutive data blocks together and rotationally optimize (place next block a few sectors ahead, accounting for disk rotation).

2. **Seek reduction example:**

   **Naive filesystem (all inodes at start, all data blocks after):**
   - File 1 inode at disk location 100 (seek time ~ 4 ms to find it)
   - File 1 data at location 1,000,000 (another seek ~ 4 ms to read)
   - Total per file access: 2 × 4 ms = 8 ms (seek) + transfer

   **FFS (co-located):**
   - File 1 inode at cylinder group 5 location 5000
   - File 1 data blocks at cylinder group 5, locations 5100–5103
   - Seek from inode to data: ~0.1 ms (same cylinder group, rotational delay only)
   - Total: 4 ms (initial seek to group) + 0.1 ms (rotational, within group) + transfer

   **Savings:** ~4 ms per file access (elimination of one major seek).

**Why it matters:**
FFS's cylinder-group design demonstrates how filesystem layout directly impacts I/O performance. This principle is used in modern filesystems (ext4, BTRFS). Understanding spatial locality is key to filesystem design.

---

## Problem 5: Inode Indexing and I/O Counts

**Setup:**
An inode with mixed direct and indirect pointers (typical Unix inode):
- 12 direct pointers (blocks 0–11)
- 1 single-indirect pointer (block 12, contains up to 1024 block pointers)
- 1 double-indirect pointer (block 13, contains up to 1024 single-indirect blocks)

Block size: 4 KB. Each block pointer: 4 bytes.

**Task:**
Calculate the number of I/O operations required for these filesystem calls on a newly-created file:

1. `create("/a/b/c")`: create a new file c in directory b (which is in directory a).
2. `write(fd, buffer, 4096)`: write 4 KB to the file (allocating a new block).
3. `write(fd, buffer, 8192)`: write 8 KB to the file (crossing into a second block).

Assume directories are stored in regular file blocks, and all necessary blocks are allocated (disk blocks, inode blocks, bitmap blocks, etc.).

**Solution:**

1. **create("/a/b/c"):**
   Path walk from root:
   - Read root inode: 1 I/O
   - Read root data block (list of directory entries): 1 I/O (find 'a')
   - Read inode for 'a': 1 I/O
   - Read 'a' data block: 1 I/O (find 'b')
   - Read inode for 'b': 1 I/O
   - Read 'b' data block: 1 I/O (find 'c' or prepare for new entry)
   
   Creating 'c':
   - Allocate inode: read inode bitmap, write inode bitmap (1 I/O), write new inode (1 I/O)
   - Update parent 'b' directory block with new entry: 1 I/O (write 'b' data block)
   - Update 'b' inode (size): 1 I/O (write 'b' inode)
   
   **Total: 6 reads (walk) + 5 writes (allocate inode, write inode, update dir, update inode) = 11 I/Os**

   (Simplified estimate: 10 I/Os, depending on whether bitmap updates are counted separately)

2. **write(fd, buffer, 4096):**
   First 4 KB write to the new file (offset 0):
   - Read inode: 1 I/O
   - Allocate block: read block bitmap, write block bitmap (1 I/O)
   - Write data block: 1 I/O
   - Update inode (set direct pointer[0], update size): 1 I/O
   
   **Total: 4 I/Os** (could be 3 if bitmap write is combined)

3. **write(fd, buffer, 8192):**
   Second 4 KB write (offset 4096–8191):
   - Read inode: 1 I/O
   - Allocate block: read block bitmap, write block bitmap (1 I/O)
   - Write data block: 1 I/O
   - Update inode (set direct pointer[1], update size): 1 I/O
   
   **Total: 4 I/Os** (same as above; both writes fit in direct pointers)

   If the second write were at offset 49152 (13th block, requiring single-indirect):
   - Read inode: 1 I/O
   - Allocate indirect block: 1 I/O (bitmap)
   - Write indirect block: 1 I/O
   - Allocate data block: 1 I/O (bitmap)
   - Write data block: 1 I/O
   - Update inode (set single-indirect pointer): 1 I/O
   
   **Total: 6 I/Os**

**Why it matters:**
The I/O cost of filesystem operations is often underestimated. Journaling (covered below) can further amplify these costs by logging operations before execution. Understanding inode structure and the I/O ladder (bitmap, inode, data) is essential for predicting filesystem performance.

---

## Problem 6: Journaling and Crash Recovery

**Setup:**
A filesystem using ordered journaling (data blocks written to disk before metadata is committed to the journal):

**Transaction:** Create file `/test`, 5 KB in size (requires 2 data blocks).

Steps:
1. Write data blocks to disk (off-journal).
2. Write journal metadata: Transaction Begin (TxB), inode pointer update, block pointer updates.
3. Write Transaction End (TxE) to journal.
4. Checkpoint: write inode and data blocks to their home locations.
5. Free journal entries.

**Task:**
1. Describe what happens if the system crashes at each stage.
2. Explain how revoke records prevent replay errors.

**Solution:**

1. **Crash scenarios:**

   **Crash after step 1 (data on disk, before journal TxB):**
   - Data blocks written, but no metadata update yet.
   - No journal entry, so no replay on recovery.
   - Orphaned blocks: they appear free (inode bitmap doesn't reference them), but are lost. No data loss to existing files.

   **Crash after step 2 (TxB and metadata in journal, before TxE):**
   - Journal entry is incomplete (no TxE marker).
   - During recovery, the filesystem scans the journal. Entries without TxE are discarded (not replayed).
   - Data blocks on disk are orphaned (same as crash after step 1).

   **Crash after step 3 (TxE written, before checkpoint):**
   - Journal entry is complete (TxB ... TxE).
   - During recovery, the filesystem replays the transaction: inode pointer update and block allocations.
   - File is now recovered with correct metadata and data. No data loss.

   **Crash after step 4 (checkpoint, before journal free):**
   - Inode and data blocks written to home locations.
   - Journal entry still marked as committed.
   - On recovery, the transaction is replayed (redundantly), which overwrites the home copies with the same data. No corruption (idempotent). Then the journal entry is freed.

   **Crash after step 5 (normal completion):**
   - Everything on disk, journal entry freed.
   - No recovery needed.

2. **Revoke records and crash safety:**

   **Problem scenario:**
   A block at location L originally held directory block D (part of transaction T1). After T1 commits, the block is reused for user data (part of transaction T2). If a crash occurs before T2 is committed but after its data is written to L, recovery would replay T1, overwriting the user data with the stale directory block D.

   **Solution: Revoke record**
   When block L is deallocated in T2 and reused, a revoke record is written to the journal: "do not replay block L from T1." During recovery, the filesystem scans the journal for revoke records. If a revoke is encountered for block L, the corresponding block write in earlier transactions (T1) is skipped, preventing the stale data from being replayed.

   **Recovery algorithm with revoke:**
   1. Scan journal from oldest committed transaction to newest.
   2. Collect all revoked block numbers.
   3. For each committed transaction, replay metadata and data block writes, **skipping** any block in the revoke set.

**Why it matters:**
Journaling is essential for crash recovery and data safety. Understanding ordered vs. full journaling (data or metadata only) and revoke semantics is critical for storage systems. Exams test your ability to trace crash scenarios and explain recovery guarantees.

---

## Problem 7: Filesystem I/O Path for File Operations

**Setup:**
A small file operation sequence on a simple filesystem:

```
fd = open("/data/file.txt", O_CREAT | O_WRONLY);
write(fd, "hello", 5);
close(fd);
```

**Task:**
Trace the I/O operations (reads and writes to disk) for each step, including bitmaps, inodes, and data blocks.

**Solution:**

1. **open("/data/file.txt", O_CREAT | O_WRONLY):**
   - Read root inode: 1 I/O
   - Read root data block: 1 I/O (find 'data')
   - Read 'data' inode: 1 I/O
   - Read 'data' data block: 1 I/O (no 'file.txt' entry yet)
   - Allocate inode: read inode bitmap, write inode bitmap: 1 I/O; write new inode: 1 I/O
   - Update 'data' directory block (add 'file.txt' entry): 1 I/O (write)
   - Update 'data' inode (size): 1 I/O (write)
   
   **Subtotal: 8 I/Os** (4 reads + 4 writes)

2. **write(fd, "hello", 5):**
   The write(2) syscall triggers:
   - Read inode (already in memory, but let's count file-system I/Os): 0 I/Os (cached)
   - Allocate block: read block bitmap, write block bitmap: 1 I/O
   - Write data block: 1 I/O
   - Update inode (set direct pointer, update size): 1 I/O (write)
   
   **Subtotal: 3 I/Os** (1 write bitmap + 1 write data + 1 write inode)

3. **close(fd):**
   - Flush inode to disk: 1 I/O (write, if not already flushed)
   - Or already flushed above
   
   **Subtotal: 0–1 I/O** (assume already flushed in write())

**Total: 8 + 3 + 0 = 11 I/Os** (in the worst case with no caching; typically, the kernel caches bitmaps and inodes, so actual I/Os are fewer)

**Why it matters:**
The I/O cost of filesystem operations is dramatic. A simple 5-byte write requires ~11 disk I/Os (including metadata, allocation, data). This motivates batching, journaling, and writeback caching. Understanding this "I/O amplification" is critical for tuning filesystem performance.

