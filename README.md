# MINIX ER937-AI on Linux

Notes, measurements and a reproducible load test for the MINIX ER937-AI mini PC
(AMD Ryzen AI 9 HX 370, 32 GB, 1 TB) running headless NixOS 26.05.

Everything here comes from **one unit, tested once, in November 2026**. Treat it as a data
point, not a review.

**The results with charts: https://white07s.github.io/minix-er937-nixos/**
(source in [`site/`](site/), built and published by GitHub Actions).

- [What works under Linux](#what-works-under-linux)
- [Measured results](#measured-results)
- [Run the same test on your machine](#run-the-same-test-on-your-machine)
- [Install NixOS on this machine](#install-nixos-on-this-machine)
- [Firmware notes](#firmware-notes)

## The machine

| | |
|---|---|
| Model | MINIX ER937-AI, BIOS `FP8NS110` (AMI Aptio, 2025-08-28) |
| CPU | AMD Ryzen AI 9 HX 370: 12 cores, 24 threads (4 full cores to 5.16 GHz, 8 compact cores to 3.29 GHz) |
| Memory | 2 × 16 GB Samsung DDR5-5600 SO-DIMM; both slots populated |
| Storage | Kingston `OM8SGP41024K2-A00` 1 TB NVMe; a second M.2 2280 slot is free |
| Network | 2 × Realtek RTL8125 2.5 GbE, MediaTek MT7925 Wi-Fi 7 and Bluetooth |
| Other | Radeon 890M graphics, XDNA 2 NPU, firmware TPM 2.0, FocalTech fingerprint reader, 2 × USB4 |
| Software | NixOS 26.05, kernel 6.18.63, ZFS 2.4.4 |

## What works under Linux

Kernel 6.18.63 with the stock NixOS 26.05 firmware package. No out-of-tree drivers.

| Part | Driver | Status |
|---|---|---|
| CPU and clock scaling | `amd-pstate-epp` | Works. Load-tested for an hour on all threads |
| Memory | | Works. Tested for 30 minutes over 80 % of RAM |
| NVMe SSD | `nvme` | Works. Write-and-verify and throughput tests passed |
| Both 2.5 GbE ports | `r8169` | Work. A 2.5 Gb/s link was negotiated |
| Temperatures | `k10temp`, `nvme`, `spd5118`, `amdgpu` | CPU, SSD, both RAM sticks and graphics all report |
| Package power | `intel-rapl` powercap | Reports (the processor's own figure, not wall power) |
| Fan speed | | Not visible to Linux; the firmware controls the fans |
| Virtualisation | `kvm-amd` | `/dev/kvm` present; enabled in the BIOS by default. No guest run yet |
| TPM 2.0 | `tpm_crb` | Detected. Not used yet |
| Radeon 890M | `amdgpu` | Driver loads and the text console works over HDMI. Nothing else tested |
| NPU | `amdxdna` | Driver loads, firmware loads, `/dev/accel/accel0` appears. No workload run |
| Wi-Fi | `mt7925e` | Driver loads and the interface appears. Not connected or tested |
| Bluetooth | `btusb`, `btmtk` | Controller appears. Not tested |
| Audio | `snd_hda_intel` | Two devices appear. Not tested |
| USB4 | `thunderbolt` | Controller driver loads. Not tested |
| Fingerprint reader | | Appears on USB as `2808:c655`. Not tested |
| Suspend | | Not tested (the machine runs as a server) |

## Measured results

One run on 2026-11-16, headless, BIOS power setting **Performance Mode**, room temperature not
measured. Raw 10-second readings are in
[`results/2026-11-16-performance/samples.csv`](results/2026-11-16-performance/samples.csv).
**Everything passed, and the kernel logged no hardware, thermal or I/O errors.**

### Temperature, clock speed and power

| Phase | Result | CPU temp avg / peak | Clock speed avg | Package power avg |
|---|---|---|---|---|
| Idle, 1 min | | 40 °C / 40 °C | | 2.5 W |
| CPU, 60 min, 24 threads | 24 of 24 workers passed, results verified | 84.3 °C / 87.9 °C | 3.66 GHz | 65.0 W |
| Memory, 30 min, 80 % of RAM | 8 of 8 workers passed, results verified | 68.3 °C / 95.6 °C | 1.95 GHz | 30.9 W |

- **No throttling under sustained load.** The CPU phase peaked at 87.9 °C in the first ten
  minutes, then held 84 °C for the remaining fifty. The lowest average clock speed in any sample
  was 3.63 GHz.
- **One hot reading in the memory phase.** A single sample reached 95.6 °C. It was the only one of
  180 at or above 90 °C. With one reading every 10 seconds, its duration is unknown.
- **Fast recovery.** Two minutes after the CPU phase the temperature was back under 50 °C.
- **Idle memory** on this headless configuration: 1.25 GB of 31.2 GB.

### One-minute benchmark

`stress-ng --cpu 24 --cpu-method matrixprod --timeout 60s` gave **14,018 operations per second**
in Performance Mode (peak 78.9 °C, peak 69.6 W). It is recorded so that other power modes and
other units can be compared against it.

### Disk

On the ext4 system partition of the factory Kingston SSD. These are short runs on a nearly empty
drive, so they show burst speed, not sustained behaviour.

| Test | Result |
|---|---|
| Write 8 GB with checksums, read back and verify | 0 errors |
| Sequential write, 16 GB, 1 MB blocks | 6,600 MB/s |
| Sequential read, 16 GB, 1 MB blocks | 7,240 MB/s |
| Random read, 4 KB, queue depth 32, 60 s | 614,000 operations/s |
| Random write, 4 KB, queue depth 32, 60 s | 442,000 operations/s |

SMART before and after: no critical warning, no media errors, spare 100 %, wear 0 %. The SSD
reached 54 °C during the disk tests.

### What these numbers do not tell you

- They are from one unit and one run. Another unit, another room or another BIOS version may differ.
- The full run above was made with an earlier shell version of the test. `loadtest.py` runs the
  same tools with the same options; it was checked on the same machine with a five-minute run,
  whose output is in [`results/2026-11-17-quick/`](results/2026-11-17-quick/RESULTS.md) and agrees
  with the full run (benchmark 14,007 against 14,018 operations per second).
- Only Performance Mode was measured. The factory setting is Balance Mode.
- Power is the processor package only. Power at the wall was not measured.
- Fan speed and noise were not measured.

## Run the same test on your machine

The test is [`loadtest.py`](loadtest.py): Python standard library only, driving `stress-ng` and
`fio`. It works on any Linux machine, not only this one. It needs root, because it reads the
power counters, SMART data and the kernel log.

**With Nix** (tools are fetched for you):

```sh
sudo nix run github:white07S/minix-er937-nixos -- --quick    # about 5 minutes
sudo nix run github:white07S/minix-er937-nixos               # the full run, about 100 minutes
```

**Without Nix**, install `stress-ng`, `fio` and optionally `smartmontools`, then:

```sh
sudo python3 loadtest.py --quick
sudo python3 loadtest.py
```

The full run is: 1 minute idle, a 1-minute benchmark, 60 minutes of CPU load on every thread,
2 minutes of cooldown, 30 minutes of memory load, then about 6 minutes of disk tests. Every
duration is an option; see `python3 loadtest.py --help`.

It writes a directory (default `loadtest-results/`); [`results/2026-11-17-quick/`](results/2026-11-17-quick/)
is a real example. It contains:

| File | Contents |
|---|---|
| `RESULTS.md` | A pass or fail verdict and the tables, ready to share |
| `summary.json` | The same numbers in machine-readable form |
| `samples.csv` | One row per reading: temperatures, clock speed, power, load |
| `bench.txt`, `cpu.txt`, `mem.txt`, `fio_*.json` | The raw output of each tool |
| `kernel_concerns.txt` | Any new kernel log lines about hardware, heat or I/O errors |

Things to know before running it:

- **The disk test writes real data**: about 125 GB in the full run, to a scratch file
  (`--disk-file`, default `/var/tmp/loadtest.fio`) that is removed afterwards. Use `--skip-disk`
  to leave the disk alone.
- **The memory test fills 80 % of RAM.** Do not run it next to anything you care about.
- The exit code is non-zero if any test fails, so it can be used in a script.

If you run it on an ER937-AI, or on another machine with this processor, a pull request adding
your `results/` directory is welcome.

## Install NixOS on this machine

[`nixos/`](nixos/) holds the configuration the results were measured on, with keys and
identifiers replaced by placeholders: a headless host with keys-only SSH, both network ports on
DHCP, a small ext4 root, a ZFS pool for data, and Incus for virtual machines and containers.

[`docs/install.md`](docs/install.md) is the step-by-step install, including the two firmware
quirks that cost time.

## Firmware notes

- **Entering the BIOS.** The key is not documented. From Windows, `shutdown /r /fw /t 5` works; the
  first call fails with error 203 and the second succeeds. From Linux:
  `systemctl reboot --firmware-setup`.
- **Secure Boot** is on from the factory and has to be turned off for the NixOS installer
  (Security tab).
- **Power mode** is `PowerLimit Setting` under Advanced, CPU. The factory value is Balance Mode.
- **Power on after power loss** is `Power Loss State` under Advanced, Power Settings. The factory
  value is Off.
- **A plugged-in USB stick wins.** After installing, the machine booted the installer stick again
  even though the internal disk was first in the firmware's boot order. Power off, pull the stick,
  then power on.
- **No firmware-injected software.** The firmware has no WPBT table, so nothing is re-installed
  into an operating system behind your back. The Windows licence key (MSDM table) stays in the
  firmware after Windows is wiped.
- The factory Windows 11 Pro install carried no vendor software beyond AMD's installer. It idled at
  11.8 GB of RAM in use.

## Licence

MIT. See [`LICENSE`](LICENSE).
