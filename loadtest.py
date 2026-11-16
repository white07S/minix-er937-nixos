#!/usr/bin/env python3
"""Load test for a small Linux machine.

Runs an idle baseline, a short CPU benchmark, a long CPU test, a memory test and a
disk test, while logging CPU temperature, SSD temperature, clock speed and package
power every few seconds. Writes the raw readings and a summary to a directory.

Needs root, stress-ng and fio. smartctl (smartmontools) is optional and adds the
SSD health comparison. Python standard library only.
"""

import argparse
import csv
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

RAPL = Path("/sys/class/powercap/intel-rapl:0/energy_uj")
CONCERN = re.compile(
    r"mce:|hardware error|thermal|throttl|out of memory|i/o error|nvme.*(timeout|reset)|call trace",
    re.IGNORECASE,
)
SMART_FIELDS = [
    ("critical_warning", "Critical warning"),
    ("available_spare", "Available spare (%)"),
    ("percentage_used", "Percentage used (%)"),
    ("media_errors", "Media and data integrity errors"),
    ("num_err_log_entries", "Error log entries"),
    ("data_units_written", "Data units written"),
    ("unsafe_shutdowns", "Unsafe shutdowns"),
]


# --- sensors ---------------------------------------------------------------

def hwmon_temp(*names):
    """Path of the first temperature input of the first hwmon device with one of these names."""
    for directory in sorted(glob.glob("/sys/class/hwmon/hwmon*")):
        try:
            if Path(directory, "name").read_text().strip() in names:
                return Path(directory, "temp1_input")
        except OSError:
            continue
    return None


def read_celsius(path):
    try:
        return round(int(path.read_text()) / 1000, 1)
    except (OSError, ValueError, AttributeError):
        return None


def clock_speeds_mhz():
    speeds = []
    for name in glob.glob("/sys/devices/system/cpu/cpu[0-9]*/cpufreq/scaling_cur_freq"):
        try:
            speeds.append(int(Path(name).read_text()) / 1000)
        except (OSError, ValueError):
            continue
    return speeds


class Sampler(threading.Thread):
    """Appends one row of readings to a CSV file every `interval` seconds."""

    COLUMNS = ["time", "phase", "cpu_c", "nvme_c", "avg_mhz", "max_mhz", "pkg_w", "load1"]

    def __init__(self, path, interval):
        super().__init__(daemon=True)
        self.path = path
        self.interval = interval
        self.phase = "idle"
        self.rows = []
        self._stop = threading.Event()
        self._cpu = hwmon_temp("k10temp", "zenpower", "coretemp")
        self._nvme = hwmon_temp("nvme")

    def stop(self):
        self._stop.set()
        self.join()

    def run(self):
        previous_energy = previous_time = None
        with open(self.path, "w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=self.COLUMNS)
            writer.writeheader()
            while not self._stop.is_set():
                now = time.monotonic()
                watts = None
                try:
                    energy = int(RAPL.read_text())
                    if previous_energy is not None and energy >= previous_energy:
                        watts = (energy - previous_energy) / 1e6 / (now - previous_time)
                    previous_energy, previous_time = energy, now
                except (OSError, ValueError):
                    pass
                speeds = clock_speeds_mhz()
                row = {
                    "time": datetime.now().strftime("%H:%M:%S"),
                    "phase": self.phase,
                    "cpu_c": read_celsius(self._cpu),
                    "nvme_c": read_celsius(self._nvme),
                    "avg_mhz": round(sum(speeds) / len(speeds)) if speeds else None,
                    "max_mhz": round(max(speeds)) if speeds else None,
                    "pkg_w": round(watts, 1) if watts is not None else None,
                    "load1": float(Path("/proc/loadavg").read_text().split()[0]),
                }
                self.rows.append(row)
                writer.writerow({k: ("" if v is None else v) for k, v in row.items()})
                handle.flush()
                self._stop.wait(self.interval)


# --- running and parsing the tools ------------------------------------------

def run_to_file(command, output):
    with open(output, "w") as handle:
        return subprocess.run(command, stdout=handle, stderr=subprocess.STDOUT).returncode


def parse_stress(path, stressor):
    text = Path(path).read_text()
    result = {"passed": None, "failed": None, "ops_per_s": None}
    for key in ("passed", "failed"):
        match = re.search(rf"{key}: (\d+)", text)
        if match:
            result[key] = int(match.group(1))
    # "... ] cpu  <bogo ops>  <real s>  <usr s>  <sys s>  <ops/s real>  <ops/s cpu>"
    match = re.search(rf"\]\s+{stressor}\s+\d+\s+[\d.]+\s+[\d.]+\s+[\d.]+\s+([\d.]+)", text)
    if match:
        result["ops_per_s"] = float(match.group(1))
    return result


def run_fio(fio, out_dir, name, filename, size_gb, extra):
    output = out_dir / f"fio_{name}.json"
    command = [
        fio, f"--name={name}", f"--filename={filename}", f"--size={size_gb}G",
        "--direct=1", "--ioengine=libaio", "--output-format=json", f"--output={output}",
    ] + extra
    code = subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode
    result = {"exit": code, "error": None}
    try:
        job = json.loads(output.read_text())["jobs"][0]
        result["error"] = job.get("error", 0)
        for direction in ("read", "write"):
            if job[direction]["io_bytes"]:
                result[direction] = {
                    "mb_per_s": round(job[direction]["bw_bytes"] / 1e6),
                    "iops": round(job[direction]["iops"]),
                }
    except (OSError, ValueError, KeyError, IndexError):
        result["error"] = "unreadable fio output"
    return result


def whole_disk_for(path):
    """The whole-disk device that holds `path`, e.g. /dev/nvme0n1 for a file on /dev/nvme0n1p2."""
    try:
        source = subprocess.run(
            ["findmnt", "-no", "SOURCE", "-T", str(path)], capture_output=True, text=True
        ).stdout.strip()
    except OSError:
        return None
    for pattern in (r"^(/dev/nvme\d+n\d+)p\d+$", r"^(/dev/[sv]d[a-z]+)\d+$"):
        match = re.match(pattern, source)
        if match:
            return match.group(1)
    return None


def smart_health(device):
    if not device or not shutil.which("smartctl"):
        return None
    try:
        data = json.loads(
            subprocess.run(["smartctl", "-j", "-a", device], capture_output=True, text=True).stdout
        )
    except (OSError, ValueError):
        return None
    return data.get("nvme_smart_health_information_log")


def kernel_log():
    try:
        return subprocess.run(["dmesg"], capture_output=True, text=True).stdout.splitlines()
    except OSError:
        return []


# --- summary -----------------------------------------------------------------

def phase_stats(rows):
    stats = {}
    for phase in dict.fromkeys(row["phase"] for row in rows):
        selected = [row for row in rows if row["phase"] == phase]

        def values(key):
            return [row[key] for row in selected if row[key] is not None]

        def mean(items):
            return round(sum(items) / len(items), 1) if items else None

        cpu, nvme, mhz, watts = values("cpu_c"), values("nvme_c"), values("avg_mhz"), values("pkg_w")
        stats[phase] = {
            "samples": len(selected),
            "cpu_c_avg": mean(cpu), "cpu_c_max": max(cpu) if cpu else None,
            "nvme_c_max": max(nvme) if nvme else None,
            "avg_mhz": mean(mhz), "min_avg_mhz": min(mhz) if mhz else None,
            "pkg_w_avg": mean(watts), "pkg_w_max": max(watts) if watts else None,
        }
    return stats


def machine_facts():
    def read(path):
        try:
            return Path(path).read_text().strip()
        except OSError:
            return "unknown"

    cpu = "unknown"
    for line in read("/proc/cpuinfo").splitlines():
        if line.startswith("model name"):
            cpu = line.split(":", 1)[1].strip()
            break
    memory_gb = "unknown"
    match = re.search(r"MemTotal:\s+(\d+)", read("/proc/meminfo"))
    if match:
        memory_gb = round(int(match.group(1)) / 1048576, 1)
    return {
        "product": read("/sys/class/dmi/id/product_name"),
        "bios": read("/sys/class/dmi/id/bios_version"),
        "cpu": cpu,
        "threads": os.cpu_count(),
        "memory_gb": memory_gb,
        "kernel": os.uname().release,
        "cpufreq_driver": read("/sys/devices/system/cpu/cpu0/cpufreq/scaling_driver"),
    }


def show(value, unit=""):
    return "n/a" if value is None else f"{value}{unit}"


def write_markdown(path, summary):
    facts, stats, lines = summary["machine"], summary["phases"], []
    add = lines.append
    add(f"# Load test results, {summary['started']}")
    add("")
    add(f"**Verdict: {'PASS' if summary['passed'] else 'FAIL'}**")
    for problem in summary["problems"]:
        add(f"- {problem}")
    add("")
    add("| Machine | |")
    add("|---|---|")
    for label, key in (("Product", "product"), ("BIOS", "bios"), ("CPU", "cpu"), ("Threads", "threads"),
                       ("Memory (GB)", "memory_gb"), ("Kernel", "kernel"), ("Clock driver", "cpufreq_driver")):
        add(f"| {label} | {facts[key]} |")
    add("")
    add("| Phase | Samples | CPU °C avg / max | SSD °C max | Clock MHz avg | Package W avg / max |")
    add("|---|---|---|---|---|---|")
    for phase, s in stats.items():
        add(f"| {phase} | {s['samples']} | {show(s['cpu_c_avg'])} / {show(s['cpu_c_max'])} | "
            f"{show(s['nvme_c_max'])} | {show(s['avg_mhz'])} | {show(s['pkg_w_avg'])} / {show(s['pkg_w_max'])} |")
    add("")
    add("| Test | Result |")
    add("|---|---|")
    bench, cpu, mem = summary["benchmark"], summary["cpu"], summary["memory"]
    add(f"| Benchmark (matrix product) | {show(bench['ops_per_s'])} operations/s |")
    add(f"| CPU, results verified | {show(cpu['passed'])} workers passed, {show(cpu['failed'])} failed |")
    add(f"| Memory, results verified | {show(mem['passed'])} workers passed, {show(mem['failed'])} failed |")
    for name, label in (("verify", "Disk write and verify"), ("seqwrite", "Sequential write"),
                        ("seqread", "Sequential read"), ("randread", "Random read 4 KB"),
                        ("randwrite", "Random write 4 KB")):
        result = summary["disk"].get(name)
        if not result:
            continue
        if name == "verify":
            add(f"| {label} | error code {result['error']} |")
            continue
        direction = result.get("read") or result.get("write") or {}
        add(f"| {label} | {show(direction.get('mb_per_s'))} MB/s, {show(direction.get('iops'))} operations/s |")
    add("")
    if summary["smart_before"] and summary["smart_after"]:
        add("| SSD health | Before | After |")
        add("|---|---|---|")
        for key, label in SMART_FIELDS:
            add(f"| {label} | {summary['smart_before'].get(key)} | {summary['smart_after'].get(key)} |")
        add("")
    add("Package power is what the processor reports for itself, not power at the wall.")
    path.write_text("\n".join(lines) + "\n")


# --- main --------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default="loadtest-results", help="directory for the results")
    parser.add_argument("--quick", action="store_true", help="a five-minute smoke run instead of the full test")
    parser.add_argument("--threads", type=int, default=os.cpu_count(), help="CPU workers (default: all threads)")
    parser.add_argument("--cpu-minutes", type=float, default=60)
    parser.add_argument("--memory-minutes", type=float, default=30)
    parser.add_argument("--memory-workers", type=int, default=8)
    parser.add_argument("--memory-percent", type=int, default=80, help="share of RAM the memory test fills")
    parser.add_argument("--benchmark-seconds", type=int, default=60)
    parser.add_argument("--idle-seconds", type=int, default=60)
    parser.add_argument("--cooldown-seconds", type=int, default=120)
    parser.add_argument("--interval", type=float, default=10, help="seconds between readings")
    parser.add_argument("--disk-file", default="/var/tmp/loadtest.fio", help="scratch file for the disk test")
    parser.add_argument("--disk-size-gb", type=int, default=16)
    parser.add_argument("--disk-seconds", type=int, default=60, help="length of each random I/O run")
    parser.add_argument("--device", help="whole-disk device for SMART (default: the one holding --disk-file)")
    parser.add_argument("--skip-disk", action="store_true")
    args = parser.parse_args()

    if args.quick:
        args.cpu_minutes, args.memory_minutes = 2, 1
        args.benchmark_seconds, args.idle_seconds, args.cooldown_seconds = 30, 20, 20
        args.disk_size_gb, args.disk_seconds, args.interval = 2, 15, 5

    if os.geteuid() != 0:
        sys.exit("Run as root: the test reads power counters, SMART data and the kernel log.")
    stress, fio = shutil.which("stress-ng"), shutil.which("fio")
    if not stress or (not fio and not args.skip_disk):
        sys.exit("stress-ng and fio must be installed and on PATH.")

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    device = args.device or whole_disk_for(Path(args.disk_file).parent)
    started = datetime.now().strftime("%Y-%m-%d %H:%M")
    problems = []

    def announce(sampler, phase, message):
        sampler.phase = phase
        print(f"[{datetime.now():%H:%M:%S}] {message}", flush=True)

    sampler = Sampler(out / "samples.csv", args.interval)
    sampler.start()
    smart_before, log_before = smart_health(device), kernel_log()

    announce(sampler, "idle", f"idle baseline, {args.idle_seconds} s")
    time.sleep(args.idle_seconds)

    announce(sampler, "bench", f"benchmark, {args.benchmark_seconds} s on {args.threads} threads")
    run_to_file([stress, "--cpu", str(args.threads), "--cpu-method", "matrixprod",
                 "--timeout", f"{args.benchmark_seconds}s", "--metrics-brief"], out / "bench.txt")
    benchmark = parse_stress(out / "bench.txt", "cpu")

    announce(sampler, "cpu", f"CPU, {args.cpu_minutes:g} min, all methods, results verified")
    code = run_to_file([stress, "--cpu", str(args.threads), "--cpu-method", "all", "--verify",
                        "--timeout", f"{round(args.cpu_minutes * 60)}s", "--metrics-brief"], out / "cpu.txt")
    cpu = parse_stress(out / "cpu.txt", "cpu")
    if code != 0 or cpu["failed"]:
        problems.append(f"CPU test: exit code {code}, {cpu['failed']} workers failed")

    announce(sampler, "cooldown", f"cooldown, {args.cooldown_seconds} s")
    time.sleep(args.cooldown_seconds)

    announce(sampler, "mem", f"memory, {args.memory_minutes:g} min over {args.memory_percent}% of RAM, results verified")
    code = run_to_file([stress, "--vm", str(args.memory_workers), "--vm-bytes", f"{args.memory_percent}%",
                        "--vm-method", "all", "--verify",
                        "--timeout", f"{round(args.memory_minutes * 60)}s", "--metrics-brief"], out / "mem.txt")
    memory = parse_stress(out / "mem.txt", "vm")
    if code != 0 or memory["failed"]:
        problems.append(f"Memory test: exit code {code}, {memory['failed']} workers failed")

    disk = {}
    if not args.skip_disk:
        announce(sampler, "disk", f"disk, {args.disk_size_gb} GB scratch file at {args.disk_file}")
        size, half = args.disk_size_gb, max(1, args.disk_size_gb // 2)
        timed = [f"--runtime={args.disk_seconds}", "--time_based"]
        try:
            disk["verify"] = run_fio(fio, out, "verify", args.disk_file, half,
                                     ["--bs=1M", "--rw=write", "--iodepth=8", "--verify=crc32c", "--do_verify=1"])
            disk["seqwrite"] = run_fio(fio, out, "seqwrite", args.disk_file, size, ["--bs=1M", "--rw=write", "--iodepth=8"])
            disk["seqread"] = run_fio(fio, out, "seqread", args.disk_file, size, ["--bs=1M", "--rw=read", "--iodepth=8"])
            disk["randread"] = run_fio(fio, out, "randread", args.disk_file, size, ["--bs=4k", "--rw=randread", "--iodepth=32"] + timed)
            disk["randwrite"] = run_fio(fio, out, "randwrite", args.disk_file, size, ["--bs=4k", "--rw=randwrite", "--iodepth=32"] + timed)
        finally:
            Path(args.disk_file).unlink(missing_ok=True)
        for name, result in disk.items():
            if result["exit"] != 0 or result["error"]:
                problems.append(f"Disk {name}: exit code {result['exit']}, error {result['error']}")

    announce(sampler, "after", "collecting SMART data and the kernel log")
    smart_after, log_after = smart_health(device), kernel_log()
    sampler.stop()

    new_lines = log_after[len(log_before):] if log_after[:len(log_before)] == log_before else log_after
    concerns = [line for line in new_lines if CONCERN.search(line)]
    (out / "kernel_concerns.txt").write_text("\n".join(concerns) + ("\n" if concerns else ""))
    if concerns:
        problems.append(f"{len(concerns)} kernel log lines of concern (see kernel_concerns.txt)")
    if smart_before and smart_after:
        if smart_after.get("critical_warning"):
            problems.append("SSD reports a critical warning")
        if smart_after.get("media_errors", 0) > smart_before.get("media_errors", 0):
            problems.append("SSD media errors increased")

    summary = {
        "started": started, "passed": not problems, "problems": problems,
        "machine": machine_facts(), "settings": vars(args), "device": device,
        "benchmark": benchmark, "cpu": cpu, "memory": memory, "disk": disk,
        "phases": phase_stats(sampler.rows),
        "smart_before": smart_before, "smart_after": smart_after,
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    write_markdown(out / "RESULTS.md", summary)
    print(f"[{datetime.now():%H:%M:%S}] {'PASS' if not problems else 'FAIL'}: results in {out}/", flush=True)
    for problem in problems:
        print(f"  - {problem}")
    sys.exit(0 if not problems else 1)


if __name__ == "__main__":
    main()
