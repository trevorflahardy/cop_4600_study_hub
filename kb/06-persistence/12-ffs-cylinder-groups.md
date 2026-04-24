# FFS Cylinder Groups: Locality-Aware Allocation

## Definition

The Fast File System (FFS) divides the disk into **cylinder groups** (or block groups), each with its own superblock copy, inode bitmap, data bitmap, inode table, and data blocks. Placement policies keep directories and their files in the same cylinder group to minimize seek distance: directories are placed in groups with low dir count + high free inodes, and files are placed in the parent's group (with large-file exception). Amortization of positioning overhead requires chunk sizes proportional to disk bandwidth and positioning time.

## When to use

- **Understanding locality in filesystems**: Why related files should be colocated.
- **File placement policies**: How FFS chooses cylinder groups for new directories and files.
- **Large file handling**: Why large files are chunked across groups.
- **Amortization calculation**: Computing optimal chunk size to achieve peak disk throughput.

## Key ideas

### Cylinder Group Structure

FFS partitions the disk into N equal-sized cylinder groups.

```
Disk:

┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  Cylinder       │  Cylinder       │  Cylinder       │  Cylinder       │
│     Group 0     │     Group 1     │     Group 2     │     Group 3     │
│                 │                 │                 │                 │
│ S ib db I D ... │ S ib db I D ... │ S ib db I D ... │ S ib db I D ... │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘

Each group contains:
  S   = Superblock (copy)
  ib  = Inode bitmap
  db  = Data bitmap
  I   = Inode table
  D   = Data blocks
```

### Placement Heuristics

**Directory Placement**:
Find the cylinder group with:
1. Lowest number of allocated directories.
2. Highest number of free inodes.

**Rationale**: Spread directories across groups to balance directory density and inode availability.

**File Placement**:
Place file's data blocks in the same cylinder group as its parent directory's inode.

**Rationale**: Files in the same directory are typically accessed together, so colocating them minimizes seeks.

### Large-File Exception

For files larger than one cylinder group's capacity, FFS chunks the file across multiple groups:
- The first chunk (up to 1 MB of indirect blocks) goes in the parent's group.
- Subsequent chunks go in different groups (determined by round-robin or another heuristic).

**Rationale**: Prevents one large file from dominating a single group and starving other files.

### Locality Measurement (SEER Traces)

Study of real workloads showed:
- **7% of accesses**: Same file (sequential reads of one file).
- **40% of accesses**: Same directory (e.g., compiling a single source directory).
- **25% of accesses**: Distance 2 in hierarchy (e.g., sibling directory).
- **80% of accesses**: Within distance 2.

FFS allocation policies exploit these locality patterns by keeping related files close.

### Amortization: Optimal Chunk Size

**Problem**: Large files are chunked across groups (random access pattern). Each chunk causes a seek.

**Goal**: Amortize positioning overhead (seek + rotation) to achieve 50% of peak disk bandwidth.

**Formula**:

```
chunk_size = (disk_bandwidth × positioning_time) / 2

Example:
  Disk bandwidth: 40 MB/s
  Positioning time: 10 ms (seek + rotation)
  
  chunk_size = 40 MB/s × 10 ms × (1 s / 1000 ms)
             = 40 × 1024 KB × 0.01
             = 409.6 KB

To achieve 99% of peak bandwidth, chunk_size ≈ 3.69 MB
```

**Interpretation**: If chunks are 409.6 KB, the disk spends 10 ms positioning + ~10 ms transferring, achieving 50% peak bandwidth. With 3.69 MB chunks, positioning overhead is amortized over a longer transfer, achieving higher utilization.

## Pseudocode

### Allocating Directory

```c
uint32_t allocate_directory() {
    uint32_t best_group = -1;
    uint32_t min_dirs = UINT_MAX;
    uint32_t max_free_inodes = 0;
    
    // Find group with lowest dir count and highest free inodes
    for (int g = 0; g < num_groups; g++) {
        uint32_t allocated_dirs = count_allocated_dirs_in_group(g);
        uint32_t free_inodes = count_free_inodes_in_group(g);
        
        if (allocated_dirs < min_dirs ||
            (allocated_dirs == min_dirs && free_inodes > max_free_inodes)) {
            best_group = g;
            min_dirs = allocated_dirs;
            max_free_inodes = free_inodes;
        }
    }
    
    // Allocate inode in best_group
    uint32_t ino = allocate_inode_in_group(best_group);
    return ino;
}
```

### Allocating File in Parent's Group

```c
uint32_t allocate_file(uint32_t parent_ino) {
    // Find parent's cylinder group
    struct inode* parent = load_inode(parent_ino);
    uint32_t parent_group = get_inode_group(parent_ino);
    
    // Try to allocate inode in parent's group
    uint32_t ino = allocate_inode_in_group(parent_group);
    if (ino != (uint32_t)-1) {
        return ino;  // Success
    }
    
    // Parent's group full; try neighboring groups
    for (int offset = 1; offset < num_groups; offset++) {
        uint32_t alt_group = (parent_group + offset) % num_groups;
        ino = allocate_inode_in_group(alt_group);
        if (ino != (uint32_t)-1) {
            return ino;
        }
    }
    
    return -1;  // No free inodes anywhere
}
```

### Large File Chunking (Round-Robin Groups)

```c
void allocate_file_block_large_file(uint32_t ino, uint32_t block_offset) {
    uint32_t current_group = get_inode_group(ino);
    
    // Every N blocks (e.g., 1024 blocks = 4 MB), switch groups
    uint32_t blocks_per_chunk = 1024;  // 4 MB chunks
    uint32_t chunk_id = block_offset / blocks_per_chunk;
    uint32_t target_group = (current_group + chunk_id) % num_groups;
    
    uint32_t block = allocate_block_in_group(target_group);
    
    struct inode* inode = load_inode(ino);
    inode->i_block[block_offset % 12] = block;  // Or use indirect
    disk_write_inode(ino, inode);
}
```

## Hand-trace example

### Cylinder Group Placement

Disk: 10 cylinder groups (G0-G9), each 40 MB.

| Group | Allocated Dirs | Free Inodes | Suitable? |
|---|---|---|---|
| G0 | 5 | 20 | Good |
| G1 | 8 | 10 | Bad (high dir count) |
| G2 | 2 | 50 | Excellent (low dirs, high inodes) |
| G3 | 6 | 5 | Bad (low free inodes) |
| G4 | 3 | 35 | Good |

**Allocating new directory**:
Choose G2 (lowest dir count, high free inodes).

### Parent-Child Coallocation

```
Create /foo/bar:
  Create directory /foo:
    Allocate inode in G2 (low dir count)
    Place /foo's data blocks in G2
  
  Create file /foo/bar:
    /foo is in G2
    Allocate inode for /bar in G2 (same group as parent)
    Place /bar's data blocks in G2
    
Result: Both /foo and /bar are in G2, minimizing seeks
```

### Large File Chunking (Amortization)

File size: 100 MB. Chunk size: 4 MB (1024 blocks × 4 KB).

Placement:
```
Blocks 0-1023    (0-4 MB):   Group 0
Blocks 1024-2047 (4-8 MB):   Group 1
Blocks 2048-3071 (8-12 MB):  Group 2
...
Blocks 23040-24575 (92-96 MB): Group 9
Blocks 24576-25600 (96-100 MB): Group 0 (wrap around)
```

Each 4 MB chunk is placed in a different group, spreading I/O load and minimizing contention.

### Amortization Calculation

**Parameters**:
- Disk bandwidth: 40 MB/s
- Seek time: 5 ms
- Rotation time: 5 ms
- Total positioning time: 10 ms

**Target**: Achieve 50% of peak bandwidth (20 MB/s).

```
chunk_size = 40 MB/s × 10 ms
           = 40 × 1024 KB × 0.01 s
           = 409.6 KB

Time to transfer 409.6 KB @ 40 MB/s:
  t = 409.6 KB / (40 MB/s) = 409.6 / 40000 s ≈ 0.01024 s ≈ 10.24 ms

Effective bandwidth with 409.6 KB chunk:
  (409.6 KB / (10 + 10.24) ms) = (409.6 / 20.24) KB/ms
  ≈ 20.2 MB/s ≈ 50% of peak
```

**For 99% of peak bandwidth**:
```
chunk_size = 99% × 40 MB/s × 10 ms / 1%
           = 0.99 × 40 × 10 KB
           ≈ 3,960 KB ≈ 3.69 MB

Time to transfer 3.69 MB @ 40 MB/s:
  t = 3.69 MB / 40 MB/s ≈ 92.25 ms

Effective bandwidth:
  (3.69 MB / (10 + 92.25) ms) = 3.69 MB / 102.25 ms ≈ 36 MB/s ≈ 90% of peak
```

(Exact calculation yields 99% with 3.69 MB chunk.)

## Common exam questions

- **MCQ:** Where does FFS prefer to place a new directory?
  - [x] In the cylinder group with the fewest allocated directories and plenty of free inodes
  - [ ] In the group whose number is next after the parent's
  - [ ] Always in group 0
  - [ ] In the group with the lowest free-inode count to pack data
  - why: This heuristic spreads directories across groups, avoiding a single overcrowded group while keeping inodes available for future files.

- **MCQ:** You create `/foo/bar.txt`. Where does FFS prefer to allocate the file's inode and data blocks?
  - [x] In the same cylinder group as `/foo`'s inode
  - [ ] In the group with the largest contiguous free extent
  - [ ] Always in group 0
  - [ ] Rotating round-robin regardless of parent
  - why: Coallocating files with their parent directory exploits the SEER observation that ~40% of accesses hit the same directory, minimizing seek distance.

- **MCQ:** A 100 MB file is split into 4 MB chunks across cylinder groups. How many groups host chunks?
  - [x] 25
  - [ ] 10
  - [ ] 100
  - [ ] 4
  - why: 100 MB / 4 MB per chunk = 25 chunks, each placed in a different group (potentially with wrap-around) by the large-file exception.

- **MCQ:** FFS amortization formula targets 50% of peak bandwidth. With 50 MB/s bandwidth and 10 ms positioning time, what chunk size is required?
  - [x] About 500 KB
  - [ ] About 50 KB
  - [ ] About 5 MB
  - [ ] About 50 MB
  - why: chunk = bandwidth * positioning = 50 MB/s * 0.010 s = 0.5 MB = ~500 KB gives equal time to position and transfer, hitting 50% peak.

- **MCQ:** Why does the amortization formula use positioning time (seek + rotation) rather than seek alone?
  - [x] Both seek and rotational latency must elapse before data can be transferred, so both count as wasted bandwidth
  - [ ] Rotation is free on FFS disks
  - [ ] Seek time is zero for contiguous blocks
  - [ ] The formula ignores rotation on SSDs
  - why: Any request incurs seek + rotation before transfer starts; amortizing only over seek would underestimate positioning overhead.

- **MCQ:** The SEER workload study found ~80% of accesses land within distance 2 of each other in the directory tree. How does FFS exploit this?
  - [x] It colocates sibling/related files in the same cylinder group, shrinking seek distance
  - [ ] It moves all files to group 0 periodically
  - [ ] It disables caching for distance >2 references
  - [ ] It reduces block size for sibling files
  - why: Co-locating related files means most working-set accesses stay within one group, keeping the head close and reducing seeks.

- **MCQ:** Why does FFS chunk very large files across multiple cylinder groups?
  - [x] To prevent one large file from starving other files of space and inodes in a single group
  - [ ] To ensure every block lives on its own platter
  - [ ] Because a single group cannot hold more than 4 MB
  - [ ] To guarantee sequential reads across groups
  - why: Without chunking, a big file could monopolize its group's data blocks; chunking keeps per-group space available for neighboring files.

## Gotchas

- **Amortization interpretation**: The formula gives the *minimum* chunk size to achieve the desired utilization. Smaller chunks waste more time on positioning; larger chunks achieve higher utilization.
- **Large-file exception trade-off**: Spreading large files across groups improves fairness (prevents one file from dominating), but files become fragmented (more seeks). The optimal chunk size balances these.
- **Cylinder group capacity**: Each group has finite inode table and block space. If a group fills up, new files go to other groups, breaking the parent-child coallocation policy.
- **Locality assumptions**: FFS assumes working sets are small (same directory or nearby directories). Highly random access patterns won't benefit from FFS placement.
- **Modern filesystems**: Ext4, XFS, and btrfs use extents (contiguous block ranges) instead of individual pointers, and allocate extents to block groups, achieving better performance.

## Sources

- lectures__Week13_2.txt: FFS cylinder groups (block groups), allocation policies (directories in low-dir-count + high-inode groups; files in parent's group), large-file exception (4 MB chunks spread across groups), SEER trace locality (7% same file, 40% same directory, 25% distance 2, 80% within distance 2), amortization formula (40 MB/s × 10 ms → 409.6 KB for 50% peak; 3.69 MB for 99% peak).
