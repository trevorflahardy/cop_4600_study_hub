# HDD Mechanics and I/O Time Calculation

## Definition

A hard disk drive stores data on rotating magnetic platters. I/O time consists of three components: seek time (moving the head to the correct track), rotational latency (waiting for the desired sector to rotate under the head), and transfer time (reading/writing data). The total time formula is T_I/O = T_seek + T_rotation + T_transfer.

## When to use

- **Performance estimation**: Predict latency for random vs. sequential workloads.
- **Disk scheduling**: Understand why SSTF (Shortest Seek Time First) and SPTF (Shortest Positioning Time First) matter.
- **Cache design**: Decide whether to optimize for sequential or random access.

## Key ideas

### HDD Geometry

**Platter**: Circular aluminum disk coated with magnetic material. Two surfaces per platter; modern drives have 2-4 platters.

**Spindle**: Motor that rotates platters. Modern RPM: 7,200 (Barracuda) to 15,000 (Cheetah 15K.5).

**Track**: Concentric circle of sectors on a platter surface. Head reads/writes as platter rotates.

**Head**: One per platter surface. Attached to arm; moves radially to seek to different tracks.

**Sector**: Smallest addressable unit (512 bytes). 8 sectors per 4 KB block.

### I/O Time Formula

```
T_I/O = T_seek + T_rotation + T_transfer

where:
  T_seek = time for arm to move to track (4-9 ms on modern drives)
  T_rotation = time for sector to rotate under head (avg 50% of one rotation)
  T_transfer = size / transfer_rate (e.g., 4 KB @ 125 MB/s ≈ 32 μs)
```

**Rotation time for full revolution**:
- Cheetah 15K.5: 15,000 RPM → 1 rotation = 60 ms / 15,000 = 4 ms
- Barracuda: 7,200 RPM → 1 rotation = 60 ms / 7,200 ≈ 8.33 ms

**Average rotational latency** (random sector):
- Cheetah: 4 ms / 2 ≈ 2 ms
- Barracuda: 8.33 ms / 2 ≈ 4.2 ms

### Transfer Rate

- Cheetah 15K.5: 125 MB/s
- Barracuda: 105 MB/s

Transfer time for 4 KB: 4 KB / 125 MB/s = 4,096 B / (125 × 10^6 B/s) ≈ 32.8 μs (negligible).

### Track Skew

Sequential reads across track boundaries require the disk to account for head-positioning delays. Without track skew, by the time the head moves to the next track, the desired first sector has already rotated past. Modern disks implement a ~2-sector skew offset.

### Random vs. Sequential Performance Gap

| Workload | Seek | Rotation | Transfer | Total | R_I/O |
|---|---|---|---|---|---|
| **Cheetah 4 KB Random** | 4 ms | 2 ms | 0.03 ms | 6.03 ms | 0.66 MB/s |
| **Cheetah 100 MB Sequential** | 4 ms | 2 ms | 800 ms | 806 ms | 125 MB/s |
| **Barracuda 4 KB Random** | 9 ms | 4.2 ms | 0.04 ms | 13.24 ms | 0.31 MB/s |
| **Barracuda 100 MB Sequential** | 9 ms | 4.2 ms | 950 ms | 963.2 ms | 105 MB/s |

**Key insight**: Random workloads pay the full seek + rotation penalty on every access. Sequential workloads amortize seek + rotation overhead across ~100 MB.

## Pseudocode

### I/O Time Calculator

```c
double calculate_io_time(
    double seek_ms,
    double rpm,
    long bytes,
    double transfer_rate_mb_s
) {
    double rotation_ms = (60.0 / rpm) * 0.5;  // Half rotation on average
    double transfer_ms = (bytes / (transfer_rate_mb_s * 1e6)) * 1000;
    return seek_ms + rotation_ms + transfer_ms;
}

// Usage:
// Cheetah, 4 KB read:
double t = calculate_io_time(4.0, 15000, 4096, 125);  // ~6 ms

// Cheetah, 100 MB read:
double t = calculate_io_time(4.0, 15000, 100*1024*1024, 125);  // ~806 ms
```

## Hand-trace example

### Scenario 1: Random 4 KB read on Cheetah 15K.5

| Phase | Duration | Notes |
|-------|----------|-------|
| Seek to random track | 4 ms | Average seek distance |
| Rotational latency | 2 ms | Avg 50% of one rotation (4 ms / 2) |
| Transfer 4 KB | 0.03 ms | 4096 B / 125 MB/s ≈ 32.8 μs |
| **Total I/O time** | **6.03 ms** | Throughput: 4 KB / 6.03 ms ≈ 0.66 MB/s |

### Scenario 2: Sequential 4 MB read on Cheetah 15K.5

Assume sequential blocks are already on same track (no seeks within run).

| Phase | Blocks | Seeks | Rotation | Transfer | Total |
|-------|--------|-------|----------|----------|-------|
| Block 1 (4 KB) | 1 | 4 ms | 2 ms | 0.03 ms | 6.03 ms |
| Blocks 2-1024 (4 MB - 4 KB, same track) | 1023 | 0 | 0 (track skew compensated) | ~4 MB @ 125 MB/s ≈ 32 ms | 32 ms |
| **Total for 4 MB** | | | | | **38 ms** ≈ 105 MB/s |

**Key observation**: After the first seek + rotation (6 ms), the drive streams at peak bandwidth (125 MB/s). Seek and rotation are amortized.

### Scenario 3: Two random 4 KB reads on Cheetah (SSTF vs. random order)

**Random order** (sectors at track 100, then track 5):
```
Read 1: 4 ms seek to track 100 + 2 ms rotation + 0.03 ms transfer = 6.03 ms
Read 2: 95 tracks seek (4 ms for ~50 tracks; ~8 ms for 95) + 2 ms rotation + 0.03 ms = ~10 ms
Total: ~16 ms
```

**SSTF order** (sectors at track 5, then track 100):
```
Read 1: 4 ms seek to track 5 + 2 ms rotation + 0.03 ms = 6.03 ms
Read 2: 95 tracks seek (~8 ms) + 2 ms rotation + 0.03 ms = ~10 ms
Total: ~16 ms
(Same, but SSTF minimizes future max seek distances)
```

If doing many random reads, SSTF reduces total latency by grouping nearby seeks.

## Common exam questions

- **MCQ:** A disk spins at 10,000 RPM. What is its average rotational latency?
  - [x] 3 ms
  - [ ] 6 ms
  - [ ] 1.5 ms
  - [ ] 10 ms
  - why: One rotation = 60 s / 10000 = 6 ms; average rotational latency is half a rotation = 3 ms.

- **MCQ:** With T_seek = 5 ms, T_rotation = 3 ms, and transfer rate 100 MB/s, what is the total latency for a 1 MB read?
  - [x] About 18 ms
  - [ ] About 10 ms
  - [ ] About 100 ms
  - [ ] About 8 ms
  - why: T_transfer = 1 MB / 100 MB/s = 10 ms; total = 5 + 3 + 10 = 18 ms.

- **MCQ:** A 4 KB random read on a Cheetah 15K.5 (4 ms seek, 15K RPM, 125 MB/s) takes roughly how long?
  - [x] About 6 ms
  - [ ] About 1 ms
  - [ ] About 30 ms
  - [ ] About 60 ms
  - why: 4 ms seek + 2 ms avg rotation (half of 4 ms) + ~32 us transfer ≈ 6 ms, dominated by positioning overhead.

- **MCQ:** Why does sequential access dramatically outperform random access on an HDD?
  - [x] Seek and rotation are paid once and amortized over a large transfer
  - [ ] Sequential access uses DMA while random uses PIO
  - [ ] Rotational latency disappears for sequential workloads
  - [ ] The disk cache doubles in size for sequential reads
  - why: A 100 MB sequential read pays ~6 ms positioning then streams at peak bandwidth; random 4 KB reads pay that 6 ms for every access.

- **MCQ:** Which comparison is correct for 4 KB random read latency on the two drives?
  - [x] Cheetah 15K.5 (~6 ms) is roughly twice as fast as Barracuda (~13 ms)
  - [ ] Barracuda is faster because it has lower transfer rate
  - [ ] Both drives are identical because transfer time is what matters
  - [ ] Cheetah is slower because of higher RPM wear
  - why: Cheetah pays 4 ms seek + 2 ms rotation; Barracuda pays 9 ms seek + 4.2 ms rotation, so Cheetah is roughly 2x faster for small random I/O.

- **MCQ:** For 4 KB random I/O on a modern HDD, which component dominates latency?
  - [x] Seek time plus rotational latency
  - [ ] Transfer time
  - [ ] Bus handshake with the SATA controller
  - [ ] CPU interrupt delivery
  - why: Transfer of 4 KB at 125 MB/s is ~32 us, negligible against several milliseconds of positioning delay.

- **MCQ:** Why does track skew (offsetting first sector of each track by ~2 sectors) barely affect a 100 MB sequential read?
  - [x] The few extra sectors are tiny compared to the ~800 ms of streaming bandwidth
  - [ ] Track skew eliminates rotational latency entirely
  - [ ] Sequential reads never cross track boundaries
  - [ ] The drive's cache absorbs any skew cost
  - why: Skew adds a handful of sector-times per track crossing; amortized across hundreds of milliseconds of transfer it is negligible.

## Gotchas

- **Full rotation vs. average rotation**: The average rotational latency is one-half a full rotation, not the full rotation time. Exam questions sometimes test this distinction.
- **Transfer time negligibility**: For small reads (< 1 MB), transfer time is dominated by seek + rotation. Optimizing transfer rate helps mostly for large sequential reads.
- **Seek time variability**: The 4 ms and 9 ms "average" times assume typical seek distances (~1/3 of the disk). Full-stroke seeks (0 to max) or nearby seeks have very different latencies.
- **Track cache (buffer)**: Modern disks have 8-16 MB on-board DRAM. If the data is in the drive's cache (from a prior read), latency drops to microseconds. Exam scenarios usually assume cold cache unless stated.
- **RPM and linear speed**: Higher RPM gives faster rotation, but linear speed at the disk edge varies by radius. Model uses average effective transfer rate (MB/s).

## Sources

- lectures__Week11_2.txt: HDD geometry (platters, spindle, tracks, heads, sectors), seek time phases (acceleration, coasting, deceleration, settling), rotational delay, transfer, T_I/O formula, Cheetah vs. Barracuda specs, random vs. sequential performance comparison, track skew.
