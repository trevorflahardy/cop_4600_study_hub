# IDE Driver: Register Map and Protocol

## Definition

The IDE (Integrated Drive Electronics) interface defines a specific port-based protocol for communicating with disk drives. Registers are accessed at fixed I/O port addresses: 0x1F0-0x1F7 (command block) and 0x3F6 (control). Each register has a precise bit-level meaning and sequence for issuing reads/writes.

## When to use

- **Embedded systems or OS kernels**: Direct IDE driver implementation without higher-level abstraction.
- **BIOS or bootloader**: Pre-OS code that must talk directly to IDE drives.
- **Bare-metal OS course labs**: Learning hands-on device driver architecture.

## Key ideas

### IDE Port Map

| Port Address | Register Name | Read/Write | Purpose |
|---|---|---|---|
| 0x1F0 | Data Port | Both | Read incoming 16-bit data; write outgoing 16-bit data |
| 0x1F1 | Error / Features | R / W | Read error codes (when ERROR bit set in status); write features |
| 0x1F2 | Sector Count | Both | Number of sectors to read/write (1-256) |
| 0x1F3 | LBA Low Byte | Both | Bits 0-7 of logical block address |
| 0x1F4 | LBA Mid Byte | Both | Bits 8-15 of logical block address |
| 0x1F5 | LBA High Byte | Both | Bits 16-23 of logical block address |
| 0x1F6 | Drive/Head / LBA | Both | Bits 24-27 of LBA, drive select (0=master, 1=slave in bit 4) |
| 0x1F7 | Command / Status | W / R | Write: issue command (0xEC=IDENTIFY, 0x20=READ, 0x30=WRITE); Read: device status |
| 0x3F6 | Control / Alt Status | W / R | Bit 7: software reset (1=reset); Bit 0: enable interrupt (0=enable, 1=disable) |

### Status Register (0x1F7) Bit Layout

```
Bit 7: BUSY     1 = controller executing command; 0 = ready for new command
Bit 6: READY    1 = drive ready for I/O; 0 = drive not ready
Bit 5: FAULT    1 = uncorrectable error during command
Bit 4: SEEK     1 = completed seek operation (legacy; not always reliable)
Bit 3: DRQ      1 = data ready for reading OR data expected for writing
Bit 2: CORR     1 = data corrected (correctable error occurred)
Bit 1: INDEX    1 = drive passed index mark (not commonly used)
Bit 0: ERROR    1 = error occurred; read 0x1F1 for error details
```

### Error Register (0x1F1) Bit Layout (checked when ERROR bit set)

```
Bit 7: BBK      Bad block marked by manufacturer
Bit 6: UNC      Uncorrectable data error
Bit 5: MC       Media changed
Bit 4: IDNF     ID mark not found
Bit 3: MCR      Media change requested
Bit 2: ABRT     Command aborted
Bit 1: T0NF     Track 0 not found
Bit 0: AMNF     Address mark not found
```

## Pseudocode

### Typical IDE READ Sequence

```
// 1. Wait for drive ready
void ide_wait_ready() {
    while ((inb(0x1F7) & 0x80) || !(inb(0x1F7) & 0x40)) {
        // Loop until BUSY==0 and READY==1
    }
}

// 2. Issue read command
void ide_read(uint32_t lba, uint16_t sector_count) {
    ide_wait_ready()
    
    outb(0x3F6, 0x00)         // Enable interrupts
    outb(0x1F2, sector_count)  // Sector count
    outb(0x1F3, lba & 0xFF)           // LBA low
    outb(0x1F4, (lba >> 8) & 0xFF)    // LBA mid
    outb(0x1F5, (lba >> 16) & 0xFF)   // LBA high
    outb(0x1F6, 0xE0 | ((lba >> 24) & 0x0F))  // LBA mode, drive select
    outb(0x1F7, 0x20)         // Issue READ command
}

// 3. Wait for data ready (polling)
void ide_read_data(uint16_t* buf, int words) {
    while (!(inb(0x1F7) & 0x08)) {  // Wait for DRQ
        // (or use interrupt instead)
    }
    for (int i = 0; i < words; i++) {
        buf[i] = inw(0x1F0)     // Read 16-bit word from data port
    }
}

// 4. Check for errors
uint8_t status = inb(0x1F7)
if (status & 0x01) {  // ERROR bit
    uint8_t error = inb(0x1F1)
    handle_ide_error(error)
}
```

### Interrupt-driven READ

```
void ide_interrupt_handler() {
    uint8_t status = inb(0x1F7)
    
    if (status & 0x01) {  // ERROR bit set
        uint8_t error = inb(0x1F1)
        handle_error(error)
        return
    }
    
    if (status & 0x08) {  // DRQ: data ready
        // Read data from 0x1F0 (multiple 16-bit reads per sector)
        for (int i = 0; i < 256; i++) {  // 512 bytes = 256 words
            data[i] = inw(0x1F0)
        }
        sectors_remaining--
        
        if (sectors_remaining > 0) {
            // Still more sectors; DRQ should be set for next sector
            read_next_sector_data()
        } else {
            // Transfer complete
            wakeup(waiting_process)
        }
    }
}
```

## Hand-trace example

### Example: Read sector 42, 1 sector (4 KB), LBA mode

| Step | I/O Port | Value | Register | Purpose |
|---|---|---|---|---|
| 1 | 0x1F7 | Read | STATUS | Poll: BUSY=0, READY=1? |
| 2 | 0x3F6 | 0x00 | CONTROL | Enable interrupts (AltStatus bit 0) |
| 3 | 0x1F2 | 0x01 | SECTOR_COUNT | 1 sector |
| 4 | 0x1F3 | 0x2A | LBA_LOW | Sector 42 = 0x2A |
| 5 | 0x1F4 | 0x00 | LBA_MID | (42 >> 8) = 0 |
| 6 | 0x1F5 | 0x00 | LBA_HIGH | (42 >> 16) = 0 |
| 7 | 0x1F6 | 0xE0 | DRIVE_HEAD | 1110 0000 = LBA mode, drive 0 |
| 8 | 0x1F7 | 0x20 | COMMAND | 0x20 = READ command |
| — | — | — | — | **Drive seeks & rotates (~6 ms)** |
| 9 | 0x1F7 | Read | STATUS | Poll: BUSY=0, DRQ=1? (repeat ~6 ms later) |
| 10 | 0x1F0 | 256x | DATA | Read 256 16-bit words (512 bytes) |
| 11 | 0x1F7 | Read | STATUS | Check ERROR bit; if set, read 0x1F1 |

**Result**: After ~6 ms, 512 bytes of sector 42 loaded into buffer.

## Common exam questions

- **MCQ:** A sector is 512 bytes and the IDE data port is 16 bits wide. How many inw() calls are needed per sector?
  - [x] 256
  - [ ] 512
  - [ ] 128
  - [ ] 64
  - why: 512 B / 2 B per word = 256 16-bit reads from 0x1F0 to drain one sector.

- **MCQ:** To read LBA 0x12345678, what byte goes into register 0x1F5 (LBA high byte)?
  - [x] 0x34
  - [ ] 0x12
  - [ ] 0x56
  - [ ] 0x78
  - why: 0x1F5 holds bits 16-23, which is (0x12345678 >> 16) & 0xFF = 0x34; 0x1F6 gets bits 24-27 (0x2 | mode bits).

- **MCQ:** The driver just issued a READ (0x20) command. Which status bits must it see before copying data from 0x1F0?
  - [x] BUSY=0 and DRQ=1
  - [ ] BUSY=1 and DRQ=1
  - [ ] READY=0 and DRQ=0
  - [ ] FAULT=1 and ERROR=1
  - why: The controller asserts DRQ once a sector's worth of data is staged in the buffer, and clears BUSY when the command step completes.

- **MCQ:** The status register at 0x1F7 has bit 0 set after a command. What should the driver do next?
  - [x] Read 0x1F1 to get specific error details
  - [ ] Ignore it and read data anyway
  - [ ] Immediately reset the drive via 0x3F6
  - [ ] Re-issue the same command without inspection
  - why: Bit 0 of 0x1F7 is the generic ERROR flag; the actual failure code (ABRT, IDNF, UNC, etc.) sits in the error register 0x1F1.

- **MCQ:** Why is the DRIVE/HEAD register set to 0xE0 when issuing an LBA-mode read?
  - [x] It selects master drive (bit 4=0) and enables LBA mode (bit 6=1); bits 7 and 5 are legacy 1s
  - [ ] It selects slave drive and disables interrupts
  - [ ] It encodes the low byte of the LBA
  - [ ] It tells the controller to do a reset
  - why: The 0xE0 pattern keeps legacy reserved bits set while choosing LBA-mode / master; slave would be 0xF0 (bit 4=1).

- **MCQ:** When using interrupts for multi-sector transfers, when does DRQ typically re-assert?
  - [x] After each sector's data has been read out, for the next sector
  - [ ] Only once, at the very beginning of the transfer
  - [ ] Only after the entire transfer completes
  - [ ] Never; DRQ is only used for writes
  - why: The controller raises DRQ again each time a fresh sector is buffered, letting the driver pull data one sector at a time.

- **MCQ:** Why might a driver disable interrupts via 0x3F6 for a specific operation?
  - [x] During tight polling loops or initialization sequences where interrupt delivery would be disruptive
  - [ ] To permanently silence the device
  - [ ] Because DRQ cannot be polled while interrupts are enabled
  - [ ] To force the drive into slave mode
  - why: Some bootloaders and reset sequences prefer strict polling; 0x3F6 bit 1 lets the driver suppress IRQs for the duration.

## Gotchas

- **Address bits split across registers**: LBA bits 24-27 are in 0x1F6; bits 16-23 in 0x1F5; bits 8-15 in 0x1F4; bits 0-7 in 0x1F3. Masking is critical.
- **Drive select in 0x1F6**: Bit 4 selects master (0) vs. slave (1) drive. Bit 7 must be 1 for LBA mode; bits 6-5 should be 1 for legacy compatibility.
- **DRQ during write**: For writes, the driver must wait for DRQ to be asserted, then write data to 0x1F0, sector by sector.
- **Polling vs. interrupt timing**: Even with interrupts enabled (0x3F6 bit 0 = 0), the driver may still need to poll DRQ for multi-sector transfers if batching is used.
- **SEEK bit unreliability**: Some drives don't reliably set bit 4. Modern code ignores it.

## Sources

- lectures__Week11_1.txt: IDE register map, control block registers (0x1F0-0x1F7, 0x3F6), status register layout, error register codes, simplified driver code.
