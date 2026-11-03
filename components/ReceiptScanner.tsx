"use client";

import { useRef, useState } from "react";
import { parseReceipt, type ParsedItem } from "@/lib/receipt-parse";

// Receipt photo -> items, entirely in the browser via tesseract.js (no AI
// tokens, no server). tesseract.js is imported dynamically so its ~couple-MB
// core + language data load only when you actually scan (first scan fetches
// the English model from a CDN; it's cached after). The parse is heuristic,
// so the result is shown for review before anything is added.
export default function ReceiptScanner({
  onAdd,
}: {
  onAdd: (items: ParsedItem[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [candidates, setCandidates] = useState<ParsedItem[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  async function handleFile(file: File) {
    setScanning(true);
    setProgress(0);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });
      const {
        data: { text },
      } = await worker.recognize(file);
      await worker.terminate();
      const items = parseReceipt(text);
      setCandidates(items);
      setPicked(new Set(items.map((_, i) => i)));
    } catch (e) {
      console.error("Receipt OCR failed:", e);
      alert("Couldn't read that image. You can still add items by hand.");
    } finally {
      setScanning(false);
    }
  }

  function toggle(i: number) {
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  function edit(i: number, patch: Partial<ParsedItem>) {
    setCandidates((cs) => cs!.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  function addPicked() {
    const chosen = (candidates ?? []).filter((_, i) => picked.has(i));
    if (chosen.length) onAdd(chosen);
    setCandidates(null);
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={scanning}
        className="rounded border border-accent-dim px-2 py-1 font-mono text-xs text-foreground/70 hover:bg-accent-dim hover:text-accent-bright disabled:opacity-50"
      >
        {scanning ? `Scanning ${progress}%` : "Scan receipt"}
      </button>

      {candidates && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-16"
          onClick={() => setCandidates(null)}
        >
          <div
            className="mx-3 w-full max-w-sm rounded border border-accent-dim bg-black p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wide text-accent-bright">
              Found {candidates.length} item{candidates.length === 1 ? "" : "s"}
            </h2>
            {candidates.length === 0 ? (
              <p className="mb-3 text-sm text-foreground/60">
                Nothing clear enough to read. Add items by hand, or try a
                sharper, straight-on photo.
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-foreground/50">
                  Untick anything wrong; fix names/prices before adding.
                </p>
                <div className="mb-3 max-h-80 space-y-1 overflow-auto">
                  {candidates.map((c, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={picked.has(i)}
                        onChange={() => toggle(i)}
                      />
                      <input
                        className="min-w-0 flex-1 rounded border border-accent-dim bg-black px-1.5 py-0.5 text-foreground outline-none focus:border-accent"
                        value={c.name}
                        onChange={(e) => edit(i, { name: e.target.value })}
                      />
                      <input
                        inputMode="decimal"
                        className="w-16 rounded border border-accent-dim bg-black px-1.5 py-0.5 text-right text-foreground outline-none focus:border-accent"
                        value={c.cost}
                        onChange={(e) => edit(i, { cost: e.target.value })}
                      />
                    </label>
                  ))}
                </div>
              </>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCandidates(null)}
                className="rounded px-3 py-1.5 font-mono text-xs text-foreground/60 hover:text-foreground"
              >
                Cancel
              </button>
              {candidates.length > 0 && (
                <button
                  onClick={addPicked}
                  className="rounded bg-accent px-3 py-1.5 font-mono text-xs font-medium text-black hover:bg-accent-bright"
                >
                  Add {picked.size}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
