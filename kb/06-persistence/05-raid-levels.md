# RAID Levels: Striping, Mirroring, Parity

## Definition

RAID (Redundant Array of Inexpensive Disks) uses multiple drives in parallel to increase capacity, reliability, and performance. RAID-0 stripes data (no redundancy); RAID-1 mirrors (two copies); RAID-4/5 use parity blocks (one parity per stripe, rotated in RAID-5) to tolerate one disk failure. Each level trades capacity, reliability, and write performance differently.

## When to use

- **RAID-0**: Maximum performance and capacity; no fault tolerance needed (temporary data, cache).
- **RAID-1**: High availability with tolerable capacity loss (databases, critical logs); mirrors reads across two disks.
- **RAID-4**: Capacity + reliability; rarely used due to parity disk bottleneck on random writes.
- **RAID-5**: Balanced capacity, reliability, and performance; industry standard for most arrays.

## Key ideas

### RAID-0 (Striping)

Data is split into chunks and distributed round-robin across disks. No parity.

```
Disk 0: Block 0, Block 4, Block 8, ...
Disk 1: Block 1, Block 5, Block 9, ...
Disk 2: Block 2, Block 6, Block 10, ...
Disk 3: Block 3, Block 7, Block 11, ...
```

**Chunk size**: Typically 2 blocks = 8 KB. A stripe is all chunks across all disks in one level.

**Capacity**: N disks → N × full capacity.

**Reliability**: Any disk failure = total data loss.

**Performance**: All disks work in parallel. N × single-disk throughput.

### RAID-1 (Mirroring)

Each block is written to two separate disks (mirror pair).

```
Disk 0: Block 0, Block 1, Block 2, Block 3, ...
Disk 1: Block 0, Block 1, Block 2, Block 3, ...  (identical copy)
```

**Capacity**: N disks → N/2 × capacity.

**Reliability**: Can tolerate up to 1 disk failure per mirror pair.

**Read performance**: Can read from either disk (choose least-busy).

**Write performance**: Must write to both disks (bottleneck at the slower write).

### RAID-4 (Parity)

Data blocks in a stripe, plus one parity block per stripe. Parity = XOR of all data blocks.

```
Disk 0: Block 0, Block 4, Block 8, ...
Disk 1: Block 1, Block 5, Block 9, ...
Disk 2: Block 2, Block 6, Block 10, ...
Disk 3: Block 3, Block 7, Block 11, ...
Disk 4: Parity0 (=0^1^2^3), Parity1, Parity2, ...  (all parity blocks on one disk)
```

**Capacity**: N disks → (N-1) × capacity.

**Reliability**: Can tolerate 1 disk failure (recover lost blocks using parity).

**Recovery**: If block X is lost, X = Parity XOR (all other blocks in stripe).

**Small-write problem**: Random write to block X requires:
1. Read old X and old Parity
2. Compute new Parity = old Parity XOR old X XOR new X
3. Write new X and new Parity to disk

Both writes go to the same parity disk. With N disks receiving random writes, only one (the parity disk) gets all the write traffic. Throughput degrades to R/2 (R = random read rate).

### RAID-5 (Rotating Parity)

Like RAID-4, but parity blocks rotate across all disks, eliminating the bottleneck.

```
Disk 0: Block 0, Block 5, Block 10, ...
Disk 1: Block 1, Block 6, Parity2, ...
Disk 2: Block 2, Parity1, Block 11, ...
Disk 3: Parity0, Block 7, Block 12, ...
Disk 4: Block 4, Block 9, Block 13, ...
```

**Capacity**: Same as RAID-4 (N-1) × capacity.

**Reliability**: Same as RAID-4 (1 disk failure).

**Write performance**: Random writes spread across all disks. Each disk handles 1/N of the parity write load. Throughput ≈ (N/4) × R.

### XOR Parity Calculation

```
parity = block_1 XOR block_2 XOR block_3 XOR block_4

Example (bit-by-bit):
block_1 = 0011
block_2 = 0101
block_3 = 1100
block_4 = 1010
parity  = 0011 XOR 0101 XOR 1100 XOR 1010
        = 0110 XOR 1100 XOR 1010
        = 1010 XOR 1010
        = 0000

Recovery (if block_2 lost):
block_2 = parity XOR block_1 XOR block_3 XOR block_4
        = 0000 XOR 0011 XOR 1100 XOR 1010
        = 0011 XOR 1100 XOR 1010
        = 1111 XOR 1010
        = 0101  ✓
```

## Pseudocode

### RAID-5 Small Write (Subtractive Parity)

```c
void raid5_small_write(int stripe, int block, byte* new_data) {
    // Read old block and old parity from different disks
    byte* old_block = read_block(stripe, block);
    byte* old_parity = read_parity(stripe);
    
    // Compute new parity without reading entire stripe
    byte* new_parity = xor_bytes(old_parity, old_block, new_data);
    
    // Write new block and new parity
    write_block(stripe, block, new_data);
    write_parity(stripe, new_parity);
}

byte* xor_bytes(byte* parity, byte* old, byte* new) {
    byte* result = malloc(block_size);
    for (int i = 0; i < block_size; i++) {
        result[i] = parity[i] ^ old[i] ^ new[i];
    }
    return result;
}
```

### RAID-5 Recovery (Single Disk Failure)

```c
byte* recover_failed_block(int stripe, int failed_disk) {
    byte* recovered = calloc(block_size, 1);  // All zeros
    
    // XOR all surviving blocks and parity
    for (int i = 0; i < num_disks; i++) {
        if (i == failed_disk) continue;  // Skip failed disk
        byte* block = read_block_from_disk(i, stripe);
        for (int j = 0; j < block_size; j++) {
            recovered[j] ^= block[j];
        }
    }
    
    return recovered;  // recovered = all_others XOR failed_data
}
```

## Hand-trace example

### RAID-5 Stripe Example (5 disks)

Data: 4 blocks + 1 parity per stripe. Chunk size = 2 blocks = 8 KB.

Stripe 0:
```
Disk 0: Block 0    (8 KB)
Disk 1: Block 1    (8 KB)
Disk 2: Block 2    (8 KB)
Disk 3: Block 3    (8 KB)
Disk 4: Parity0    (parity = 0 XOR 1 XOR 2 XOR 3)
```

Stripe 1:
```
Disk 0: Block 5    (8 KB)
Disk 1: Block 6    (8 KB)
Disk 2: Block 7    (8 KB)
Disk 3: Parity1    (parity = 5 XOR 6 XOR 7 XOR 8)
Disk 4: Block 8    (8 KB)
```

### RAID-0, RAID-1, RAID-4, RAID-5 Performance Comparison (N=5 disks)

| Metric | RAID-0 | RAID-1 | RAID-4 | RAID-5 |
|---|---|---|---|---|
| **Capacity** | 5C | 2.5C | 4C | 4C |
| **Reliability** | 0 (any fail = loss) | 1 (one mirror pair) | 1 (one parity) | 1 (one parity) |
| **Seq Read** | 5S MB/s | 5S/2 MB/s | 4S MB/s | 4S MB/s |
| **Seq Write** | 5S MB/s | 5S/2 MB/s | 4S MB/s | 4S MB/s |
| **Random Read** | 5R MB/s | 5R MB/s | 4R MB/s | 5R MB/s |
| **Random Write** | 5R MB/s | 5R/2 MB/s | R/2 MB/s | 5R/4 MB/s |
| **Latency (read)** | D ms | D ms | D ms | D ms |
| **Latency (write)** | D ms | 2D ms | 2D ms | 2D ms |

**Key insight**: RAID-5 random write is 5R/4 vs. RAID-4's R/2 (2.5x better) because parity disk load is distributed.

### Crash Scenario: Disk 2 fails in Stripe 0

```
Before failure:
Disk 0: Block 0
Disk 1: Block 1
Disk 2: Block 2
Disk 3: Block 3
Disk 4: Parity0

After Disk 2 fails:
Disk 0: Block 0      (survives)
Disk 1: Block 1      (survives)
Disk 2: ???          (FAILED)
Disk 3: Block 3      (survives)
Disk 4: Parity0      (survives)

Recovery:
Block 2 = Parity0 XOR Block 0 XOR Block 1 XOR Block 3
```

Write this recovered block back to Disk 2 after replacement.

## Common exam questions

- **MCQ:** A RAID-5 array has 8 disks, each 2 TB. What is the usable capacity and how many simultaneous disk failures can it tolerate?
  - [x] 14 TB usable, 1 failure tolerated
  - [ ] 16 TB usable, 1 failure tolerated
  - [ ] 8 TB usable, 2 failures tolerated
  - [ ] 14 TB usable, 2 failures tolerated
  - why: RAID-5 uses (N-1) disks of data capacity = 7 * 2 TB = 14 TB, and tolerates one disk failure via distributed parity.

- **MCQ:** Why does RAID-4 suffer a small-write bottleneck that RAID-5 avoids?
  - [x] RAID-4 concentrates all parity on one disk, so every random write hits it; RAID-5 rotates parity across all disks
  - [ ] RAID-4 has no parity at all
  - [ ] RAID-5 mirrors every block to reduce writes
  - [ ] RAID-4 uses larger chunks that stall the bus
  - why: With a dedicated parity disk, that disk receives every parity update and becomes the throughput ceiling; rotating parity spreads the load.

- **MCQ:** A 4-disk RAID-0 with single-disk rates of 100 MB/s sequential and 10 MB/s random delivers what aggregate throughput?
  - [x] 400 MB/s sequential, 40 MB/s random
  - [ ] 100 MB/s sequential, 10 MB/s random
  - [ ] 400 MB/s sequential, 10 MB/s random
  - [ ] 200 MB/s sequential, 20 MB/s random
  - why: RAID-0 stripes across all N disks, so both workloads scale linearly with N when there is no redundancy overhead.

- **MCQ:** In a 4-block stripe A, B, C, D with parity P (RAID-4), disk holding B fails. Which formula recovers B?
  - [x] B = P XOR A XOR C XOR D
  - [ ] B = A XOR C XOR D
  - [ ] B = P AND (A XOR C XOR D)
  - [ ] B = P XOR (A + C + D)
  - why: XOR parity is invertible: XORing all surviving blocks plus parity yields the missing block.

- **MCQ:** Why is RAID-1 random read throughput 2R on a mirrored pair but random write only R (per pair)?
  - [x] Reads can be serviced by either mirror in parallel, but each write must update both disks
  - [ ] Writes use parity which is slower
  - [ ] Reads bypass the disk cache
  - [ ] Mirrors can only read one block at a time
  - why: Both drives store the same data, so independent reads double; writes require two disk operations to keep mirrors in sync.

- **MCQ:** Capacity utilization comparison at N=4: which ordering is correct?
  - [x] RAID-0 (100%) > RAID-5 (75%) > RAID-1 (50%)
  - [ ] RAID-1 (100%) > RAID-5 (75%) > RAID-0 (50%)
  - [ ] All three offer identical 75% usable capacity
  - [ ] RAID-5 (100%) > RAID-0 (75%) > RAID-1 (50%)
  - why: RAID-0 has no redundancy (full capacity), RAID-5 loses 1 disk to parity ((N-1)/N = 3/4), RAID-1 mirrors so half is redundant.

- **MCQ:** During a RAID-5 rebuild after one disk fails, which statement about I/O is correct?
  - [x] Every surviving disk is read in full, while the replacement is written, so I/O is read-heavy across survivors
  - [ ] Only parity blocks need to be read
  - [ ] Only the replacement disk receives I/O
  - [ ] Rebuild is entirely sequential on the failed disk only
  - why: To reconstruct each lost block the array XORs the corresponding stripe on all remaining disks; this puts sustained read load on survivors and sequential writes on the new disk.

## Gotchas

- **RAID-4 vs. RAID-5 write throughput**: RAID-4 random write = R/2 (parity disk is bottleneck). RAID-5 random write = NR/4 (parity load spread). Don't confuse with read throughput.
- **Latency vs. throughput**: RAID-5 write latency is still 2D (read old block + parity, then write new block + parity). Throughput improves, but not latency.
- **Parity XOR is commutative**: block1 XOR block2 XOR parity = block1 XOR parity XOR block2. Order doesn't matter.
- **Chunk size impact**: Small chunks increase parallelism but increase seek/positioning overhead. Large chunks improve sequential throughput but reduce random I/O parallelism.
- **Rebuilding after failure**: RAID-5 rebuild reads all surviving disks (huge I/O load) and writes to the replacement disk. A second failure during rebuild = total loss.

## Sources

- lectures__Week12_1.txt: RAID 0/1/4/5 definitions, striping, mirroring, parity, XOR, small-write problem, rotating parity, chunk size (2 blocks = 8 KB example), performance table (capacity, reliability, seq R/W, random R/W, latency), RAID-4 vs RAID-5 random write throughput (R/2 vs. NR/4).
