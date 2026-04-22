# Concurrent Linked List

## Definition

A **concurrent linked list** is a thread-safe singly or doubly-linked list that allows multiple threads to perform simultaneous operations (insert, delete, lookup) while maintaining correctness. Common approaches include coarse-grained locking (one lock for the entire list) and fine-grained locking (one lock per node).

## When to use

Use concurrent linked lists in systems where you need a dynamic collection of elements with frequent insertions and deletions. Coarse-grained locking is simple but limits concurrency; fine-grained locking increases concurrency but adds complexity. Choose based on contention patterns.

## Key ideas

- **Coarse-grained (one lock)**: Entire list protected by single lock; simple but bottleneck
- **Fine-grained (per-node)**: Each node has its own lock; higher concurrency but race conditions on links
- **Hand-over-hand locking**: Hold current node lock while acquiring next node lock to prevent structural changes
- **Traversal safety**: Must prevent concurrent deletion/insertion from invalidating pointers
- **Head/tail special cases**: Often need special handling or sentinel nodes
- **Performance trade-off**: Lock overhead vs. serialization benefit varies by contention

## Pseudocode

Coarse-grained concurrent linked list:
```
typedef struct node {
    int key;
    struct node *next;
} node_t;

typedef struct {
    node_t *head;
    lock_t lock;
} list_t;

void list_init(list_t *l) {
    l->head = NULL;
    lock_init(&l->lock);
}

int list_lookup(list_t *l, int key) {
    lock(&l->lock);
    node_t *curr = l->head;
    while (curr != NULL) {
        if (curr->key == key) {
            unlock(&l->lock);
            return 1;  // found
        }
        curr = curr->next;
    }
    unlock(&l->lock);
    return 0;  // not found
}

void list_insert(list_t *l, int key) {
    node_t *new = malloc(sizeof(node_t));
    new->key = key;
    
    lock(&l->lock);
    new->next = l->head;
    l->head = new;
    unlock(&l->lock);
}

int list_delete(list_t *l, int key) {
    lock(&l->lock);
    node_t *curr = l->head;
    
    if (curr != NULL && curr->key == key) {
        l->head = curr->next;
        free(curr);
        unlock(&l->lock);
        return 1;
    }
    
    while (curr != NULL && curr->next != NULL) {
        if (curr->next->key == key) {
            node_t *temp = curr->next;
            curr->next = curr->next->next;
            free(temp);
            unlock(&l->lock);
            return 1;
        }
        curr = curr->next;
    }
    unlock(&l->lock);
    return 0;
}
```

Fine-grained (hand-over-hand) sketch:
```
int list_lookup(list_t *l, int key) {
    lock(&l->head_lock);
    node_t *curr = l->head;
    
    while (curr != NULL) {
        lock(&curr->lock);
        if (curr->key == key) {
            unlock(&curr->lock);
            unlock(&l->head_lock);
            return 1;
        }
        node_t *next = curr->next;
        unlock(&curr->lock);
        
        if (next != NULL)
            lock(&next->lock);
        curr = next;
    }
    unlock(&l->head_lock);
    return 0;
}
```

## Hand-trace example

Concurrent linked list operations (coarse-grained, 3 threads):

Initial: head → [1] → [3] → NULL

| Step | Thread 1 | Thread 2 | Thread 3 | List State | Notes |
|------|----------|----------|----------|-----------|-------|
| 1 | lock() | - | - | [1]→[3] | T1 acquires lock |
| 2 | lookup(2) | lock() blocked | - | [1]→[3] | T1 searching; T2 waits |
| 3 | (searching) | (blocked) | lock() blocked | [1]→[3] | T3 waits |
| 4 | unlock() | (blocked) | (blocked) | [1]→[3] | T1 done, not found |
| 5 | - | lock() | (blocked) | [1]→[3] | T2 acquires lock |
| 6 | - | insert(2) | (blocked) | [2]→[1]→[3] | T2 inserts at head |
| 7 | - | unlock() | (blocked) | [2]→[1]→[3] | T2 releases |
| 8 | - | - | lock() | [2]→[1]→[3] | T3 acquires |
| 9 | - | - | delete(1) | [2]→[3] | T3 deletes 1 |
| 10 | - | - | unlock() | [2]→[3] | T3 done |

## Common exam questions

- Compare coarse-grained and fine-grained locking for linked lists.
- What is hand-over-hand locking and why is it necessary?
- How do you handle the head node specially in a fine-grained linked list?
- Can a concurrent linked list operation ever be interrupted mid-execution? Why should it not be?
- Describe a race condition that would occur without fine-grained locking during concurrent insertions.

## Gotchas

- **Fine-grained complexity**: Easy to get wrong; missed locks or incorrect lock ordering can cause deadlocks or data corruption
- **Traversal invalidation**: Without holding locks, a node can be deleted between when you read next and traverse to it
- **Sentinel nodes**: Using a sentinel (dummy head) node simplifies some edge cases but adds overhead
- **ABA problem**: In lock-free versions (not covered here), a node at address A can be freed, and a new node allocated at the same address (not a problem with locking)
- **Scalability limits**: Even fine-grained locking doesn't scale infinitely due to lock overhead and cache coherency

## Sources

- zhang__Chapter+29+Lock-based+Concurrent+Data+Structures+v2.txt
