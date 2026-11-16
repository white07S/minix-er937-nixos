import { CircleCheck, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { CopyCommand } from "./components/CopyCommand";
import { RunChart } from "./components/RunChart";
import {
  DISK_ROWS,
  FIRMWARE_NOTES,
  HARDWARE_ROWS,
  HEADLINE_FIGURES,
  LIMITS,
  OUTPUT_FILES,
  PHASE_ROWS,
  REPO,
  RUN_COMMANDS,
  SUPPORT_MEANING,
  type Support,
} from "./content";
import { samples, spans } from "./data";

function Section({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="flex min-w-0 scroll-mt-8 flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {intro && <p className="max-w-[68ch] text-fg-2">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr>
            {head.map((label) => (
              <th
                key={label}
                className="border-b border-line py-2 pr-4 text-left font-mono text-[11px] font-medium tracking-[0.08em] text-fg-3 uppercase last:pr-0"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:border-line [&_td]:py-2 [&_td]:pr-4 [&_td]:align-top [&_td:last-child]:pr-0 [&_tr:last-child_td]:border-b-0">
          {children}
        </tbody>
      </table>
    </div>
  );
}

const SUPPORT_STYLE: Record<Support, string> = {
  Tested: "border-fg-2 text-fg",
  Detected: "border-line text-fg-2",
  "Not visible": "border-dashed border-line text-fg-3",
};

function RepoLink({ path, children }: { path: string; children: ReactNode }) {
  return (
    <a
      href={`${REPO}/${path}`}
      className="font-medium text-fg underline decoration-line underline-offset-4 transition-colors duration-150 hover:decoration-fg-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series"
    >
      {children}
    </a>
  );
}

export default function App() {
  return (
    <main className="mx-auto flex max-w-[1040px] flex-col gap-12 px-4 py-12 sm:px-6">
      <header className="flex flex-col gap-4">
        <p className="font-mono text-xs tracking-[0.04em] text-fg-3 uppercase">One unit · November 2026 · NixOS 26.05</p>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-balance">MINIX ER937-AI on Linux</h1>
        <p className="max-w-[62ch] text-fg-2">
          What works, what it measures under load, and a test you can run on your own machine. The mini PC has a Ryzen
          AI 9 HX 370, 32 GB of RAM and a 1 TB SSD, and runs here as a headless server.
        </p>
        <p className="flex items-center gap-2 font-medium">
          <CircleCheck size={18} strokeWidth={2} className="shrink-0 text-good" aria-hidden />
          Passed a 96-minute load test with no errors
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <a
            href="#run"
            className="rounded-lg bg-fg px-4 py-2 text-sm font-medium text-bg transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series active:scale-[0.97]"
          >
            Run the test yourself
          </a>
          <a
            href={REPO}
            className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-fg-2 transition-[transform,color,background-color] duration-150 ease-out hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-series active:scale-[0.97]"
          >
            Source on GitHub
            <ExternalLink size={14} strokeWidth={2} aria-hidden />
          </a>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
        {HEADLINE_FIGURES.map((figure) => (
          <div key={figure.label} className="flex flex-col gap-1 border-t border-line pt-4">
            <dd className="text-2xl font-semibold tracking-tight tabular-nums">{figure.value}</dd>
            <dt className="text-sm text-fg-2">{figure.label}</dt>
          </div>
        ))}
      </dl>

      <Section
        id="run-chart"
        title="The 96-minute run"
        intro="One reading every 10 seconds, with the BIOS in Performance Mode. An hour of full CPU load, then half an hour of memory load, then the disk."
      >
        <figure className="flex min-w-0 flex-col gap-4">
          <div className="rounded-xl border border-line bg-surface p-4">
            <RunChart samples={samples} spans={spans} />
          </div>
          <figcaption className="max-w-[68ch] text-sm text-fg-2">
            Under full load the temperature settles at 84 °C within ten minutes and the clock speed never drops, so the
            processor is not throttling. The single 95.6 °C reading came during the memory test and was the only one of
            180 at or above 90 °C. The small regular dips in the power line come from how power is sampled, not from
            the processor. The raw readings are in{" "}
            <RepoLink path="blob/main/results/2026-11-16-performance/samples.csv">samples.csv</RepoLink>.
          </figcaption>
        </figure>

        <Table head={["Phase", "Result", "CPU °C avg / peak", "Clock GHz", "Package W"]}>
          {PHASE_ROWS.map((row) => (
            <tr key={row.phase}>
              <td className="font-medium">{row.phase}</td>
              <td className="text-fg-2">{row.result}</td>
              <td className="font-mono tabular-nums">{row.temp}</td>
              <td className="font-mono tabular-nums">{row.clock}</td>
              <td className="font-mono tabular-nums">{row.power}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section
        id="disk"
        title="Disk"
        intro="The factory Kingston SSD, on the ext4 system partition. SMART data showed no warnings, no media errors and 0% wear before and after."
      >
        <Table head={["Test", "Result"]}>
          {DISK_ROWS.map((row) => (
            <tr key={row.test}>
              <td>{row.test}</td>
              <td className="font-mono whitespace-nowrap tabular-nums">{row.result}</td>
            </tr>
          ))}
        </Table>
      </Section>

      <Section
        id="hardware"
        title="What works under Linux"
        intro="Kernel 6.18.63 with the stock NixOS 26.05 firmware package and no out-of-tree drivers."
      >
        <Table head={["Part", "Driver", "Status", "Note"]}>
          {HARDWARE_ROWS.map((row) => (
            <tr key={row.part}>
              <td className="font-medium whitespace-nowrap">{row.part}</td>
              <td className="font-mono text-[13px] text-fg-2">{row.driver}</td>
              <td>
                <span className={`inline-block rounded-md border px-2 py-0.5 text-xs whitespace-nowrap ${SUPPORT_STYLE[row.support]}`}>
                  {row.support}
                </span>
              </td>
              <td className="text-fg-2">{row.note}</td>
            </tr>
          ))}
        </Table>
        <p className="text-sm text-fg-3">
          {(Object.keys(SUPPORT_MEANING) as Support[]).map((key) => `${key}: ${SUPPORT_MEANING[key]}`).join(". ")}.
        </p>
      </Section>

      <Section
        id="run"
        title="Run the test yourself"
        intro="The test is one Python file driving stress-ng and fio. It works on any Linux machine and needs root, because it reads power counters, SMART data and the kernel log."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <CopyCommand label="With Nix, a five-minute smoke run" command={RUN_COMMANDS.nixQuick} />
          <CopyCommand label="With Nix, the full run (about 100 minutes)" command={RUN_COMMANDS.nixFull} />
        </div>
        <CopyCommand
          label="Without Nix: install stress-ng and fio, download loadtest.py, then"
          command={RUN_COMMANDS.plain}
        />
        <ul className="flex max-w-[68ch] flex-col gap-2 text-sm text-fg-2">
          <li>
            <span className="font-medium text-fg">The disk test writes real data:</span> about 125 GB in the full run,
            to a scratch file that is removed afterwards. Add <code className="font-mono text-fg">--skip-disk</code> to
            leave the disk alone.
          </li>
          <li>
            <span className="font-medium text-fg">The memory test fills 80% of RAM.</span> Do not run it next to
            anything you care about.
          </li>
        </ul>
        <Table head={["It writes", "Contents"]}>
          {OUTPUT_FILES.map((row) => (
            <tr key={row.file}>
              <td className="font-mono text-[13px] whitespace-nowrap">{row.file}</td>
              <td className="text-fg-2">{row.what}</td>
            </tr>
          ))}
        </Table>
        <p className="max-w-[68ch] text-sm text-fg-2">
          A real example of the output is in{" "}
          <RepoLink path="tree/main/results/2026-11-17-quick">results/2026-11-17-quick</RepoLink>. If you run it on an
          ER937-AI or another machine with this processor, a pull request adding your results is welcome.
        </p>
      </Section>

      <Section
        id="install"
        title="Install NixOS on this machine"
        intro="The repository holds the configuration these results were measured on, with keys and identifiers replaced by placeholders: keys-only SSH, both network ports on DHCP, a small ext4 root, a ZFS pool for data, and Incus."
      >
        <p className="max-w-[68ch] text-fg-2">
          <RepoLink path="blob/main/docs/install.md">The install guide</RepoLink> is nine steps and takes a few minutes
          on a fast connection. The configuration is in <RepoLink path="tree/main/nixos">nixos/</RepoLink>.
        </p>
      </Section>

      <Section id="firmware" title="Firmware notes">
        <dl className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          {FIRMWARE_NOTES.map((note) => (
            <div key={note.title} className="flex flex-col gap-1">
              <dt className="font-medium">{note.title}</dt>
              <dd className="text-sm text-fg-2">{note.text}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="limits" title="What these numbers do not tell you">
        <ul className="flex max-w-[68ch] list-disc flex-col gap-2 pl-5 text-sm text-fg-2 marker:text-fg-3">
          {LIMITS.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
      </Section>

      <footer className="border-t border-line pt-6 text-sm text-fg-3">
        Measured on one unit in November 2026. Code and data are MIT-licensed at{" "}
        <RepoLink path="">white07S/minix-er937-nixos</RepoLink>.
      </footer>
    </main>
  );
}
