# Journaling Modes: Data, Metadata, Ordered

## Definition

Journaling (write-ahead logging) writes a description of pending updates to a journal (log) before applying them to the filesystem. Three modes exist: **data journaling** (log all blocks: data + metadata, slowest), **metadata journaling** (log only metadata, fast but risks dangling pointers), and **ordered journaling** (write data to FS, then log metadata; best compromise). Correct ordering and atomic commit markers ensure fast recovery without full-disk scans.

## When to use

- **Data journaling**: Highest safety; maximum corruption resistance. Suitable for critical data (databases, banks).
- **Ordered journaling**: Common default (ext3, ext4 with data=ordered). Good balance of safety and performance.
- **Metadata journaling**: High performance; acceptable for cache data or non-critical files.

## Key ideas

### Data Journaling

**Protocol**:
1. Write data blocks, metadata blocks, transaction begin/end to journal.
2. Commit transaction (write transaction end block to disk).
3. Checkpoint: write data and metadata to their final FS locations.
4. Free journal space (update journal superblock).

**Example**: Append 4 KB to a file.

```
Journal write: TxB | I[v2] | B[v2] | Db | TxE
               (tid=1)  (inode updates)  (new data) (tid=1)

Checkpoint: Write I[v2], B[v2], Db to final locations in FS

Recovery: Scan journal for TxE; if found, replay transaction (re-write FS blocks)
```

**I/O Cost**: 
- Write to journal: 1 data block + 1 inode + 1 bitmap + 2 transaction markers = 5 blocks
- Checkpoint: 1 inode + 1 bitmap + 1 data block = 3 blocks
- Total: 8 I/O operations (vs. 3-5 without journaling, but **much safer**)

**Crash safety**:
- Crash before journal commit: Transaction not in log; no replay. Old data unchanged.
- Crash after commit, before checkpoint: Transaction in log with TxE; replay during recovery.
- Crash after checkpoint: Replay is idempotent (writing same blocks again is safe).

### Metadata Journaling

**Protocol**:
1. Write data blocks directly to FS (skip journal).
2. Write metadata to journal.
3. Commit transaction (write transaction end marker).
4. Checkpoint metadata to FS.
5. Free journal space.

**Example**: Append 4 KB to a file.

```
Data write: Db → FS block (directly, no journal)
Journal write: TxB | I[v2] | B[v2] | TxE
               (metadata only)
Checkpoint: Write I[v2], B[v2] to FS
```

**I/O Cost**: 
- Data write: 1 data block (direct to FS)
- Journal: 4 blocks (metadata + markers)
- Checkpoint: 2 blocks
- Total: 7 I/O operations (1 less than data journaling)

**Crash Risk**:
- Crash between data write and inode update: Block written, inode not updated yet.
  - If inode points to old block: data written but not reflected in FS (orphaned).
  - If inode not updated before crash: data is lost (OK, just lost write).

### Ordered Journaling

**Protocol**:
1. Write data blocks directly to FS.
2. Wait for data write to complete.
3. Write metadata to journal.
4. Commit transaction.
5. Checkpoint metadata.

**Example**: Append 4 KB to a file.

```
Data write: Db → FS (wait for completion)
Journal write: TxB | I[v2] | B[v2] | TxE (after data is safe)
Checkpoint: Write I[v2], B[v2]
```

**Key Insight**: Data is written to FS **before** metadata is logged. If crash occurs before metadata journal entry:
- Data is on disk (safe).
- Inode doesn't point to it yet (orphaned block, but not corrupted).

**I/O Cost**:
- Data write: 1 data block
- Journal: 4 blocks
- Checkpoint: 2 blocks
- Total: 7 I/O operations (same as metadata journaling, but **safer**)

**Crash Risk**: Minimal (only orphaned blocks, not corruption).

### Comparison Table

| Aspect | Data Journaling | Metadata Journaling | Ordered Journaling |
|---|---|---|---|
| **Logged** | All blocks (data + metadata) | Metadata only | Metadata only |
| **I/O Count** | ~8 I/Os per operation | ~7 I/Os | ~7 I/Os |
| **Performance** | Slowest | Fast | Medium |
| **Crash Safety** | Highest (no garbage reads) | Medium (may orphan blocks) | High (no corruption) |
| **Corruption Risk** | None | Low (only orphaned blocks) | Low (only orphaned blocks) |
| **Recovery Time** | Replay committed transactions | Replay committed transactions | Replay committed transactions |

### Transaction Structure

```
TxB: Transaction begin block (contains transaction ID, timestamp)
     [tid=1, timestamp=12345, num_blocks=4]

Blocks: Data and/or metadata blocks
        [inode update] [bitmap update] [data block] [...more blocks]

TxE: Transaction end block (contains transaction ID)
     **CRITICAL**: Only 512 bytes (one disk sector)
     [tid=1] (must match TxB)
     
Disk guarantee: 512-byte writes are atomic.
So TxE atomicity is guaranteed by disk hardware.
```

## Pseudocode

### Data Journaling Write

```c
int write_data_journaling(struct inode* inode, byte* data) {
    // Phase 1: Journal write
    uint32_t tid = allocate_transaction_id();
    
    // Write transaction begin
    struct tx_begin_block txb = {.tid = tid, .num_blocks = 4};
    journal_write(txb);
    
    // Write inode (updated version)
    inode->size += 4096;
    journal_write(*inode);
    
    // Write bitmap (data block allocated)
    byte* bitmap = read_data_bitmap();
    uint32_t free_block = find_free_block(bitmap);
    bitmap[free_block / 8] |= (1 << (free_block % 8));
    journal_write(bitmap);
    
    // Write data
    journal_write(data);
    
    // Write transaction end (CRITICAL: must be atomic 512 bytes)
    struct tx_end_block txe = {.tid = tid};
    journal_write_and_wait(txe);  // Wait for disk completion
    
    // Phase 2: Checkpoint
    disk_write_inode(inode);
    disk_write_bitmap(bitmap);
    disk_write_block(free_block, data);
    disk_wait();
    
    // Phase 3: Free
    free_journal_space(tid);
    
    return 0;
}
```

### Ordered Journaling Write

```c
int write_ordered_journaling(struct inode* inode, byte* data) {
    // Phase 1: Write data to FS first
    uint32_t free_block = find_free_block();
    disk_write_block(free_block, data);
    disk_wait();  // Ensure data is on disk
    
    // Phase 2: Journal write (metadata only, data already safe)
    uint32_t tid = allocate_transaction_id();
    
    struct tx_begin_block txb = {.tid = tid, .num_blocks = 3};
    journal_write(txb);
    
    inode->size += 4096;
    inode->block[...] = free_block;
    journal_write(*inode);
    
    byte* bitmap = read_data_bitmap();
    bitmap[free_block / 8] |= (1 << (free_block % 8));
    journal_write(bitmap);
    
    struct tx_end_block txe = {.tid = tid};
    journal_write_and_wait(txe);  // Atomic 512-byte write
    
    // Phase 3: Checkpoint
    disk_write_inode(inode);
    disk_write_bitmap(bitmap);
    
    // Phase 4: Free
    free_journal_space(tid);
    
    return 0;
}
```

## Hand-trace example

### Data Journaling vs. Ordered Journaling: Crash at Different Points

**Scenario**: Append 4 KB to file. Data block = 500, inode = 10, bitmap change: mark block 500 as allocated.

**Data Journaling**:

```
Time  Action                           Journal         FS Inode   FS Block 500   FS Bitmap
0     Journal TxB, I, B, Data, TxE    [TxB...TxE]     (stale)    (stale)        (free)
1     **CRASH**                       [TxB...TxE]     (stale)    (stale)        (free)
      Recovery: Replay TxB→TxE, write FS blocks
      Result: Data persisted, FS consistent ✓
```

**Ordered Journaling**:

```
Time  Action                           Data FS    Journal         FS Inode   FS Bitmap
0     Write block 500 ("new data")    WRITTEN    (empty)         (stale)    (free)
1     Journal TxB, I, B, TxE          WRITTEN    [TxB...TxE]     (stale)    (free)
2     **CRASH**                       WRITTEN    [TxB...TxE]     (stale)    (free)
      Recovery: Replay TxB→TxE
      After replay: Inode + bitmap updated, block 500 already written ✓
      Result: Data + metadata persisted, FS consistent ✓
```

**Metadata Journaling** (with data write before journal):

```
Time  Action                           Data FS    Journal        FS Inode   FS Bitmap
0     Write block 500 ("new data")    WRITTEN    (empty)        (stale)    (free)
1     **CRASH** (before journal)      WRITTEN    (empty)        (stale)    (free)
      Recovery: No journal entry → no replay
      Result: Data block orphaned (allocated on disk but not in inode)
      FSCK will find block 500 allocated but unclaimed → orphan
```

### Recovery Time Comparison

**FSCK** (no journal):
- Must scan entire filesystem (millions of inodes, billions of blocks)
- Time: hours on large disks

**Journaling** (data/metadata/ordered):
- Scan only journal (typically 128 MB to 1 GB)
- Replay committed transactions (fast)
- Time: seconds to minutes

Example: 10 TB disk with 10 million files.
- FSCK: 4-8 hours
- Journaling: 30 seconds

## Common exam questions

- **MCQ:** What is written to the journal in data journaling vs. metadata journaling?
  - [x] Data journaling logs both data and metadata; metadata journaling logs only metadata (data goes directly to FS)
  - [ ] Both log only data blocks
  - [ ] Data journaling logs only inodes
  - [ ] Metadata journaling logs the full filesystem
  - why: The log's scope is what differentiates the modes; data journaling is safest but doubles the write load.

- **MCQ:** Ordered journaling writes data to the filesystem BEFORE logging metadata. Why?
  - [x] To ensure metadata, once replayed, never points at stale/garbage data
  - [ ] To cut journal size in half
  - [ ] Because data writes are cheaper than metadata writes
  - [ ] To avoid updating the inode at all
  - why: If metadata could reach disk before data, a post-crash inode might reference unwritten blocks (garbage); ordering prevents that corruption.

- **MCQ:** In metadata journaling (unordered), a crash happens between the data write and the metadata log. What is the possible outcome?
  - [x] Stale-before-new: a just-written data block may be referenced by old metadata, producing corruption
  - [ ] The filesystem is always consistent
  - [ ] The journal replay recovers the data automatically
  - [ ] Only fsck can detect it, never recover
  - why: Without ordering, metadata and data writes can race; a crash may surface inconsistencies that ordered journaling avoids.

- **MCQ:** Which journaling mode is safest from data corruption, at the cost of double writes?
  - [x] Data journaling
  - [ ] Metadata (writeback) journaling
  - [ ] Ordered journaling
  - [ ] No journaling
  - why: Logging every data block means replay can always restore the committed state; the tradeoff is roughly 2x write I/O.

- **MCQ:** Why must the TxE (transaction-end) block be exactly one 512-byte sector?
  - [x] Disks guarantee atomic writes only at sector granularity, so the marker is either fully present or fully absent
  - [ ] The journal format mandates 512 bytes for compatibility with ext2
  - [ ] Larger writes are slower
  - [ ] TxE must fit into a single DMA transfer
  - why: Recovery depends on an all-or-nothing commit marker; a torn marker would leave recovery ambiguous.

- **MCQ:** A crash occurs AFTER the TxE reaches disk but BEFORE checkpoint completes. What does recovery do?
  - [x] Replay the committed transaction by rewriting its blocks to the filesystem
  - [ ] Skip the transaction; the crash invalidated it
  - [ ] Roll back the transaction
  - [ ] Invoke FSCK on the entire disk
  - why: A present TxE with matching TxB means the transaction was committed; replay is idempotent and brings the FS to the post-transaction state.

- **MCQ:** Which journaling mode would allow stale data to appear in a file after crash recovery?
  - [x] Writeback/metadata journaling, because data writes are not ordered relative to metadata
  - [ ] Ordered journaling
  - [ ] Data journaling
  - [ ] Any mode, equally
  - why: Writeback journaling logs only metadata; with no ordering, the inode can point at a yet-unwritten data block, exposing stale contents.

## Gotchas

- **TxE atomicity**: Only 512-byte writes are guaranteed atomic by disk. If TxE is split across two sectors, a crash mid-write leaves it corrupt. This is why TxE is kept small.
- **Metadata-first pitfall**: Writing inode before data risks dangling pointers (inode → garbage). Metadata journaling avoids this by ensuring data is on FS before logging metadata update.
- **Circular journal**: The journal is finite (e.g., 128 MB). Old transactions must be freed (marked reusable) after checkpoint. If journal fills before FSCK runs, no new transactions can commit.
- **Batching**: Ext3 batches transactions (every 5 seconds) to amortize journal overhead. Frequent `fsync()` defeats batching.
- **Data=journal vs. data=ordered**: Ext3/ext4 mount options control which mode. Default is usually ordered or metadata.

## Sources

- lectures__Week14_1.txt: Journaling (write-ahead logging), data journaling (log all blocks, then checkpoint), metadata journaling (log metadata, write data directly), ordered journaling (write data first, then log metadata), TxB/TxE with transaction ID, circular log, journal superblock, 5-second batching, recovery via replay, revoke records.
