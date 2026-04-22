# Cumulative Paging and Memory-Management Problems

## Overview

This problem set covers virtual address translation, page-table mechanics, TLB optimization, and page-replacement algorithms. Problems range from simple VA-to-PA translation to multi-level page walks, TLB hit-rate analysis, and simulation of replacement policies (FIFO, LRU, OPT). These are core final-exam topics: expect 2–3 dedicated problems on the actual exam.

## Problem 1: Virtual-to-Physical Address Translation

**Setup:**
System configuration:
- Virtual address space: 14 bits
- Physical address space: 16 bits
- Page size: 64 bytes
- Page table (single level, fully populated)

Compute bit widths:
- Page offset bits: log₂(64) = 6
- Virtual page number (VPN) bits: 14 − 6 = 8 (so 2^8 = 256 page-table entries)
- Physical frame number (PFN) bits: 16 − 6 = 10 (so 2^10 = 1024 possible frames)

Sample page table entry at index 0x4F: Valid=1, PFN=0x2A, Protection=read/write

**Task:**
Translate virtual address 0x13CE to physical address, assuming the page-table entry at VPN=0x4F is valid with PFN=0x2A.

**Solution:**

Break down VA 0x13CE:
- In binary: 0001 0011 1100 1110
- VPN (top 8 bits): 0001 0011 = 0x13
- Offset (bottom 6 bits): 110 1110 = 0x2E

Wait, let me recount. 14 bits total: 0x13CE in hex. 14 bits = 3.5 hex digits; 0x13CE is 16 bits. Let me use a 14-bit address: 0x13CE truncated to 14 bits is 0x03CE (14 bits = 0000 1111 1100 1110, top 14: 0011 1100 1110).

Actually, 0x13CE in binary is the 16-bit value 0001 0011 1100 1110. In a 14-bit VA space, only the lower 14 bits matter: 11 1100 1110 = 0xF CE (split as VPN=11 1100 = 0x3C, offset=1110 = 0x0E).

Let me recalculate assuming VA=0x13CE and only using the lower 14 bits:
- Lower 14 bits of 0x13CE: 0x3CE (in 14-bit binary: 0011 1100 1110)
- Top 8 bits (VPN): 0011 1100 = 0x3C
- Bottom 6 bits (offset): 1110 = 0x0E

The problem states VPN=0x4F. Let's instead use VA where VPN=0x4F. Let's say VA = (0x4F << 6) | 0x2E = 0x4F2E (after shifting).
- 0x4F = 0100 1111 (8 bits)
- 0x2E = 0010 1110 (6 bits, but we only use 6 bits as offset)
- Concatenated: 0100 1111 0010 1110 = 0x4F2E (14 bits exactly)

So VA 0x4F2E:
- VPN (upper 8 bits): 0x4F
- Offset (lower 6 bits): 0x2E = 46 decimal (which fits in 6 bits: 101110)

Page table lookup at VPN 0x4F → PFN 0x2A (valid).
- PA = (PFN << 6) | offset = (0x2A << 6) | 0x2E
- 0x2A = 0010 1010 (8 bits)
- 0x2A << 6 = 00 1010 0000 0000 = 0x0A00 (after left-shift 6)
- PA = 0x0A00 | 0x2E = 0x0A2E

**Answer: VA 0x4F2E → PA 0x0A2E**

**Why it matters:**
This is a foundational skill. On the exam, you'll be asked to extract VPN and offset, look up the page table, and construct the physical address. Mistakes here cascade through later problems.

---

## Problem 2: Multi-Level Page Table Memory Overhead

**Setup:**
System with 32-bit virtual addresses, 4KB pages, and 4-byte page-table entries:
- Page size: 4KB = 2^12 bytes → 12-bit offset
- VPN bits: 32 − 12 = 20
- With two-level page table: outer directory 2^10 entries, inner table 2^10 entries
  - Each level uses 10 bits of VPN: outer [19:10], inner [9:0]
  - Each outer entry points to one inner table (4KB = 1024 entries, 4 bytes each, no allocation if empty)

A typical program uses only 4MB of virtual memory (non-contiguous: heap, stack, code).

**Task:**
1. How much memory is needed for a single-level page table if all 2^20 entries are allocated?
2. How much memory is needed for a two-level table if only the 4MB of used virtual memory is allocated?
3. Compare and explain the savings.

**Solution:**

1. **Single-level page table:**
- Entries: 2^20 = 1,048,576
- Entry size: 4 bytes
- Total: 1,048,576 × 4 = 4,194,304 bytes = 4 MB

2. **Two-level page table (sparse allocation):**
4MB = 4 × 2^20 bytes. With 4KB pages (2^12 bytes/page), this is 4 × 2^20 / 2^12 = 4 × 2^8 = 1024 pages = 1024 PTEs needed.

With two-level table (10+10 split):
- Each outer entry can point to 2^10 inner entries (covering 2^10 × 2^12 = 2^22 = 4MB).
- For 1024 used pages: need at most 1024 / 1024 = 1 full inner table, or roughly 1 inner table (if fragmented, up to 2 or more).

In the best case (contiguous 4MB): 1 outer table + 1 inner table:
- Outer: 2^10 entries × 4 bytes = 4096 bytes = 4 KB
- Inner: 2^10 entries × 4 bytes = 4096 bytes = 4 KB
- Total: 8 KB

In worst case (highly fragmented): 1 outer table + N inner tables (one per non-contiguous region).
- If each region is 4KB (one page), need 1024 inner tables for 1024 pages.
- Total: 4 KB (outer) + 1024 × 4 KB (inner) = 4100 KB ≈ 4 MB (same as single-level).

Typical case (modest fragmentation, ~8 regions): 1 outer + 8 inner:
- Total: 4 KB + 8 × 4 KB = 36 KB

3. **Comparison:**
- Single-level: 4 MB (mandatory, regardless of usage)
- Two-level (best): 8 KB (256:1 savings)
- Two-level (typical): ~36 KB (100:1 savings)
- Two-level (worst): ~4 MB (no savings)

**Why it matters:**
Multi-level page tables trade lookup latency (more memory accesses without TLB) for memory overhead savings on sparse address spaces. Modern systems (x86-64) use 4-level page tables to support huge virtual spaces (2^48 bits) without 2^36-byte overhead.

---

## Problem 3: TLB Hit Rate Analysis

**Setup:**
Streaming workload: access an array of 16,384 integers (4 bytes each) sequentially.
- System TLB: 4 entries (capacity)
- Page size: 4KB
- Integers per page: 4KB / 4 bytes = 1024 integers

**Task:**
1. How many integers fit on one page?
2. How many page faults (TLB misses) occur?
3. What is the TLB hit rate?

**Solution:**

1. **Integers per page:** 4096 bytes / 4 bytes = 1024 integers per page

2. **Page faults:**
Total integers: 16,384
Pages needed: 16,384 / 1024 = 16 pages

Streaming access (linear order):
- First access to each new page: TLB miss (16 misses, one per page)
- Subsequent accesses to the same page: TLB hit (1024 − 1 = 1023 hits per page, except first page is 1023 hits in that page)

More precisely:
- Page 0: access 0–1023 (1 miss on first access, 1023 hits)
- Page 1: access 1024–2047 (1 miss on first access, 1023 hits)
- ...
- Page 15: access 15360–16383 (1 miss, 1023 hits)

Total misses: 16
Total hits: 16 × 1023 = 16,368

3. **TLB hit rate:**
Hit rate = hits / (hits + misses) = 16,368 / (16,368 + 16) = 16,368 / 16,384 ≈ 0.9990 = 99.9%

Note: The TLB capacity (4 entries) is irrelevant here because we stream sequentially and never revisit old pages (or revisit far enough that they've been evicted). If the TLB held 16 entries, we'd still have 16 misses (and 16,368 hits). With a 1-entry TLB, we'd have a miss every 1024 accesses (for each page transition), still 16 misses.

**Why it matters:**
Streaming workloads have excellent TLB locality. Real workloads (with nested loops, random access) have worse hit rates. This motivates larger TLBs and multi-level TLBs in modern CPUs.

---

## Problem 4: Page-Replacement Simulation

**Setup:**
Reference string (in page-access order): 0, 1, 2, 3, 0, 1, 4, 0, 1, 2, 3, 4

Physical memory: 3 page frames (initially empty)

Simulate three replacement algorithms:
- FIFO: evict the oldest page in memory
- LRU: evict the least recently used page
- OPT: evict the page not accessed for the longest time in the future (requires knowledge of future)

**Task:**
For each algorithm, show the frame state after each reference and count total page faults (misses).

**Solution:**

**FIFO:**

| Ref | Frames | Action | Fault? | Notes |
|-----|--------|--------|--------|-------|
| 0   | [0]    | Insert | Yes    | Frame 1 |
| 1   | [0,1]  | Insert | Yes    | Frame 2 |
| 2   | [0,1,2]| Insert | Yes    | Frame 3 (full) |
| 3   | [1,2,3]| Evict 0 (oldest), insert 3 | Yes | FIFO: 0 is oldest |
| 0   | [2,3,0]| Evict 1 (oldest), insert 0 | Yes | |
| 1   | [3,0,1]| Evict 2 (oldest), insert 1 | Yes | |
| 4   | [0,1,4]| Evict 3 (oldest), insert 4 | Yes | |
| 0   | [0,1,4]| 0 in frames | No | Hit |
| 1   | [0,1,4]| 1 in frames | No | Hit |
| 2   | [1,4,2]| Evict 0 (oldest), insert 2 | Yes | |
| 3   | [4,2,3]| Evict 1 (oldest), insert 3 | Yes | |
| 4   | [2,3,4]| Evict 4 (oldest), insert 4 | Yes | Wait, 4 is in frames. Hit. |

Let me re-trace more carefully:

After ref 4 (insert 4): frames = [0,1,4], FIFO order = 0, 1, 4 (0 is oldest)
Ref 0: in frames, hit
Ref 1: in frames, hit
Ref 2: not in frames, evict 0 (oldest), insert 2. Frames = [1,4,2], FIFO = 1, 4, 2 (1 oldest)
Ref 3: not in frames, evict 1 (oldest), insert 3. Frames = [4,2,3], FIFO = 4, 2, 3 (4 oldest)
Ref 4: in frames, hit

**FIFO page faults: 9** (0, 1, 2, 3, 0, 1, 4, 2, 3)

**LRU:**

| Ref | Frames | Action | Fault? | Notes |
|-----|--------|--------|--------|-------|
| 0   | [0]    | Insert | Yes    |  |
| 1   | [0,1]  | Insert | Yes    |  |
| 2   | [0,1,2]| Insert | Yes    |  |
| 3   | [1,2,3]| Evict 0 (LRU), insert 3 | Yes | 0 unused since ref 4 (future) |
| 0   | [2,3,0]| Evict 1 (LRU after ref 5), insert 0 | Yes |  |
| 1   | [3,0,1]| Evict 2 (LRU), insert 1 | Yes |  |
| 4   | [0,1,4]| Evict 3 (LRU), insert 4 | Yes |  |
| 0   | [0,1,4]| 0 in frames (touch) | No |  |
| 1   | [0,1,4]| 1 in frames (touch) | No |  |
| 2   | [1,4,2]| Evict 0 (LRU), insert 2 | Yes |  |
| 3   | [4,2,3]| Evict 1 (LRU), insert 3 | Yes |  |
| 4   | [4,2,3]| 4 in frames | No |  |

**LRU page faults: 10** (0, 1, 2, 3, 0, 1, 4, 2, 3)

**OPT (Optimal, with knowledge of future):**

Reference string: 0, 1, 2, 3, 0, 1, 4, 0, 1, 2, 3, 4

Next use distances from each point:
- 0: [next use at 4, then 7, then never] → [4, 7, ∞]
- 1: [next at 5, 8, then never] → [5, 8, ∞]
- 2: [next at 10, then never] → [10, ∞]
- 3: [next at 11, then never] → [11, ∞]
- 4: [next at 12, then never] → [12, ∞]

OPT evicts the page not accessed for the longest time in the future (highest next-use distance).

| Ref | Frames | Action | Fault? | Notes |
|-----|--------|--------|--------|-------|
| 0   | [0]    | Insert | Yes    |  |
| 1   | [0,1]  | Insert | Yes    |  |
| 2   | [0,1,2]| Insert | Yes    | Full |
| 3   | [1,2,3]| Evict 0 (next use at +4) vs 1 (+2) vs 2 (+8). Evict 2 (farthest) → no wait. Evict the page with farthest next use: 0 at +4, 1 at +2, 2 at +8. Actually, insert 3, evict the page with farthest next use among [0,1,2]. 2's next use is at ref 10 (+7 from now), 0's is at +4, 1's at +2. Evict 2 (farthest at +7 distance = 10−3). Wait, 2 is used at ref 10, distance 10−3=7. 0 used at 4, distance 4−3=1. 1 used at 5, distance 5−3=2. So 2 is farthest; evict 2. Insert 3. | Yes | 0 at +1, 1 at +2, 2 at +7. Evict 2 |
| 0   | [0,1,3]| 0 in frames (next 1) | No |  |
| 1   | [0,1,3]| 1 in frames (next 2) | No |  |
| 4   | [0,3,4]| Evict 1 (next use farthest at +5 away, next 1 is ref 8 − ref 6 = +2). Actually 1's next use is at ref 8 (+2), 0's at ref 7 (+1), 3's at ref 11 (+5). Evict 1 (farthest at +5 from ref 6)? No: 3 is farthest at +5. Insert 4, evict 3. | Yes | 3 farthest at +5 |
| 0   | [0,4,?]| Oops I have space. Frames [1,0,3] before 4. Evict 3? | Wait, capacity is 3 frames. Before ref 4: [0,1,3]. Insert 4, evict the page with farthest next use. 0 next at 7 (+1), 1 next at 8 (+2), 3 next at 11 (+5). Evict 3. Frames = [0,1,4]. | Yes | Evict 3 |
| 0   | [0,1,4]| 0 in frames | No |  |
| 1   | [0,1,4]| 1 in frames | No |  |
| 2   | [0,4,2]| Evict 1 (next at 11, which is +2, vs 0 at 0 (+1) vs 4 at 11 (+2). 0 and 4 both at next use in future; 1 not used again. Evict 1. | Yes | Evict 1 |
| 3   | [0,2,3]| Evict 4 (never used again, ∞ distance). Insert 3, evict 4. | Yes | Evict 4 |
| 4   | [0,3,4]| Evict 2 (never used again, ∞ distance). Insert 4, evict 2. | Yes | Evict 2 |

**OPT page faults: 7** (0, 1, 2, 3, 4, 2, 3, 4)

Actually, let me recount. Starting from ref 0:
Faults: 0 (ref 0), 1 (ref 1), 2 (ref 2), 3 (ref 3), 4 (ref 6), 2 (ref 10), 3 (ref 11) = 7 faults.

Refs with hits: 4 (at ref 4), 5 (at ref 5), 7 (at ref 7), 8 (at ref 8), 9 (at ref 9), 11 (at ref 11)? Wait, ref 11 is 3, which should be a hit if in frames. Let me re-trace more carefully.

After ref 9 (2), frames = [0,4,2]. Ref 10 is 3. Next use of 0 is ref 0 (just accessed) so next is ∞. Next use of 4 is ref 12 (+2). Next use of 2 is never (+∞). Evict either 4 or 2 (both farthest). Let's evict 2. Insert 3. Frames = [0,4,3]. Fault count: 7.
Ref 11 is 4. In frames, hit.
Done. **OPT total: 7 faults.**

**Why it matters:**
OPT is unimplementable (requires future knowledge) but sets the theoretical lower bound. LRU approximates OPT and is practical. FIFO is simple but poor. Belady's anomaly (increasing frames increases faults) can occur with FIFO but not OPT or LRU for this reference string.

---

## Problem 5: Working Set and Thrashing

**Setup:**
A process's working set (set of pages actively used in current phase) has size WS(t,T) = 5 pages, where t is time and T is the window. The system has 4 physical page frames available for this process.

**Task:**
1. Can the process run without thrashing?
2. What is thrashing?
3. How would you prevent it?

**Solution:**

1. **Can the process run without thrashing?** No. The working set (5 pages) exceeds available frames (4). The process cannot fit its entire working set in memory.

2. **What is thrashing?** Thrashing occurs when the process spends most of its time swapping pages in and out of memory rather than executing. With WS > frames, every few instructions cause a page fault, triggering disk I/O (8–10ms per fault). CPU utilization drops to near zero.

3. **Prevention:**
   - Increase memory allocation to 5+ frames (ideal)
   - Reduce working set size (e.g., restructure algorithm to exhibit better locality)
   - Use demand paging with careful prefetch strategies
   - Admission control: prevent the process from starting if total WS across all processes exceeds memory capacity
   - Suspend lower-priority processes to free frames

**Why it matters:**
Thrashing is a catastrophic system failure mode. Modern OS detect it via CPU-utilization or page-fault-rate monitoring and take corrective action (swap out entire processes, run garbage collection, etc.). Understanding WS motivates working-set-based VM policies and is tested on finals.

