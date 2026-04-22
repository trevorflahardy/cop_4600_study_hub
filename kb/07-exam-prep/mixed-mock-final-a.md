# Mock Final Exam A

## Instructions

**Format:** Closed-book, closed-notes. Calculator permitted.
**Time limit:** 75 minutes
**Instructions:** Answer all problems. Partial credit awarded for correct reasoning. Show all work. If you need clarification on a problem, state your assumption clearly.

**Topics covered:** All units (processes/scheduling, memory/paging, concurrency, persistence).

---

## Problem 1 — Scheduling (15 points)

Four processes with these properties:
- Process P1: arrival time 0, CPU burst 5 ms
- Process P2: arrival time 2, CPU burst 8 ms
- Process P3: arrival time 4, CPU burst 3 ms
- Process P4: arrival time 6, CPU burst 6 ms

**Task (a):** (5 pts) Draw the Gantt chart for FIFO scheduling. Show the timeline with process names and time scale.

**Task (b):** (5 pts) Calculate the average turnaround time for FIFO.

**Task (c):** (5 pts) Repeat task (b) for SJF (non-preemptive). Is SJF faster than FIFO? Explain.

---

## Problem 2 — Virtual Memory and Paging (15 points)

A 32-bit system with:
- Page size: 4 KB
- Virtual address space: 4 GB
- Physical memory: 256 MB
- Single-level page table (all entries allocated)

**Task (a):** (4 pts) How many bits are used for the virtual page number (VPN)? How many entries are in the page table?

**Task (b):** (4 pts) How many physical frames are available? How many bits are required for the physical frame number (PFN)?

**Task (c):** (4 pts) What is the total memory required to store the page table (in MB)? Assume each PTE is 4 bytes.

**Task (d):** (3 pts) Explain why a single-level page table is impractical for this system. What is an alternative?

---

## Problem 3 — Concurrency: Race Condition and Synchronization (20 points)

Two threads access a shared linked list:

```c
struct node {
    int data;
    struct node *next;
};

struct node *head = NULL;

void insert(int value) {
    struct node *new_node = malloc(sizeof(struct node));
    new_node->data = value;
    new_node->next = head;
    head = new_node;
}

int search(int value) {
    struct node *ptr = head;
    while (ptr != NULL) {
        if (ptr->data == value) return 1;
        ptr = ptr->next;
    }
    return 0;
}
```

**Task (a):** (5 pts) Identify the race condition(s). Explain what could go wrong if insert() and search() run concurrently.

**Task (b):** (8 pts) Rewrite insert() and search() using a pthread_mutex_t lock to protect the list. Show the mutex declaration and the modified functions.

**Task (c):** (7 pts) Under what conditions might a deadlock occur in your synchronized solution? If no deadlock is possible, explain why.

---

## Problem 4 — Paging: Page Replacement (12 points)

A system has 3 physical frames (initially empty). Process references pages in this order:
```
2, 3, 4, 2, 3, 5, 4, 5, 3, 4, 2
```

**Task (a):** (6 pts) Simulate LRU (Least Recently Used) page replacement. Show the frames after each reference and count total page faults.

**Task (b):** (6 pts) How many page faults would occur with OPT (optimal, with knowledge of future)? You do not need to show the full trace, but briefly explain your reasoning.

---

## Problem 5 — Concurrency: Condition Variables and Bounded Buffer (16 points)

Design a bounded buffer (capacity = 2) shared by one producer and one consumer using mutexes and condition variables.

**Task (a):** (3 pts) Declare the necessary variables (mutex, condition variables, buffer, counters).

**Task (b):** (6 pts) Write the producer function: acquire the buffer, insert an item, and signal the consumer.

**Task (c):** (4 pts) Write the consumer function: acquire the buffer, remove an item, and signal the producer.

**Task (d):** (3 pts) Explain why two separate condition variables (not one) are necessary for correct synchronization.

---

## Problem 6 — Persistence: HDD I/O and Filesystem (12 points)

A hard drive with:
- Average seek time: 4 ms
- Rotational speed: 7200 RPM
- Transfer rate: 80 MB/s

**Task (a):** (5 pts) Calculate the total time (in ms) to randomly read a 4 KB block from the disk.

**Task (b):** (4 pts) If a file system needs to read 10 such blocks randomly, estimate the total time (ignoring any overlaps). How many IOPS (I/O operations per second) can the disk provide?

**Task (c):** (3 pts) Explain why sequential reads are much faster than random reads on the same drive.

---

## Problem 7 — Scheduling: MLFQ Gaming (10 points)

An MLFQ has two queues:
- Queue 0 (high priority): RR with time slice 10 ms, allotment 20 ms
- Queue 1 (low priority): RR with time slice 20 ms, allotment infinite

Two processes:
- Job A: CPU-bound, 100 ms total
- Job B: I/O-bound, yields every 5 ms of CPU

**Task:** (10 pts) Without Rule 4 (demotion on allotment), could Job A game the scheduler to stay in Queue 0? Explain the mechanism and the consequence for Job B. How does Rule 4 prevent this?

---

## Problem 8 — Memory: Address Translation (10 points)

A system has:
- Virtual address space: 16 bits
- Physical address space: 14 bits
- Page size: 256 bytes
- Page table entry at VPN 0x2A: valid=1, PFN=0x15

**Task (a):** (4 pts) How many bits are used for the offset? For the VPN? For the PFN?

**Task (b):** (3 pts) Translate virtual address 0x2ABC to physical address, using the given PTE at VPN 0x2A.

**Task (c):** (3 pts) If the PTE at VPN 0x2A were invalid, what would happen?

---

## Answer Key

### Problem 1 — Scheduling

**(a) FIFO Gantt chart:**
```
P1       P2           P3    P4
|--------|---------|---|------|
0        5         13  16     22
```

**(b) FIFO turnaround times:**
- P1: 5 - 0 = 5
- P2: 13 - 2 = 11
- P3: 16 - 4 = 12
- P4: 22 - 6 = 16

Average turnaround time: (5 + 11 + 12 + 16) / 4 = 11 ms

**(c) SJF order:** P1 (5), P3 (3), P4 (6), P2 (8)
```
P1    P3  P4        P2
|-----|---|--------|---------|
0     5   8        14        22
```

- P1: 5 - 0 = 5
- P3: 8 - 4 = 4
- P4: 14 - 6 = 8
- P2: 22 - 2 = 20

Average turnaround time: (5 + 4 + 8 + 20) / 4 = 9.25 ms

**SJF is better:** 9.25 ms < 11 ms. SJF prioritizes shorter jobs, reducing the average turnaround time for long-waiting jobs like P2 (though P2's own turnaround is worse).

---

### Problem 2 — Virtual Memory

**(a)** VPN bits: log2(4 GB / 4 KB) = log2(2^32 / 2^12) = log2(2^20) = 20 bits
Page table entries: 2^20 = 1,048,576 entries

**(b)** Physical frames: 256 MB / 4 KB = 256 * 2^20 / 2^12 = 256 * 2^8 = 65,536 frames
PFN bits: log2(65,536) = log2(2^16) = 16 bits

**(c)** Page table size: 2^20 entries * 4 bytes = 4 * 2^20 bytes = 4 MB

**(d)** A single-level 4 MB page table is wasteful for a process using only a small fraction of the 4 GB address space. Alternative: hierarchical (multi-level) page tables allocate inner page table blocks only when needed, reducing memory overhead for sparse address spaces.

---

### Problem 3 — Concurrency

**(a)** Race condition: The insert() function performs a read-modify-write sequence on the head pointer without synchronization. If search() and insert() run concurrently:
- insert() reads head, allocates new_node, writes head = new_node
- search() reads head in the middle, potentially missing the new node or traversing a list in an inconsistent state.
- Also, malloc() and free() can be disrupted, leading to corruption.

**(b)** Synchronized version:

```c
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

void insert(int value) {
    pthread_mutex_lock(&lock);
    struct node *new_node = malloc(sizeof(struct node));
    new_node->data = value;
    new_node->next = head;
    head = new_node;
    pthread_mutex_unlock(&lock);
}

int search(int value) {
    pthread_mutex_lock(&lock);
    struct node *ptr = head;
    while (ptr != NULL) {
        if (ptr->data == value) {
            pthread_mutex_unlock(&lock);
            return 1;
        }
        ptr = ptr->next;
    }
    pthread_mutex_unlock(&lock);
    return 0;
}
```

**(c)** Deadlock is not possible with a single mutex and no recursive calls. A thread cannot hold the lock and then try to acquire it again (no recursion in this code). If there were nested function calls or multiple locks, deadlock could occur.

---

### Problem 4 — Paging

**(a) LRU simulation:**

| Reference | Frame 1 | Frame 2 | Frame 3 | Fault? | Notes |
|-----------|---------|---------|---------|--------|-------|
| 2         | 2       | -       | -       | Yes    | |
| 3         | 2       | 3       | -       | Yes    | |
| 4         | 2       | 3       | 4       | Yes    | |
| 2         | 2       | 3       | 4       | No     | 2 in frames |
| 3         | 2       | 3       | 4       | No     | 3 in frames |
| 5         | 2       | 3       | 5       | Yes    | Evict 4 (LRU) |
| 4         | 2       | 4       | 5       | Yes    | Evict 3 (LRU) |
| 5         | 2       | 4       | 5       | No     | 5 in frames |
| 3         | 3       | 4       | 5       | Yes    | Evict 2 (LRU) |
| 4         | 3       | 4       | 5       | No     | 4 in frames |
| 2         | 2       | 4       | 5       | Yes    | Evict 3 (LRU) |

**Total LRU faults: 8**

**(b) OPT:** Reference string: 2, 3, 4, 2, 3, 5, 4, 5, 3, 4, 2

Use a strategy of evicting the page not used for the longest time in the future:
- After refs 2, 3, 4 (all faults), frames full.
- At ref 5 (fault), evict the page not used furthest in the future. 2 at ref 9, 3 at ref 8, 4 at ref 9. Evict 3 or 4 (both at distance ~4). Evict 3.
- Continue... OPT typically yields 6–7 faults depending on tie-breaking.

**OPT result: ~6–7 faults** (fewer than LRU due to optimal foresight).

---

### Problem 5 — Bounded Buffer

**(a)** Declarations:

```c
#define BUFFER_CAPACITY 2
int buffer[BUFFER_CAPACITY];
int in = 0, out = 0, count = 0;
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;
pthread_cond_t not_full = PTHREAD_COND_INITIALIZER;
pthread_cond_t not_empty = PTHREAD_COND_INITIALIZER;
```

**(b)** Producer:

```c
void producer(int item) {
    pthread_mutex_lock(&lock);
    while (count == BUFFER_CAPACITY) {
        pthread_cond_wait(&not_full, &lock);
    }
    buffer[in] = item;
    in = (in + 1) % BUFFER_CAPACITY;
    count++;
    pthread_cond_signal(&not_empty);
    pthread_mutex_unlock(&lock);
}
```

**(c)** Consumer:

```c
int consumer() {
    pthread_mutex_lock(&lock);
    while (count == 0) {
        pthread_cond_wait(&not_empty, &lock);
    }
    int item = buffer[out];
    out = (out + 1) % BUFFER_CAPACITY;
    count--;
    pthread_cond_signal(&not_full);
    pthread_mutex_unlock(&lock);
    return item;
}
```

**(d)** Two condition variables are necessary because:
- The producer waits on `not_full` (waiting for space).
- The consumer waits on `not_empty` (waiting for data).
- When the producer inserts, it signals `not_empty` to wake the consumer (not another producer).
- When the consumer removes, it signals `not_full` to wake the producer (not another consumer).

With a single CV, a woken thread might be of the same type (e.g., another consumer), leading to missed signals and deadlock.

---

### Problem 6 — HDD I/O

**(a)** Total time for 4 KB random read:
- Seek: 4 ms
- Rotational delay (half revolution at 7200 RPM): 60,000 / 7200 / 2 = 4.17 ms
- Transfer (4 KB at 80 MB/s): 4 KB / 80 MB/s = 0.004 MB / 80 MB/s = 0.00005 s = 0.05 ms

Total: 4 + 4.17 + 0.05 = **8.22 ms**

**(b)** 10 blocks: 10 × 8.22 = 82.2 ms
IOPS = 1 / 8.22 ms ≈ **121.7 IOPS** (roughly 120)

**(c)** Sequential reads are faster because:
- Only one seek to the start of the file.
- Rotational delay incurred once at the beginning.
- Then all subsequent blocks are read with just transfer time (no seek, no rotation between consecutive blocks on the same track).
- Effective bandwidth approaches the maximum (80 MB/s) minus the initial positioning overhead.

---

### Problem 7 — MLFQ Gaming

Without Rule 4, Job A can game the scheduler by yielding to the CPU just before exhausting its allotment (e.g., after 19 ms, yield). This resets the allotment counter, keeping A in Queue 0 indefinitely. Consequence: Job B remains in Queue 1 and is starved (never runs while A yields).

Rule 4 (demotion on allotment) prevents this by tracking the actual CPU time consumed. If a job exhausts its allotment (20 ms of real CPU time), it is demoted to Queue 1, regardless of yields. So after A consumes 20 ms of CPU (spread over multiple time slices and yields), it is demoted to Q1. Now B gets a chance to run.

---

### Problem 8 — Address Translation

**(a)** Offset bits: log2(256) = 8 bits
VPN bits: 16 - 8 = 8 bits
PFN bits: log2(2^14 / 256) = log2(2^14 / 2^8) = log2(2^6) = 6 bits

**(b)** VA 0x2ABC:
- VPN (top 8 bits of 0x2ABC): 0x2A
- Offset (bottom 8 bits): 0xBC

Page table lookup at VPN 0x2A yields PFN 0x15.
PA = (PFN << 8) | offset = (0x15 << 8) | 0xBC = 0x15BC

**(c)** If the PTE at VPN 0x2A were invalid, the CPU would generate a page fault exception. The operating system's page-fault handler would be invoked to:
- Check if the page is on disk (swapped out). If so, load it into memory and update the PTE.
- If the page is invalid (not allocated), trigger a segmentation fault, terminating the process.

