"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  const handleFile = useCallback(async (file: Blob) => {
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
  }, []);

  // Desktop: paste an image from the clipboard (Cmd/Ctrl+V anywhere, or the
  // Paste button). Screenshot a receipt and paste it - no file dialog.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
            return;
          }
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFile]);

  async function pasteFromClipboard() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          handleFile(await item.getType(imageType));
          return;
        }
      }
      alert("No image in the clipboard — copy a receipt image first, then Paste.");
    } catch {
      alert(
        "Couldn't read the clipboard. Copy an image, then press Cmd/Ctrl+V, or allow clipboard access."
      );
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
      {/* No capture attr -> mobile offers Photo Library *and* Camera. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {scanning ? (
        <button
          disabled
          className="rounded border border-accent-dim px-2 py-1 font-mono text-xs text-foreground/50 opacity-60"
        >
          Scanning {progress}%
        </button>
      ) : (
        <>
          {/* Mobile: gallery or camera via the file picker */}
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded border border-accent-dim px-2 py-1 font-mono text-xs text-foreground/70 hover:bg-accent-dim hover:text-accent-bright sm:hidden"
          >
            Scan receipt
          </button>
          {/* Desktop: paste a copied image (or Cmd/Ctrl+V anywhere) */}
          <button
            onClick={pasteFromClipboard}
            title="Paste a copied receipt image (or press Cmd/Ctrl+V)"
            className="hidden rounded border border-accent-dim px-2 py-1 font-mono text-xs text-foreground/70 hover:bg-accent-dim hover:text-accent-bright sm:inline-flex"
          >
            Paste receipt
          </button>
        </>
      )}

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
