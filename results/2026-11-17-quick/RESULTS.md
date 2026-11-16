# Load test results, 2026-11-17 00:30

**Verdict: PASS**

| Machine | |
|---|---|
| Product | Minix ER937-AI |
| BIOS | FP8NS110 |
| CPU | AMD Ryzen AI 9 HX 370 w/ Radeon 890M |
| Threads | 24 |
| Memory (GB) | 30.5 |
| Kernel | 6.18.63 |
| Clock driver | amd-pstate-epp |

| Phase | Samples | CPU °C avg / max | SSD °C max | Clock MHz avg | Package W avg / max |
|---|---|---|---|---|---|
| idle | 4 | 47.8 / 52.1 | 39.9 | 1020.2 | 2.4 / 2.6 |
| bench | 6 | 71.7 / 78.5 | 40.9 | 3493.7 | 56.3 / 70.0 |
| cpu | 24 | 83.2 / 84.0 | 36.9 | 3662.7 | 65.0 / 65.2 |
| cooldown | 4 | 61.4 / 80.9 | 36.9 | 708.2 | 17.4 / 61.5 |
| mem | 13 | 71.4 / 88.2 | 37.9 | 1783.9 | 38.1 / 62.5 |
| disk | 6 | 71.0 / 74.5 | 44.9 | 1509.3 | 20.3 / 22.4 |

| Test | Result |
|---|---|
| Benchmark (matrix product) | 14006.8 operations/s |
| CPU, results verified | 24 workers passed, 0 failed |
| Memory, results verified | 8 workers passed, 0 failed |
| Disk write and verify | error code 0 |
| Sequential write | 6354 MB/s, 6059 operations/s |
| Sequential read | 7182 MB/s, 6849 operations/s |
| Random read 4 KB | 2517 MB/s, 614547 operations/s |
| Random write 4 KB | 2247 MB/s, 548616 operations/s |

| SSD health | Before | After |
|---|---|---|
| Critical warning | 0 | 0 |
| Available spare (%) | 100 | 100 |
| Percentage used (%) | 0 | 0 |
| Media and data integrity errors | 0 | 0 |
| Error log entries | 0 | 0 |
| Data units written | 629085 | 701362 |
| Unsafe shutdowns | 2 | 2 |

Package power is what the processor reports for itself, not power at the wall.
