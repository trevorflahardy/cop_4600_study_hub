# Revoke Records and Block Reuse: The Subtle Crash Case

## Definition

When a filesystem block (metadata or data) is freed and immediately reallocated to a different file, a crash during journaling can cause old metadata to be replayed over new user data, corrupting it. **Revoke records** are special journal entries that mark blocks as "should not be replayed" even if they appear in earlier committed transactions. This prevents the corruption scenario.

## When to use

- **Understanding journaling complexity**: Why journaling requires careful handling of freed blocks.
- **Real-world filesystem bugs**: Ext3 had bugs related to revoke records; ext4 and btrfs address this.
- **Block allocation safety**: Why reusing blocks requires coordinating with journaling.

## Key ideas

### The Block Reuse Problem

**Scenario**:
```
1. Directory "foo" with metadata at block 1000
2. Delete directory "foo"; block 1000 is freed
3. Allocate file "bar"; reuse block 1000 for "bar"'s data
4. Crash occurs; old transaction still in journal pointing to block 1000
5. Recovery replays old transaction
6. Old directory metadata is written to block 1000, corrupting "bar"'s data
```

### Example: Directory to File Reuse

**Timeline**:

```
t0: Filesystem state
    Block 1000: Directory "foo" metadata
    Journal: (empty)

t1: Delete "foo", free block 1000
    Block 1000: (freed, garbage data)
    Journal: TxB [update inode for /] TxE ← committed, block 1000 NOT in journal

t2: Create file "bar", allocate block 1000
    Block 1000: "bar"'s data written
    Journal: TxB [inode for /] TxE ← committed

t3: **CRASH** (block 1000 still in memory, not yet checkpointed)

t4: Recovery:
    Scan journal for committed transactions
    
    Problem: Is block 1000 still referenced by old "foo" metadata transaction?
    If old transaction wrote block 1000 as directory data, replaying it corrupts "bar"!
```

**Concrete Example from Ext3**:

```
Transaction 1 (old, committed, still in journal):
  TxB id=1
  [Directory D[foo] metadata, stored at block 1000]
  TxE id=1

After transaction 1 checkpoint:
  Block 1000 on disk contains directory data for "foo"
  Journal space for tx1 marked as "reusable" (but not yet overwritten)

Later:
Transaction 2: Delete "foo", free block 1000
  Block 1000: freed, marked in bitmap as free
  Journal: TxB [delete "foo" transaction] TxE (no block 1000 in this transaction)

Transaction 3: Create "bar", allocate block 1000
  Block 1000: written with "bar"'s content
  Journal: TxB [inode update for /] TxE (block 1000 NOT logged)

Crash before checkpoint:
  - Old transaction 1 still in log (never freed from journal)
  - Recovery replays transaction 1
  - Replayed block 1000 is now directory data, overwriting "bar"'s data
  - **CORRUPTION**
```

### Revoke Records

A **revoke record** is a journal entry marking a block as "revoked" (should not be replayed).

```
Revoke record structure:
  [REVOKE BLOCK 1000]  // Don't replay block 1000 even if in earlier tx
```

**Updated Timeline with Revoke**:

```
Transaction 1 (old):
  TxB id=1
  [Directory D[foo] at block 1000]
  TxE id=1

(Checkpoint 1 completes)

Transaction 2 (delete "foo"):
  TxB id=2
  [inode update]
  [REVOKE BLOCK 1000]  ← Mark block 1000 as revoked
  TxE id=2

(Checkpoint 2 completes)

Transaction 3 (create "bar"):
  TxB id=3
  [inode update]
  [block 1000 new data for "bar"]
  TxE id=3

Crash before checkpoint 3:
  
Recovery:
  - Replay transaction 1: Write block 1000 (directory data)
  - Replay transaction 2: Read revoke record (REVOKE BLOCK 1000)
  - Skip replaying old block 1000 from transaction 1 (revoked!)
  - Replay transaction 3: Write block 1000 (bar's data)
  
Result: Block 1000 contains "bar"'s data (correct!)
```

### Recovery Algorithm with Revokes

```
Step 1: Scan journal, collect all revoke records (building a revoke set)
Step 2: Replay transactions
        For each block in transaction:
          if (block in revoke_set) {
              skip replaying this block
          } else {
              replay block
          }
```

## Pseudocode

### Adding Revoke Records During Free

```c
void free_block(uint32_t block_num) {
    // Mark block as free in bitmap
    bitmap[block_num / 8] &= ~(1 << (block_num % 8));
    
    // Add revoke record to current transaction
    struct revoke_record revoke = {.block = block_num};
    current_transaction->add_revoke(revoke);
    
    // When transaction commits:
    // journal_write(TxB)
    // journal_write(all_blocks)
    // journal_write(all_revoke_records)  ← CRITICAL: after all blocks!
    // journal_write(TxE)
}
```

### Recovery with Revoke Set

```c
int recover_with_revokes(char* journal_file) {
    // Step 1: Build revoke set
    set<uint32_t> revoke_set;
    
    // First pass: collect all revoke records
    for_each_transaction(transaction) {
        for_each_block(transaction->blocks) {
            struct block* blk = load_block();
            if (is_revoke_record(blk)) {
                struct revoke_record* revoke = (struct revoke_record*) blk;
                revoke_set.insert(revoke->block);
            }
        }
    }
    
    // Step 2: Replay transactions, respecting revokes
    for_each_transaction(transaction) {
        if (!is_committed(transaction)) continue;  // TxE found
        
        for_each_block(transaction->blocks) {
            struct block* blk = load_block();
            
            if (is_revoke_record(blk)) {
                // Skip revoke records in replay
                continue;
            }
            
            if (revoke_set.contains(blk->block_num)) {
                // This block was revoked; don't replay
                printf("Skipping block %d (revoked)\n", blk->block_num);
                continue;
            }
            
            // Replay the block
            disk_write_block(blk->block_num, blk->data);
        }
    }
    
    return 0;
}
```

### Freeing Blocks (with Revoke)

```c
void unlink_file(char* path) {
    struct inode* inode = path_to_inode(path);
    
    // Decrement link count
    inode->nlink--;
    
    if (inode->nlink == 0) {
        // Free all data blocks
        for (int i = 0; i < inode->num_blocks; i++) {
            uint32_t block = inode->block[i];
            
            // Mark as free and add revoke
            free_block(block);  // Calls add_revoke internally
        }
        
        // Free inode
        free_inode(inode->ino);
    }
}
```

## Hand-trace example

### Block Reuse Scenario: Directory → File

**Initial state**:
```
Inode 10 (directory /foo):
  Block pointer: 1000
  Size: 4 KB

Block 1000 content: [Directory entries for /foo]
```

**Transaction A** (in journal, already committed):
```
TxB id=100
  [Inode 10 (pointing to block 1000)]
  [Data block 1000 (directory)]
TxE id=100
```

**Transaction B** (delete /foo):
```
TxB id=101
  [Inode 2 (root, updated)]
  [REVOKE BLOCK 1000]
TxE id=101
```

After transaction B checkpoint: inode 10 freed, block 1000 freed.

**Transaction C** (create /bar, using block 1000):
```
TxB id=102
  [Inode 11 (file /bar, points to block 1000)]
  [Data block 1000 ("file data for /bar")]
TxE id=102
```

**Crash before checkpoint C**:

**Recovery without revokes** (BUGGY):
```
Replay transaction A:
  - Write inode 10 (directory)
  - Write block 1000 (directory data) ← CORRUPTS block 1000!

Replay transaction B:
  - Write inode 2 (updated root)
  - (No revoke records processed)

Replay transaction C:
  - Write inode 11
  - Write block 1000 (file data) ← Overwritten again?

Result: Block 1000 is corrupted (was directory, then file)
```

**Recovery with revokes** (CORRECT):
```
Build revoke set:
  - From transaction B: REVOKE BLOCK 1000
  - revoke_set = {1000}

Replay transaction A:
  - Write inode 10
  - Check block 1000: in revoke_set? YES → SKIP replaying block 1000

Replay transaction B:
  - Write inode 2
  - Block 1000 is a revoke record → skip

Replay transaction C:
  - Write inode 11 (file /bar)
  - Write block 1000 (file data) ← Correct, not corrupted

Result: Block 1000 contains /bar's data (correct!)
```

## Common exam questions

- **MCQ:** What is the "block reuse" corruption scenario that revoke records prevent?
  - [x] Old metadata from a committed transaction is replayed over a block that has since been reused as user data
  - [ ] Two processes writing the same file simultaneously
  - [ ] An inode whose nlink overflows
  - [ ] A data block that cannot be read due to disk error
  - why: Without revokes, replay can reinstate an old directory block over a new data block, clobbering the reallocated contents.

- **MCQ:** When is a revoke record added to the journal?
  - [x] When a block that had metadata written by earlier transactions is freed, so future replay will skip it
  - [ ] Whenever a block is read
  - [ ] Whenever a file is opened
  - [ ] Whenever the journal is rotated
  - why: Freeing a block is the moment at which future replay of old transactions becomes dangerous; the revoke flags the block as "do not replay."

- **MCQ:** During recovery, when must revoke records be processed relative to replay?
  - [x] First: build the revoke set, then replay transactions skipping revoked blocks
  - [ ] After replay, to undo mistakes
  - [ ] Interleaved with replay, randomly
  - [ ] Only if FSCK fails
  - why: Revokes must be known up front; otherwise replay could already write an old version of a revoked block before the revoke is seen.

- **MCQ:** Block 1000 appears in transaction 1 (old metadata) and is revoked in transaction 2; transaction 3 writes new file data at block 1000. After recovery, what does block 1000 contain?
  - [x] Transaction 3's new file data (transaction 1's version is skipped due to revoke)
  - [ ] Transaction 1's old metadata
  - [ ] Mixed bytes from both transactions
  - [ ] Zeroes
  - why: The revoke suppresses replay of block 1000 from transaction 1; transaction 3's write is the only version applied to that block.

- **MCQ:** Revoke records completely solve all crash-consistency problems.
  - [x] False: they address the block-reuse corner case only; ordered data journaling and careful replay are still required
  - [ ] True for all filesystems
  - [ ] True only for ext4
  - [ ] False because revokes are deprecated
  - why: Revokes are one specific fix; broader consistency still relies on write ordering and transaction commit semantics.

- **MCQ:** Why must revoke records be logged in the SAME transaction that frees the block, not a later one?
  - [x] A crash between the free and a later revoke would lose the revoke, allowing corrupting replay
  - [ ] The journal format disallows cross-transaction revokes
  - [ ] Revokes are immutable after creation
  - [ ] Revokes consume the same slot as TxE
  - why: Atomicity of the free + revoke pair must match atomicity of the transaction that performs the free; otherwise the journal can diverge from the FS's actual state.

- **MCQ:** Deleting a file vs. freeing its blocks, from the journal's viewpoint, differs because:
  - [x] Deleting removes the directory entry and inode; freeing blocks may produce revoke records to guard against stale replay
  - [ ] They are the same operation
  - [ ] Deletion never touches the journal
  - [ ] Freeing blocks bypasses the journal entirely
  - why: Block freeing is the source of the reuse corner case; revokes accompany freed blocks to keep future recovery safe.

## Gotchas

- **Revoke order**: Revoke records must be added AFTER all data blocks in a transaction. If a revoke is written before a data block, the data block might be replayed (wrong).
- **Multiple transactions**: If a block is freed in tx2 and reallocated in tx3, the revoke from tx2 must prevent replaying any old transaction that wrote to that block.
- **Not foolproof**: Revoke records prevent one class of corruption, but don't guarantee all metadata is safe. Ordered journaling is still needed.
- **Performance cost**: Adding revoke records for every freed block increases journal size and CPU overhead.
- **Ext4 optimization**: Ext4 uses "fast commits" and extents, reducing the need for revokes in many cases.

## Sources

- lectures__Week14_1.txt: Tricky case of block reuse (free directory block, reallocate as user data, crash, replay stale metadata corrupts user data), revoke records (written during free to prevent replay of stale blocks), recovery skips revoked blocks, Ext2 vs. Ext3 comparison (Ext3 adds journaling with revoke handling).
