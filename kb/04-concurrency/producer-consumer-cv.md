# Producer-Consumer with Condition Variables

## Definition

The **producer-consumer problem** with condition variables involves one or more producers generating data items and placing them in a bounded buffer, while one or more consumers remove and process those items. The key challenge is synchronizing access to prevent race conditions, buffer overflow, and buffer underflow.

## When to use

This is a canonical concurrency problem applicable to work queues, task scheduling, stream processing, and thread pools. Understanding the progression from incorrect to correct solutions is essential for mastering synchronization.

## Key ideas

- **Single CV with if (broken)**: Woken thread may be wrong type; another thread may consume the condition between waking and proceeding
- **Single CV with while (still broken)**: Wrong thread type still wakes; if producer wakes consumer, consumer spins while producer sleeps
- **Two CVs with while (correct)**: Separate condition variables for empty/fill; producers signal fill, consumers signal empty
- **Bounded buffer**: Finite capacity; producers wait when full, consumers wait when empty
- **Mesa semantics problem**: Woken thread must recheck condition because state may have changed

## Pseudocode

Single CV, if statement (BROKEN):
```
int buffer;
int count = 0;
cond_t cond;
mutex_t mutex;

void *producer(void *arg) {
    int loops = (int)arg;
    for (int i = 0; i < loops; i++) {
        pthread_mutex_lock(&mutex);
        if (count == 1)
            pthread_cond_wait(&cond, &mutex);
        put(i);  // buffer = i; count = 1
        pthread_cond_signal(&cond);
        pthread_mutex_unlock(&mutex);
    }
}

void *consumer(void *arg) {
    while (1) {
        pthread_mutex_lock(&mutex);
        if (count == 0)
            pthread_cond_wait(&cond, &mutex);
        int tmp = get();  // count = 0; return buffer
        pthread_cond_signal(&cond);
        pthread_mutex_unlock(&mutex);
        printf("%d\n", tmp);
    }
}
```

Single CV, while statement (STILL BROKEN):
```
void *producer(void *arg) {
    int loops = (int)arg;
    for (int i = 0; i < loops; i++) {
        pthread_mutex_lock(&mutex);
        while (count == 1)
            pthread_cond_wait(&cond, &mutex);
        put(i);
        pthread_cond_signal(&cond);
        pthread_mutex_unlock(&mutex);
    }
}

void *consumer(void *arg) {
    while (1) {
        pthread_mutex_lock(&mutex);
        while (count == 0)
            pthread_cond_wait(&cond, &mutex);
        int tmp = get();
        pthread_cond_signal(&cond);
        pthread_mutex_unlock(&mutex);
        printf("%d\n", tmp);
    }
}
```
Problem: After producer puts and signals, if consumer C1 wakes AND another consumer C2 runs while C1 is re-acquiring lock, C2 takes the data. C1 wakes, rechecks (while), and both threads may be blocked waiting on the wrong condition.

Two CVs, while statement (CORRECT):
```
int buffer;
int count = 0;
cond_t empty, fill;  // TWO condition variables
mutex_t mutex;

void *producer(void *arg) {
    int loops = (int)arg;
    for (int i = 0; i < loops; i++) {
        pthread_mutex_lock(&mutex);
        while (count == 1)
            pthread_cond_wait(&empty, &mutex);  // wait on empty
        put(i);
        pthread_cond_signal(&fill);  // signal fill
        pthread_mutex_unlock(&mutex);
    }
}

void *consumer(void *arg) {
    while (1) {
        pthread_mutex_lock(&mutex);
        while (count == 0)
            pthread_cond_wait(&fill, &mutex);  // wait on fill
        int tmp = get();
        pthread_cond_signal(&empty);  // signal empty
        pthread_mutex_unlock(&mutex);
        printf("%d\n", tmp);
    }
}
```

## Hand-trace example

Problematic interleaving with single CV and if (multiple consumers):

| Step | Tc1 | Tc2 | Tp | buffer | count | Notes |
|------|-----|-----|----|---------|----|-------|
| 1 | lock | - | - | 0 | 0 | Consumer 1 acquires |
| 2 | if(count==0) true | - | - | 0 | 0 | Will wait |
| 3 | cond_wait (sleep) | - | - | 0 | 0 | C1 released lock, sleeps |
| 4 | (sleeping) | lock | - | 0 | 0 | Consumer 2 acquires |
| 5 | (sleeping) | if(count==0) true | - | 0 | 0 | C2 will wait |
| 6 | (sleeping) | cond_wait (sleep) | - | 0 | 0 | C2 sleeps (no data) |
| 7 | (sleeping) | (sleeping) | lock | 0 | 0 | Producer acquires |
| 8 | (sleeping) | (sleeping) | put(1) | 1 | 1 | Buffer filled |
| 9 | wake | Ready | cond_signal | 1 | 1 | Producer wakes one consumer (C1) |
| 10 | (acquire lock) | (sleeping) | unlock | 1 | 1 | C1 waking; P released |
| 11 | if(count==0)? false | (sleeping) | - | 1 | 1 | C1: data available, proceed |
| 12 | get() | (sleeping) | - | 1 | 0 | C1 consumed buffer |
| 13 | cond_signal | (sleeping) | - | 1 | 0 | C1 signals (wakes C2) |
| 14 | unlock | (acquire lock) | - | 1 | 0 | C1 done; C2 acquires |
| 15 | (done) | if(count==0)? true | - | 1 | 0 | C2: buffer empty, wait! |
| 16 | (done) | cond_wait (sleep) | - | 1 | 0 | C2 sleeps forever (no more data) |

Correct behavior with two CVs:

| Step | Tc | Tp | buffer | count | Notes |
|------|----|----|---------|-------|-------|
| 1 | lock | - | 0 | 0 | Consumer acquires |
| 2 | while(count==0) | - | 0 | 0 | True, will wait |
| 3 | cond_wait(&fill) | - | 0 | 0 | Waits on fill CV |
| 4 | (sleeping) | lock | 0 | 0 | Producer acquires |
| 5 | (sleeping) | put(1) | 1 | 1 | Data in buffer |
| 6 | (wake) | cond_signal(&fill) | 1 | 1 | Producer signals FILL CV |
| 7 | (acquire lock) | unlock | 1 | 1 | Consumer re-acquires |
| 8 | while(count==0)? false | (done) | 1 | 1 | Consumer: data available |
| 9 | get() | - | 1 | 0 | Consumer consumes |
| 10 | cond_signal(&empty) | - | 1 | 0 | Consumer signals EMPTY CV |
| 11 | unlock | - | 1 | 0 | Producer can now produce again |

## Common exam questions

- Explain why single CV with if fails with multiple consumers.
- Why does single CV with while still fail?
- Trace through the two-CV solution to show why it works.
- How should the bounded buffer case be modified (MAX > 1)?
- Can readers starve writers or vice versa with condition variables?

## Gotchas

- **Mesa semantics**: Woken thread doesn't get the lock immediately; another thread may consume the condition first
- **Single CV disaster**: Can wake the wrong thread type (e.g., wake a consumer when producer is blocked)
- **If vs. while critical**: With if, a thread proceeds without rechecking; another thread may have changed state
- **Signal vs. broadcast trade-off**: Signal is efficient but can deadlock if wrong thread wakes; broadcast is safe but wasteful

## Sources

- lectures__Week7_2.txt
- zhang__Chapter+30+Condition+Variables+v2.txt
