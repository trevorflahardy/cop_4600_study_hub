# I/O Devices: PIO, Interrupt, and DMA

## Definition

An I/O device communicates with the system through a canonical interface: a status register (read-only), a command register (write-only), and a data register (read/write). The OS chooses between three interaction modes: polling (fast devices), interrupts (slow devices, high CPU overhead), and DMA (bulk transfers, CPU-offloaded).

## When to use

- **Polling**: Devices that complete requests very quickly (microseconds); context-switch overhead would exceed wait time.
- **Interrupts**: Slow devices (disks, network); allows CPU to context-switch while waiting.
- **DMA**: Large bulk transfers (memory-to-device); frees CPU entirely from data-copy work.

## Key ideas

### Canonical Device Model

Every I/O device presents three hardware-accessible registers to the OS:
1. **Status register**: Read-only. Indicates device state (BUSY, READY, FAULT, etc.).
2. **Command register**: Write-only. OS writes a command code (READ, WRITE) and parameters (sector count, LBA).
3. **Data register**: Read/write. OS reads incoming data or writes outgoing data.

Typical protocol:
```
while (STATUS == BUSY) { }         // Poll until ready
write data to DATA register
write command to COMMAND register  // Kicks off the device
while (STATUS == BUSY) { }         // Wait for completion
```

### Polling (PIO—Programmed I/O)

OS repeatedly reads the status register to monitor device progress. Simple but wastes CPU cycles.

- Pros: Simple, no context-switch overhead if device is very fast.
- Cons: CPU spins in a loop, cannot do other work. Inefficient for slow devices (100% CPU time on disk waits).
- Use when: Device latency < context-switch cost (rare on modern systems).

### Interrupts

Device signals completion via an interrupt. OS context-switches to another process, then wakes the waiting process on interrupt.

- Pros: CPU can do useful work while device is busy.
- Cons: Interrupt handling (context switch, exception entry/exit) has overhead.
- Use when: Device latency > context-switch cost (most devices).

### DMA (Direct Memory Access)

A separate hardware unit (DMA controller) reads data from memory and sends it to the device (or vice versa). The device issues a single interrupt when done. CPU never copies data.

- Pros: CPU is completely freed from copying large data blocks.
- Cons: Requires DMA-capable hardware; additional complexity.
- Typical scenario: 40 MB/s disk, 10 MB transfer, DMA takes ~250 ms; CPU gets ~250 ms to do other work instead of spinning on data copies.

### Memory-Mapped I/O vs. I/O Instructions

**Memory-Mapped I/O**: Device registers occupy memory addresses; OS uses normal `load`/`store` instructions (e.g., `mov rax, [0xFEDC0000]`).

**Dedicated I/O Instructions**: OS uses special CPU instructions like x86 `in` / `out` to access device registers on a separate I/O bus (e.g., `in al, 0x1f7`).

Most modern systems use memory-mapped I/O for simplicity.

## Pseudocode

### Polling-based read:
```
status = read_status_register()
while (status & BUSY) {
    status = read_status_register()
}
write_to_register(SECTOR_COUNT, 1)
write_to_register(LBA, desired_sector)
write_to_register(COMMAND, READ)

// Wait for completion
status = read_status_register()
while (status & BUSY) {
    status = read_status_register()
}

if (status & ERROR) {
    handle_error()
} else {
    data = read_data_register()
}
```

### Interrupt-based read:
```
write_to_register(SECTOR_COUNT, 1)
write_to_register(LBA, desired_sector)
write_to_register(COMMAND, READ)

// OS sleeps the requesting process
sleep_until_interrupt()

// Later, interrupt handler:
void interrupt_handler() {
    if (status & ERROR) handle_error()
    else {
        data = read_data_register()
        copy_to_process_buffer()
        wakeup(waiting_process)
    }
}
```

## Hand-trace example

| Phase | Device State | CPU Action | I/O Latency (Cheetah 15K.5) |
|-------|--------------|------------|---------------------------|
| Start | IDLE | Issue READ for 4 KB | — |
| Seek | BUSY | (polling) OR context-switch (interrupt) | 4 ms |
| Rotation | BUSY | (cont.) | 2 ms (avg) |
| Transfer | BUSY (DRQ set) | Poll/interrupt for DRQ; transfer 4 KB | ~30 μs |
| Complete | READY+DONE | Interrupt fires; wake sleeping task | Total: ~6 ms |

**Polling overhead**: CPU runs ~6 ms / 0.3 μs tick ≈ 20,000 polling iterations (wasteful).

**Interrupt overhead**: One context switch (~1-10 μs) + 6 ms device latency ≈ 6 ms (good utilization).

## Common exam questions

1. Why is polling inefficient for disks but acceptable for network packet arrival?
2. Explain the three phases of a DMA transfer. When does the CPU get interrupted?
3. In a system with 10 concurrent disk requests using interrupts, why don't all requests have the same latency?
4. If a device completes in 1 μs but context-switching costs 10 μs, should you use polling or interrupts?
5. How does memory-mapped I/O differ from dedicated I/O instructions? Which is easier to use?
6. What is the purpose of the status register? Why can't the OS just issue a command and return immediately?
7. A DMA controller is transferring a 10 MB file at 125 MB/s. How long does the CPU wait?

## Gotchas

- **Torn writes on interruption**: If a device issues a partial interrupt (e.g., after writing 2 KB of a 4 KB transfer) and the OS context-switches, data consistency must be carefully managed.
- **Interrupt latency**: High-priority interrupts can delay lower-priority ones. Critical I/O may require masking.
- **DMA and cache coherency**: If CPU and DMA both access the same memory region, caches must be flushed/invalidated to avoid stale reads.
- **Busy-waiting in polling**: Even a tight polling loop consumes power and prevents OS from switching to other processes. Modern OSes almost always use interrupts.

## Sources

- lectures__Week11_1.txt: Canonical device model, polling vs. interrupts vs. DMA, memory-mapped I/O, I/O instructions (x86 in/out).
