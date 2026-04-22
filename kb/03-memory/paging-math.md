# Paging Math

## Definition

Paging math involves computing bit widths for VPN/offset, the number of page table entries, the size of the page table, and PTE bit widths. Mastering these calculations is essential for exam problems involving address translation and memory sizing.

## When to use

- Solve paging-configuration problems on exams that specify VA bits, page size, and memory size.
- Calculate page table memory overhead for system design.
- Determine VPN and offset bit counts for a given page size.
- Compute physical PTE addresses when given page table locations.

## Key ideas

### Offset Bits from Page Size

The offset is always the log base 2 of the page size:

```
offset_bits = log2(page_size)
```

**Examples**:
- 256 bytes → log2(256) = log2(2^8) = 8 bits
- 4 KB → log2(4096) = log2(2^12) = 12 bits
- 1 MB → log2(1048576) = log2(2^20) = 20 bits
- 512 bytes → log2(512) = log2(2^9) = 9 bits

From the Midterm 1 Practice Answers (page 100–105):
- 16 bytes → 4 bits
- 1 KB → 10 bits
- 1 MB → 20 bits
- 512 bytes → 9 bits
- 4 KB → 12 bits

### VPN Bits and Entry Count

Given a total address width, the VPN uses the remaining bits:

```
vpn_bits = total_address_bits - offset_bits
vpn_entries = 2^vpn_bits
```

For a linear page table, the number of entries equals the number of possible VPNs.

### Page Table Size

The page table is an array of PTEs. Total size:

```
pt_size_bytes = vpn_entries * pte_size_bytes
pt_size_bits = vpn_entries * pte_size_bits
```

**Example**: 32-bit VA, 4 KB pages, 4-byte PTE:
- offset_bits = 12
- vpn_bits = 32 - 12 = 20
- vpn_entries = 2^20 = 1,048,576
- pt_size = 2^20 * 4 = 4,194,304 bytes = 4 MB

### PTE Address Calculation

Given a page table base and VPN, the address of the PTE is:

```
pte_address = page_table_base + (vpn * pte_size)
```

From Quiz 5 (zhang__quizzes__Attendance Quiz 5 S26 Key.txt, page 2):
- 16-bit VA, 256-byte pages, 2-byte PTE
- offset_bits = log2(256) = 8 bits
- vpn_bits = 16 - 8 = 8 bits
- VA = 0x4F3A: VPN = 0x4F, Offset = 0x3A
- PT base = 0x2000
- PTE address = 0x2000 + (0x4F * 2) = 0x2000 + 0x9E = 0x209E

## Pseudocode

```
compute_paging_params(va_bits, page_size, pte_size):
  offset_bits = log2(page_size)
  vpn_bits = va_bits - offset_bits
  vpn_entries = 2 ^ vpn_bits
  pt_size = vpn_entries * pte_size
  return (offset_bits, vpn_bits, vpn_entries, pt_size)

compute_pte_address(pt_base, vpn, pte_size):
  return pt_base + (vpn * pte_size)
```

## Hand-trace example

### Scenario 1: 16-bit VA, 256-byte pages, 2-byte PTE (from Quiz 5)

| Parameter | Calculation | Result |
|-----------|-------------|--------|
| Page size | 256 bytes | — |
| Offset bits | log2(256) | 8 bits |
| VPN bits | 16 - 8 | 8 bits |
| VPN entries | 2^8 | 256 entries |
| PT size | 256 * 2 bytes | 512 bytes |
| VA 0x4F3A: VPN | 0x4F3A >> 8 | 0x4F (79 decimal) |
| VA 0x4F3A: Offset | 0x4F3A & 0xFF | 0x3A (58 decimal) |
| PT base | 0x2000 | — |
| PTE address | 0x2000 + (0x4F * 2) | 0x209E |

### Scenario 2: 4 GB VAS, 256 MB PM, 4 KB pages (from S25 Midterm 1 B)

| Parameter | Calculation | Result |
|-----------|-------------|--------|
| VA bits | log2(4 GB) = log2(2^32) | 32 bits |
| Page size | 4 KB | — |
| Offset bits | log2(4096) = log2(2^12) | 12 bits |
| VPN bits | 32 - 12 | 20 bits |
| VPN entries | 2^20 | 1,048,576 |
| PTE size | 4 bytes (given) | — |
| PT size (bytes) | 2^20 * 4 | 4,194,304 bytes |
| PT size (MB) | 4,194,304 / (2^20) | 4 MB |

### Scenario 3: 1 GB VAS, 512 MB PM, 2 KB pages (from S25 Midterm 1 C)

| Parameter | Calculation | Result |
|-----------|-------------|--------|
| VA bits | log2(1 GB) = log2(2^30) | 30 bits |
| Page size | 2 KB | — |
| Offset bits | log2(2048) = log2(2^11) | 11 bits |
| VPN bits | 30 - 11 | 19 bits |
| VPN entries | 2^19 | 524,288 |
| PTE size | 4 bytes (given) | — |
| PT size (bytes) | 2^19 * 4 | 2,097,152 bytes |
| PT size (MB) | 2,097,152 / (2^20) | 2 MB |

### Scenario 4: Detailed PTE Address Lookup

Given: PT base = 0x1000, VA = 0x12AB, page size = 256 bytes, PTE size = 4 bytes

| Step | Calculation | Result |
|------|-------------|--------|
| Offset bits | log2(256) | 8 bits |
| VPN | 0x12AB >> 8 | 0x12 (18 decimal) |
| Offset | 0x12AB & 0xFF | 0xAB (171 decimal) |
| PTE address | 0x1000 + (0x12 * 4) | 0x1000 + 0x48 = 0x1048 |
| Assume PTE[0x12] = 0x00000007 | — | PFN = 0x07 (7 decimal) |
| Physical address | (0x07 << 8) \| 0xAB | (0x700) \| 0xAB = 0x7AB |

## Common exam questions

- 32-bit VA, 4 KB pages, 4-byte PTE. Compute: (a) offset bits, (b) VPN bits, (c) PT entries, (d) PT size in MB.
- 16-bit VA, 256-byte pages, 2-byte PTE, PT base 0x2000. For VA 0x4F3A, compute VPN, offset, and PTE address.
- 1 GB VAS, 2 KB pages, 4-byte PTE. How many bits for VPN? How many PT entries? PT size in MB?
- Given page size 512 bytes, how many offset bits?
- If VPN bits = 20, how many entries in the PT?

## Gotchas

- **Page size is always a power of 2**: If the problem states page size is 3 KB, it's malformed (real systems use 2^n). Assume 4 KB if unclear.
- **Offset bits are always log2(page_size)**: Don't confuse with physical memory size or address width. Offset size is determined solely by page size.
- **2^10 = 1024 ≈ 1000**: KB, MB, GB are powers of 2 (1024), not 1000. So 1 MB = 2^20 bytes, not 10^6.
- **PTE address calculation**: PT address = base + (VPN * PTE_size), not base + (VPN << VPN_bits). The shift works only if PTE size is a power of 2 (which it usually is).
- **PT size can exceed physical memory**: A 32-bit VA with 4 KB pages requires a 4 MB PT per process. Systems with many processes must use multi-level tables or inverted tables.

## Sources

- lectures/Week4_2.pdf: Offset and VPN bit counts, linear page table size, PTE fields
- zhang__quizzes__Attendance Quiz 5 S26 Key.txt (page 2): 16-bit VA, 256-byte pages example; VPN 0x4F, offset 0x3A, PTE address 0x209E
- exams__exam_1_prep__Midterm 1 Practice Answers.txt (page 100–105): Paging math examples (16B→4, 1KB→10, 1MB→20, 512B→9, 4KB→12 bits)
- exams__exam_1_prep__S25_Mid_1_B_COP4600.txt: 4 GB / 256 MB / 4 KB problem
- exams__exam_1_prep__S25_Mid_1_C_COP4600.txt: 1 GB / 512 MB / 2 KB problem
