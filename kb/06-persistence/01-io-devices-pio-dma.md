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

- **MCQ:** A device completes each request in 1 us but a context switch costs 10 us. Which I/O mode minimizes overhead?
  - [x] Polling (PIO), because the device is faster than a context switch
  - [ ] Interrupts, because they always reduce CPU overhead
  - [ ] DMA, because it frees the CPU entirely
  - [ ] Memory-mapped I/O, because it avoids special instructions
  - why: Interrupt overhead (~10 us) would dwarf the 1 us device latency, so polling wins when device time is less than switch cost.

- **MCQ:** A DMA controller moves a 10 MB buffer at 125 MB/s. Roughly how long is the CPU free for other work during this transfer?
  - [x] About 80 ms
  - [ ] About 8 ms
  - [ ] About 800 ms
  - [ ] About 1.25 ms
  - why: 10 MB / 125 MB/s = 0.08 s = 80 ms, during which the DMA engine handles the copy and the CPU can run other tasks.

- **MCQ:** Which statement best describes the canonical device protocol using the three hardware registers?
  - [x] Poll status until READY, write parameters and data, write command, poll status until done
  - [ ] Write command, read data, check status only on failure
  - [ ] Write data, write status, write command simultaneously
  - [ ] Wait for an interrupt before checking any register
  - why: The status register gates both the initial readiness check and the completion check; command and data registers are written between those polls.

- **MCQ:** Why does memory-mapped I/O dominate over dedicated I/O instructions on modern systems?
  - [x] The OS can use normal load/store instructions, simplifying drivers
  - [ ] It is faster because it bypasses the memory bus
  - [ ] It avoids the need for any status register
  - [ ] Dedicated I/O instructions are illegal on x86-64
  - why: Mapping device registers into the address space means the same load/store path (and MMU protection) works for device access, eliminating special opcodes.

- **MCQ:** A disk takes ~6 ms to service a read. During that time with interrupts, how much CPU work is lost?
  - [x] Roughly one context switch (a few microseconds)
  - [ ] All 6 ms (CPU spins)
  - [ ] Zero, because DMA is always used
  - [ ] About 3 ms (half the I/O time)
  - why: Interrupts let the OS schedule other work for the full 6 ms; only the switch-in and switch-out overhead is wasted.

- **MCQ:** Why must DMA implementations coordinate with the CPU cache?
  - [x] Stale cache lines can shadow memory written by DMA, causing inconsistent reads
  - [ ] DMA controllers cannot access physical memory
  - [ ] Caches must be disabled globally whenever DMA runs
  - [ ] DMA bypasses the memory controller entirely
  - why: If the CPU has cached a page that DMA then updates, the CPU will read stale data unless caches are flushed/invalidated for the DMA region.

- **MCQ:** Which benefit specifically belongs to DMA rather than interrupt-driven PIO?
  - [x] The CPU is freed from copying data byte-by-byte during the transfer
  - [ ] The OS never has to handle an interrupt
  - [ ] The device no longer needs a status register
  - [ ] Polling is always eliminated for small transfers
  - why: Interrupt-driven PIO still requires the CPU to copy bytes to/from the device; DMA offloads the actual data movement, issuing a single completion interrupt.

## Gotchas

- **Torn writes on interruption**: If a device issues a partial interrupt (e.g., after writing 2 KB of a 4 KB transfer) and the OS context-switches, data consistency must be carefully managed.
- **Interrupt latency**: High-priority interrupts can delay lower-priority ones. Critical I/O may require masking.
- **DMA and cache coherency**: If CPU and DMA both access the same memory region, caches must be flushed/invalidated to avoid stale reads.
- **Busy-waiting in polling**: Even a tight polling loop consumes power and prevents OS from switching to other processes. Modern OSes almost always use interrupts.

## Sources

- lectures__Week11_1.txt: Canonical device model, polling vs. interrupts vs. DMA, memory-mapped I/O, I/O instructions (x86 in/out).
