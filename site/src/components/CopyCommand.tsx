import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

/** A shell command with a copy button. If the clipboard is refused, the text is selected instead. */
export function CopyCommand({ command, label }: { command: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const code = useRef<HTMLElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      const selection = window.getSelection();
      if (selection && code.current) {
        selection.removeAllRanges();
        const range = document.createRange();
        range.selectNodeContents(code.current);
        selection.addRange(range);
      }
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-sm text-fg-2">{label}</span>
      <div className="flex min-w-0 items-stretch overflow-hidden rounded-lg border border-line bg-surface">
        <pre className="min-w-0 flex-1 overflow-x-auto px-4 py-3 font-mono text-[13px] leading-6 text-fg">
          <code ref={code}>{command}</code>
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? "Copied" : `Copy the command: ${label}`}
          className="flex w-12 shrink-0 cursor-pointer items-center justify-center border-l border-line text-fg-2 transition-[transform,color,background-color] duration-150 ease-out hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-series active:scale-[0.97]"
        >
          {copied ? <Check size={16} strokeWidth={2} className="text-good" /> : <Copy size={16} strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}
