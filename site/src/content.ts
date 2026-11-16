// Everything on the page that is a measured or observed fact lives here,
// so the numbers have one home. Source: README.md and results/ in this repository.

export const REPO = "https://github.com/white07S/minix-er937-nixos";

export const HEADLINE_FIGURES = [
  { value: "84 °C", label: "held for an hour at full load, no throttling" },
  { value: "65 W", label: "package power on all 24 threads" },
  { value: "2.5 W", label: "package power at idle" },
  { value: "1.25 GB", label: "RAM in use at idle, of 31.2 GB" },
];

export const PHASE_ROWS = [
  { phase: "Idle, 1 min", result: "", temp: "40 / 40", clock: "", power: "2.5" },
  {
    phase: "CPU, 60 min, 24 threads",
    result: "24 of 24 workers passed",
    temp: "84.3 / 87.9",
    clock: "3.66",
    power: "65.0",
  },
  {
    phase: "Memory, 30 min, 80% of RAM",
    result: "8 of 8 workers passed",
    temp: "68.3 / 95.6",
    clock: "1.95",
    power: "30.9",
  },
];

export const DISK_ROWS = [
  { test: "Write 8 GB with checksums, read back, verify", result: "0 errors" },
  { test: "Sequential write, 16 GB, 1 MB blocks", result: "6,600 MB/s" },
  { test: "Sequential read, 16 GB, 1 MB blocks", result: "7,240 MB/s" },
  { test: "Random read, 4 KB, queue depth 32", result: "614,000 operations/s" },
  { test: "Random write, 4 KB, queue depth 32", result: "442,000 operations/s" },
];

export type Support = "Tested" | "Detected" | "Not visible";

export const HARDWARE_ROWS: { part: string; driver: string; support: Support; note: string }[] = [
  { part: "CPU and clock scaling", driver: "amd-pstate-epp", support: "Tested", note: "An hour on all 24 threads" },
  { part: "Memory", driver: "", support: "Tested", note: "30 minutes over 80% of RAM" },
  { part: "NVMe SSD", driver: "nvme", support: "Tested", note: "Write-and-verify and throughput" },
  { part: "Both 2.5 GbE ports", driver: "r8169", support: "Tested", note: "A 2.5 Gb/s link was negotiated" },
  { part: "Temperatures", driver: "k10temp, nvme, spd5118, amdgpu", support: "Tested", note: "CPU, SSD, both RAM sticks, graphics" },
  { part: "Package power", driver: "intel-rapl", support: "Tested", note: "The processor's own figure, not wall power" },
  { part: "Virtualisation", driver: "kvm-amd", support: "Detected", note: "/dev/kvm present; no guest run yet" },
  { part: "TPM 2.0", driver: "tpm_crb", support: "Detected", note: "Not used yet" },
  { part: "Radeon 890M", driver: "amdgpu", support: "Detected", note: "Text console works over HDMI; nothing else tried" },
  { part: "NPU", driver: "amdxdna", support: "Detected", note: "/dev/accel/accel0 appears; no workload run" },
  { part: "Wi-Fi", driver: "mt7925e", support: "Detected", note: "Interface appears; never connected" },
  { part: "Bluetooth", driver: "btusb, btmtk", support: "Detected", note: "Controller appears" },
  { part: "Audio", driver: "snd_hda_intel", support: "Detected", note: "Two devices appear" },
  { part: "USB4", driver: "thunderbolt", support: "Detected", note: "Controller driver loads" },
  { part: "Fingerprint reader", driver: "", support: "Detected", note: "On USB as 2808:c655; no driver tried" },
  { part: "Fan speed", driver: "", support: "Not visible", note: "The firmware controls the fans" },
];

export const SUPPORT_MEANING: Record<Support, string> = {
  Tested: "exercised and working",
  Detected: "the driver loads; not exercised",
  "Not visible": "Linux cannot see it",
};

export const RUN_COMMANDS = {
  nixQuick: "sudo nix run github:white07S/minix-er937-nixos -- --quick",
  nixFull: "sudo nix run github:white07S/minix-er937-nixos",
  plain: "sudo python3 loadtest.py --quick",
};

export const OUTPUT_FILES = [
  { file: "RESULTS.md", what: "A pass or fail verdict and the tables, ready to share" },
  { file: "summary.json", what: "The same numbers in machine-readable form" },
  { file: "samples.csv", what: "One row per reading: temperatures, clock speed, power, load" },
  { file: "kernel_concerns.txt", what: "New kernel log lines about hardware, heat or I/O errors" },
];

export const FIRMWARE_NOTES = [
  {
    title: "Entering the BIOS",
    text: "The key is not documented. From Windows, shutdown /r /fw /t 5 works: the first call fails with error 203 and the second succeeds. From Linux: systemctl reboot --firmware-setup.",
  },
  {
    title: "A plugged-in USB stick wins",
    text: "After installing, the machine booted the installer stick again although the internal disk was first in the boot order. Power off, pull the stick, then power on.",
  },
  {
    title: "Secure Boot",
    text: "On from the factory. It has to be turned off for the NixOS installer, on the Security tab.",
  },
  {
    title: "Power mode",
    text: "PowerLimit Setting, under Advanced and CPU. The factory value is Balance Mode; these results were measured in Performance Mode.",
  },
  {
    title: "No firmware-injected software",
    text: "The firmware has no WPBT table, so nothing is re-installed into an operating system behind your back. The Windows licence key stays in the firmware after Windows is wiped.",
  },
];

export const LIMITS = [
  "One unit and one run. Another unit, another room or another BIOS version may differ.",
  "Only Performance Mode was measured. The factory setting is Balance Mode.",
  "Power is the processor package only. Power at the wall was not measured.",
  "Fan speed and noise were not measured, and room temperature was not recorded.",
  "The disk figures are short runs on a nearly empty drive, so they show burst speed.",
];
