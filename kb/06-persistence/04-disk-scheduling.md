# Disk Scheduling Algorithms

## Definition

Disk scheduling decides the order in which I/O requests in the queue are serviced. Since seek time dominates I/O latency, scheduling aims to minimize total seek distance or positioning time. Algorithms include FCFS (simple), SSTF (shortest seek first), SCAN/C-SCAN (elevator), and SPTF (shortest positioning time, accounting for both seek and rotation).

## When to use

- **FCFS**: Fairness required; no starvation tolerated. Simple batch systems.
- **SSTF**: Minimize average latency; workloads with clustered access patterns.
- **SCAN/C-SCAN**: Real-time or bounded-latency workloads; prevents seek starvation.
- **SPTF**: Modern systems where both seek and rotational latency are significant (rotation ≈ seek time).

## Key ideas

### FCFS (First Come, First Served)

Issue requests in arrival order. Simple but can cause excessive seeking.

**Example queue** (track positions): 98, 183, 37, 122, 14

Head starts at track 53.

```
Request order: 98 → 183 → 37 → 122 → 14
Seeks:
  53 → 98:   45 tracks
  98 → 183:  85 tracks
  183 → 37:  146 tracks
  37 → 122:  85 tracks
  122 → 14:  108 tracks
Total: 469 tracks
```

**Problem**: Large jumps (183 → 37, 122 → 14) waste seek time.

### SSTF (Shortest Seek Time First)

Always service the request closest to the current head position.

**Example queue**: 98, 183, 37, 122, 14; start at 53.

```
Step 1: Closest to 53 is 37 (distance 16)
        53 → 37 (seek 16)
Step 2: Closest to 37 is 14 (distance 23)
        37 → 14 (seek 23)
Step 3: Closest to 14 is 98 (distance 84)
        14 → 98 (seek 84)
Step 4: Closest to 98 is 122 (distance 24)
        98 → 122 (seek 24)
Step 5: Closest to 122 is 183 (distance 61)
        122 → 183 (seek 61)
Total: 208 tracks (55% better than FCFS!)
```

**Advantage**: Minimizes average latency.

**Disadvantage**: Starvation possible. Requests at disk edges (14, 183) might be delayed indefinitely if the middle keeps receiving requests.

### SCAN (Elevator Algorithm)

Move the head in one direction until the end, then reverse. Services all requests in the sweep direction.

**Example queue**: 98, 183, 37, 122, 14; start at 53, moving toward 199 (high).

```
Direction: toward 199 (low to high)
53 → 98 (seek 45) ✓
98 → 122 (seek 24) ✓
122 → 183 (seek 61) ✓
183 → 199 (seek 16, no request; reverse)
Reverse direction: toward 0 (high to low)
199 → 37 (seek 162) ✓
37 → 14 (seek 23) ✓
Total: 331 tracks
```

**Advantage**: No starvation. Worst-case latency is bounded.

**Disadvantage**: Slightly higher total seek than optimal SSTF, but more predictable.

### C-SCAN (Circular SCAN)

Like SCAN, but at the end of one direction, jump back to the start without servicing requests.

```
Direction: toward 199
53 → 98 → 122 → 183 (seeks: 45 + 24 + 61 = 130)
Jump back to 0 (seek 199, no requests serviced)
Direction: toward 199 again
0 → 14 → 37 (seeks: 14 + 23 = 37)
Total: 366 tracks (worse than SCAN for this queue)
```

**Advantage**: Fairer latency for all requests (head doesn't favor one end).

### SPTF (Shortest Positioning Time First)

Combines both seek time and rotational latency. If two requests have similar seek distances, favor the one with lower rotational latency.

**Criterion**: Choose request with minimum T_seek + T_rotation.

**Example**: Two requests on different tracks.
- Request A: 10 tracks away, sector about to arrive (0.5 ms rotation latency).
- Request B: 15 tracks away, sector just passed (3.5 ms rotation latency).

```
If seek time ≈ 5 ms per track:
  A: 10 * 0.5 + 0.5 = 5.5 ms
  B: 15 * 0.5 + 3.5 = 11 ms
Choose A.
```

**Use when**: Seek time and rotation time are comparable (modern disks: both ~2-4 ms).

## Pseudocode

### SSTF Scheduler

```c
struct request {
    int track;
    int priority;
    // other fields
};

struct request* pick_next_request(
    struct request* queue,
    int queue_len,
    int current_track
) {
    int best_idx = 0;
    int min_distance = abs(queue[0].track - current_track);
    
    for (int i = 1; i < queue_len; i++) {
        int distance = abs(queue[i].track - current_track);
        if (distance < min_distance) {
            min_distance = distance;
            best_idx = i;
        }
    }
    
    return &queue[best_idx];
}
```

### SCAN Scheduler

```c
struct request* pick_next_request_scan(
    struct request* queue,
    int queue_len,
    int current_track,
    int* direction  // 1 = moving up, -1 = moving down
) {
    struct request* next = NULL;
    int best_idx = -1;
    
    // Prefer requests in current direction
    for (int i = 0; i < queue_len; i++) {
        int delta = queue[i].track - current_track;
        
        if ((*direction == 1 && delta > 0) ||
            (*direction == -1 && delta < 0)) {
            if (next == NULL || 
                abs(delta) < abs(next->track - current_track)) {
                next = &queue[i];
                best_idx = i;
            }
        }
    }
    
    // If no requests in current direction, reverse
    if (next == NULL) {
        *direction = -*direction;
        // Recursively call with reversed direction
        return pick_next_request_scan(queue, queue_len, current_track, direction);
    }
    
    return next;
}
```

## Hand-trace example

### Request Queue: 37, 14, 98, 122, 183; Current Head: 53

| Algorithm | Order | Total Seek | Max Wait | Notes |
|---|---|---|---|---|
| **FCFS** | 37, 14, 98, 122, 183 | 16+23+84+24+61 = 208 | 184 | No reordering |
| **SSTF** | 37, 14, 98, 122, 183 | 16+23+84+24+61 = 208 | (same queue) | 100% overlap with FCFS for this queue |
| **SSTF (alt)** | 37, 14, 98, 122, 183 | 208 | | Actually: 53→37→14→98→122→183 |
| **SCAN (up)** | 98, 122, 183, 37, 14 | 45+24+61+162+23 = 315 | 162 (37, 14 wait until reversal) | One pass up, then down |
| **C-SCAN (up)** | 98, 122, 183, 14, 37 | 45+24+61+199+37 = 366 | (better fairness) | Jump back to 0, then re-serve |

**For SSTF on this specific queue**:
```
Start: 53
Closest: 37 (dist 16)
  53 → 37 (16)
Closest to 37: 14 (dist 23)
  37 → 14 (23)
Closest to 14: 98 (dist 84)
  14 → 98 (84)
Closest to 98: 122 (dist 24)
  98 → 122 (24)
Closest to 122: 183 (dist 61)
  122 → 183 (61)
Total: 208
```

## Common exam questions

- **MCQ:** Head at track 53 with queue [98, 183, 37, 122, 14]. In what order does SSTF service the requests?
  - [x] 37, 14, 98, 122, 183
  - [ ] 14, 37, 98, 122, 183
  - [ ] 98, 122, 183, 37, 14
  - [ ] 14, 183, 37, 122, 98
  - why: From 53 the closest is 37 (16), then 14 (23), then jump to 98, then 122, then 183.

- **MCQ:** Head at track 53 moving upward with queue [98, 183, 37, 122, 14], end tracks 0-199. What order does SCAN visit?
  - [x] 98, 122, 183, 37, 14
  - [ ] 37, 14, 98, 122, 183
  - [ ] 14, 37, 98, 122, 183
  - [ ] 98, 122, 183, 14, 37
  - why: SCAN services all requests in the current direction (98, 122, 183) before reversing and serving 37, 14 on the way down.

- **MCQ:** Head at track 100 with queue [50, 200, 75, 225, 125] serviced FCFS. Total seek distance?
  - [x] 575 tracks
  - [ ] 300 tracks
  - [ ] 450 tracks
  - [ ] 125 tracks
  - why: 100->50 (50) + 50->200 (150) + 200->75 (125) + 75->225 (150) + 225->125 (100) = 575 tracks.
- **MCQ:** Which algorithm can starve requests at the disk's edges under a steady stream of middle-track requests?
  - [x] SSTF
  - [ ] SCAN
  - [ ] C-SCAN
  - [ ] FCFS
  - why: SSTF always picks the closest request; edge-track requests may never become "closest" if middle requests keep arriving.

- **MCQ:** C-SCAN differs from SCAN primarily by doing which of the following?
  - [x] Jumping back to track 0 without servicing on the return sweep, to equalize wait time
  - [ ] Servicing in shortest-seek order during both sweeps
  - [ ] Using rotation time instead of seek time
  - [ ] Never reversing direction
  - why: C-SCAN provides more uniform waiting by making one-way sweeps; the return to 0 is a fast reposition, not a service pass.

- **MCQ:** When should SPTF be preferred over SSTF?
  - [x] When rotational latency is comparable to seek time, so both must be considered
  - [ ] When the disk has no rotation
  - [ ] When requests always land on the same track
  - [ ] When fairness is more important than throughput
  - why: SPTF chooses the request minimizing seek + rotation; it wins when rotation (a few ms) is on the same order as seek.

- **MCQ:** A disk has 1 ms seek per 10 tracks and a 4 ms full rotation. For two requests 10 tracks away with different sector offsets, which scheduler exploits rotational position?
  - [x] SPTF
  - [ ] SSTF
  - [ ] FCFS
  - [ ] SCAN
  - why: SSTF/SCAN/FCFS ignore rotation; only SPTF evaluates which request's sector will be under the head soonest.

## Gotchas

- **SSTF fairness issue**: Requests at the disk edges can be starved indefinitely if the center keeps receiving requests. Production systems avoid SSTF for this reason.
- **SCAN complexity**: The "direction reversal" point is not always at the disk boundary. Some implementations reverse as soon as no more requests exist in the current direction.
- **Rotation in SPTF**: SPTF requires knowing the sector position of each request. Not all scheduling layers have this information; they may only know track number.
- **Inter-request arrival during scheduling**: If new requests arrive while the scheduler is executing a sequence, the decision may change. Most real systems batch scheduling every 5-10 ms.
- **Head/arm mechanics**: Seek time is not perfectly linear with distance. Nearby seeks may have lower proportional overhead. Exam usually assumes linear model.

## Sources

- lectures__Week11_2.txt: SSTF and SPTF motivation, problem of rotation speed vs. seek speed, scheduling trade-offs between latency and fairness.
