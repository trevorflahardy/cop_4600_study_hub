# Journal Transactions and Recovery: Replay and Atomicity

## Definition

A **journal transaction** is a logged group of blocks (data + metadata) bracketed by transaction begin (TxB) and transaction end (TxE) blocks. During recovery after a crash, the OS scans the journal, identifies committed transactions (those with TxE present), and replays them by re-writing the logged blocks to their final filesystem locations. This provides fast recovery (seconds) without FSCK scans (hours).

## When to use

- **Fast recovery after unclean shutdown**: Journaling enables recovery in seconds vs. FSCK's hours.
- **Predictable recovery time**: Independent of filesystem size; depends on journal size.
- **Preventing data loss**: Replay ensures committed transactions reach disk.

## Key ideas

### Transaction Lifecycle

**Before Crash**:
```
Normal execution:
  1. Open/create file operations queued
  2. Every 5 seconds, batch all pending changes into a single transaction
  3. Write TxB | [all blocks] | TxE to journal
  4. **Wait for TxE to reach disk (atomic 512-byte write)**
  5. Checkpoint: write blocks to FS
  6. Free journal space
```

**Crash Points**:
```
Point A: Before TxB
  → Transaction never committed; skip during recovery
  
Point B: Between TxB and TxE
  → Transaction incomplete; skip during recovery (no TxE marker)
  
Point C: At TxE (atomic write, can't be partial)
  → TxE either fully written (1) or not at all (0)
  
Point D: After TxE, before checkpoint
  → Transaction committed (TxE present); replay during recovery
  
Point E: During checkpoint
  → FS blocks partially updated; replay fixes inconsistencies
  
Point F: After checkpoint, before free
  → Recovery deletes journal entry (safe to reuse)
```

### Committed Transaction Identification

A transaction is **committed** if:
1. TxB is present with transaction ID (tid).
2. TxE is present with matching tid.
3. TxE is a complete 512-byte block (disk guaranteed atomic).

**Recovery algorithm**:
```
for each journal entry {
    if (has TxB && has TxE && TxB.tid == TxE.tid) {
        transaction is committed
        replay blocks
    }
}
```

### Recovery Replay

```
For each committed transaction:
  1. Read all logged blocks from journal
  2. Write them back to their FS locations
  3. (Repeat for all committed transactions)
  4. Mark journal space as free (update journal superblock)
```

**Idempotent**: Replaying the same transaction twice is safe (writes same blocks).

**Order-independent**: Transactions can be replayed in any order because later transactions log their own metadata changes.

### Recovery Example

**Journal state after crash**:
```
Journal:
  [TxB id=1] [I[v2]] [B[v2]] [D] [TxE id=1]  ← Committed, will replay
  [TxB id=2] [I[v3]] [B[v3]]                  ← Incomplete (no TxE), skip
  [TxB id=3] [I[v4]] [B[v4]] [TxE id=3]      ← Committed, will replay
```

**Recovery**:
```
Scan journal:
  - Transaction 1: TxB + TxE match (tid=1) → COMMITTED
  - Transaction 2: No TxE → INCOMPLETE (skip)
  - Transaction 3: TxB + TxE match (tid=3) → COMMITTED

Replay:
  - Transaction 1: Write I[v2], B[v2], D to FS
  - Transaction 3: Write I[v4], B[v4] to FS

Result: FS is brought to state as if transactions 1 and 3 had completed normally
```

### Circular Journal Management

The journal is finite (e.g., 128 MB). After checkpoint, journal space must be freed.

```
Journal superblock tracks:
  - tail: start of oldest uncommitted transaction
  - head: end of newest transaction
  - Free space: head to tail (circular)
```

**Problem**: Journal fills before checkpoint completes.

**Solution**: Don't accept new transactions until checkpoint completes.

```c
while (journal_full()) {
    wait_for_checkpoint_completion();
}
```

## Pseudocode

### Recovery: Scanning Journal

```c
int recover_from_journal(char* journal_file) {
    struct journal_superblock* jsb = load_journal_superblock();
    uint32_t tail = jsb->tail;  // Start of journal
    
    // Scan journal entries
    uint32_t pos = tail;
    while (pos < jsb->head) {
        struct tx_begin_block* txb = load_journal_block(pos++);
        
        // Collect blocks until TxE
        list_t logged_blocks;
        while (pos < jsb->head) {
            struct block* blk = load_journal_block(pos);
            
            if (is_transaction_end(blk)) {
                struct tx_end_block* txe = (struct tx_end_block*) blk;
                
                // Check if committed
                if (txb->tid == txe->tid) {
                    printf("Found committed transaction %d\n", txb->tid);
                    
                    // Replay: write all logged blocks to FS
                    for_each(logged_blocks, block) {
                        disk_write_to_fs(block);
                    }
                }
                
                pos++;
                break;  // End of transaction
            } else {
                // Regular data block
                logged_blocks.add(blk);
                pos++;
            }
        }
    }
    
    // Update journal superblock: mark entries as freed
    jsb->tail = jsb->head;
    update_journal_superblock(jsb);
    
    return 0;
}
```

### Committing Transaction

```c
int commit_transaction(list_t pending_blocks) {
    // Allocate transaction ID
    uint32_t tid = allocate_tid();
    
    // Write TxB
    struct tx_begin_block txb = {.tid = tid, .num_blocks = pending_blocks.size()};
    journal_write(txb);
    
    // Write all blocks
    for_each(pending_blocks, block) {
        journal_write(block);
    }
    
    // Write TxE (CRITICAL: must be atomic 512 bytes)
    struct tx_end_block txe = {.tid = tid};
    journal_write_sync(txe);  // WAIT for disk
    
    // Now transaction is committed (TxE on disk)
    // Proceed to checkpoint (best-effort, crash-safe)
    checkpoint(pending_blocks);
    
    // Mark journal space as freed
    free_journal_space(tid);
    
    return 0;
}
```

## Hand-trace example

### Recovery Scenario: Multi-Transaction Journal

**Initial Journal**:
```
Block 0:  [Superblock] tail=1, head=15
Block 1:  [TxB id=1, num_blocks=5]
Block 2:  [Inode 10]
Block 3:  [Bitmap (block 100 allocated)]
Block 4:  [Data block 100]
Block 5:  [TxE id=1]
Block 6:  [TxB id=2, num_blocks=3]
Block 7:  [Inode 11]
Block 8:  [Bitmap (block 101 allocated)]
Block 9:  [TxE id=2]
Block 10: [TxB id=3, num_blocks=2]
Block 11: [Inode 12]
Block 12: [TxE id=3, *PARTIAL WRITE* - only 256 bytes written]
Block 13: [Empty]
Block 14: [Empty]
```

**Crash scenario**: System crashes while writing TxE for transaction 3.

TxE is 512 bytes. Due to disk ordering, only first 256 bytes were written before power loss.

**Recovery**:
```
Scan journal:

Entry 1: TxB id=1 at block 1
  Blocks: 2, 3, 4
  TxE: id=1 at block 5 ✓ MATCH
  → COMMITTED
  Replay: Write inode 10, bitmap, block 100 to FS

Entry 2: TxB id=2 at block 6
  Blocks: 7, 8
  TxE: id=2 at block 9 ✓ MATCH
  → COMMITTED
  Replay: Write inode 11, bitmap to FS

Entry 3: TxB id=3 at block 10
  Blocks: 11
  TxE: id=3 at block 12 ✗ CORRUPTED (only 256 bytes)
  → INCOMPLETE (no valid TxE)
  Skip (don't replay)
  
Result:
  - Transactions 1 and 2 are replayed (on FS)
  - Transaction 3 is discarded (uncommitted)
  - FS is consistent (inode 12 is not updated; data for transaction 3 is lost but safe)
```

**FS State After Recovery**:
```
Inode 10: Updated (transaction 1 committed)
Inode 11: Updated (transaction 2 committed)
Inode 12: NOT updated (transaction 3 incomplete)
Bitmap:   Reflects transactions 1 and 2
```

### Checkpoint During Recovery

Recovery can occur concurrently with checkpoint.

```
Timeline:
t0: Crash occurs (TxE1 written, checkpoint in progress)
t1: Recovery starts, scans journal
t2: Recovery finds TxE1 → committed
t3: Recovery replays blocks from transaction 1
t4: Checkpoint also writing same blocks (or already written)

Replay is idempotent: writing inode 10 twice = writing it once.
No conflict, both are safe.
```

## Common exam questions

1. Explain how the OS identifies a committed transaction in the journal.
2. If a crash occurs during TxE write, can the transaction ever be replayed?
3. Why must TxE be exactly 512 bytes?
4. Compare recovery time: FSCK (full disk scan) vs. journaling (journal scan only).
5. What happens if transaction 1 is replayed, then a crash occurs, then recovery runs again?
6. The journal is full (head == tail). Can a new transaction be committed?
7. After replay, should the journal be cleared (free space)? When?

## Gotchas

- **Replay idempotency**: Replaying a transaction multiple times must produce the same result as replaying it once. This requires careful block address mapping.
- **Incomplete transactions are discarded**: If recovery finds TxB but no matching TxE, the transaction is not replayed. User loses that write (but FS is consistent).
- **TxE atomicity assumption**: Recovery assumes 512-byte TxE is always written atomically (all-or-nothing). If disk doesn't guarantee this, corruption is possible. Modern disks do provide this guarantee.
- **Circular journal wraparound**: If head wraps to the beginning before tail is advanced, old entries are overwritten. Ensure journal is large enough.
- **Metadata-only recovery**: Metadata journaling doesn't guarantee data recovery (data might be partially written). Ordered journaling avoids this.

## Sources

- lectures__Week14_1.txt: Transaction structure (TxB, blocks, TxE), recovery via scanning log and replaying committed transactions, circular log management, journal superblock tracking tail/head, 5-second batching, atomicity of 512-byte TxE block, ext2 vs. ext3 comparison.
