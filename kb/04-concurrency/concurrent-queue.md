# Concurrent Queue

## Definition

A **concurrent queue** (or FIFO queue) is a thread-safe data structure that allows multiple producers to enqueue elements and multiple consumers to dequeue elements simultaneously. It must maintain FIFO order while minimizing lock contention through separate locks for head and tail.

## When to use

Use concurrent queues in producer-consumer systems, work queues, thread pools, and message passing. The separate head and tail locks allow independent enqueue and dequeue operations, enabling better concurrency than a single global lock.

## Key ideas

- **Two locks**: Separate locks for head (dequeue) and tail (enqueue) operations
- **Independent operations**: A producer can enqueue while a consumer dequeues simultaneously
- **Sentinel node**: Using a dummy head node simplifies head pointer management
- **Condition variables**: Often used with queues to signal when data is available (covered in producer-consumer topics)
- **Boundedness**: Bounded queues have a maximum size; unbounded queues can grow indefinitely
- **Contention reduction**: With 2 locks, 2 threads can modify the queue simultaneously (vs. 1 with single lock)

## Pseudocode

Basic concurrent queue with separate locks:
```
typedef struct node {
    int value;
    struct node *next;
} node_t;

typedef struct {
    node_t *head;
    node_t *tail;
    lock_t head_lock;
    lock_t tail_lock;
} queue_t;

void queue_init(queue_t *q) {
    // Create sentinel node
    node_t *sentinel = malloc(sizeof(node_t));
    sentinel->next = NULL;
    
    q->head = sentinel;
    q->tail = sentinel;
    lock_init(&q->head_lock);
    lock_init(&q->tail_lock);
}

void enqueue(queue_t *q, int value) {
    node_t *new = malloc(sizeof(node_t));
    new->value = value;
    new->next = NULL;
    
    lock(&q->tail_lock);
    q->tail->next = new;
    q->tail = new;
    unlock(&q->tail_lock);
}

int dequeue(queue_t *q) {
    lock(&q->head_lock);
    node_t *old_head = q->head;
    node_t *new_head = old_head->next;
    
    if (new_head == NULL) {
        unlock(&q->head_lock);
        return -1;  // queue is empty
    }
    
    int value = new_head->value;
    q->head = new_head;
    unlock(&q->head_lock);
    free(old_head);
    return value;
}
```

## Hand-trace example

Concurrent queue with separate locks (2 producers, 2 consumers):

Initial state: head → [sentinel] → NULL, tail → [sentinel]

| Step | P1 | P2 | C1 | C2 | Queue state | Notes |
|------|----|----|----|----|------------|-------|
| 1 | tail_lock() | - | - | - | [S] | P1 acquires tail lock |
| 2 | enqueue(1) | tail_lock() blocked | - | - | [S]→[1] | P1 enqueuing; P2 waits |
| 3 | tail_lock() release | (blocked) | head_lock() | - | [S]→[1] | P1 releases; C1 acquires head |
| 4 | - | tail_lock() | dequeue() | - | [S]→[1] | P2 now has tail lock |
| 5 | - | enqueue(2) | (dequeuing) | head_lock() blocked | [S]→[1]→[2] | P2 enqueues; C2 waits |
| 6 | - | tail_lock() release | head_lock() release | (blocked) | [1]→[2] | P2 done; C1 dequeued (1), released; C2 acquires |
| 7 | - | - | - | dequeue() | [2] | C2 dequeuing |
| 8 | - | - | - | head_lock() release | [S]→[2] | C2 dequeued (2) |

Concurrent independence scenario:
- T=1: P1 holds tail_lock (enqueuing)
- T=2: C1 holds head_lock (dequeuing) simultaneously
- Both operations proceed independently on different ends

## Common exam questions

- Why does a concurrent queue use two separate locks instead of one?
- Explain the role of the sentinel node in simplifying queue operations.
- How can a producer and consumer operate concurrently with separate locks?
- What happens if dequeue() is called on an empty queue?
- Design a bounded concurrent queue that blocks producers when full.

## Gotchas

- **Empty queue corner case**: When the queue becomes empty (head == tail), special handling is needed
- **Sentinel node overhead**: Adds one extra malloc/free per queue lifetime, slight memory overhead
- **Deadlock risk**: Avoid acquiring both locks simultaneously; if needed, must be in consistent order
- **Condition variables needed**: For producer-consumer, you typically pair queues with CVs to block on empty/full
- **Lock order**: If acquiring both locks is ever needed, always acquire in the same order (head before tail) to prevent deadlock

## Sources

- zhang__Chapter+29+Lock-based+Concurrent+Data+Structures+v2.txt
