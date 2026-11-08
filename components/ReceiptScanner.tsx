"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseReceipt, type ParsedItem } from "@/lib/receipt-parse";
import Modal from "@/components/Modal";

// Lightly clean an image for OCR: upscale small photos, greyscale, and bump
// contrast. This is the main lever on tesseract's accuracy for receipts
// (printed receipts especially). Falls back to the raw file if anything fails.
async function preprocess(file: Blob): Promise<HTMLCanvasElement | Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const maxDim = Math.max(bmp.width, bmp.height);
    const scale = maxDim < 1200 ? 2 : maxDim > 2400 ? 2400 / maxDim : 1;
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bmp, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      g = (g - 128) * 1.25 + 128; // contrast
      d[i] = d[i + 1] = d[i + 2] = g < 0 ? 0 : g > 255 ? 255 : g;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  } catch {
    return file;
  }
}

// One row of the Upload-receipt popover.
function ReceiptMenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="px-3 py-2 text-left font-mono text-xs text-foreground/80 hover:bg-accent-dim hover:text-accent-bright"
    >
      {children}
    </button>
  );
}

// Receipt photo -> items, entirely in the browser via tesseract.js (no AI
// tokens, no server). tesseract.js is imported dynamically so its ~couple-MB
// core + language data load only when you actually scan (first scan fetches
// the English model from a CDN; it's cached after). The parse is heuristic,
// so the result is shown for review before anything is added.
export default function ReceiptScanner({
  onAdd,
  defaultTax,
}: {
  onAdd: (items: ParsedItem[], taxPercent: string) => void;
  defaultTax: string;
}) {
  // Two hidden <input type="file">: one with `capture` (jumps straight to the
  // rear camera on a phone), one without (the OS photo/file picker). The menu
  // items click whichever one fits.
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [candidates, setCandidates] = useState<ParsedItem[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [batchTax, setBatchTax] = useState(defaultTax);
  // The "Upload receipt" popover (the small menu of sources).
  const [menuOpen, setMenuOpen] = useState(false);
  // Which sources to offer. Phones/tablets add camera + gallery; desktop just
  // gets file + paste. Detected after mount (navigator isn't available during
  // SSR, so a render-time read would mismatch hydration). iPadOS 13+ reports a
  // Mac user-agent, so the touch-point check catches iPads too.
  const [isTouch, setIsTouch] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect -- navigator isn't available
     during SSR, so this reads the device class once after mount (a render-time
     read would differ between server and client and cause a hydration error). */
  useEffect(() => {
    const ua = navigator.userAgent;
    setIsTouch(
      /iPhone|iPad|iPod|Android/i.test(ua) ||
        (/Mac/.test(ua) && navigator.maxTouchPoints > 1)
    );
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleFile = useCallback(
    async (file: Blob) => {
      setScanning(true);
      setProgress(0);
      try {
        const input = await preprocess(file);
        const { createWorker, PSM } = await import("tesseract.js");
        const worker = await createWorker("eng", 1, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === "recognizing text") {
              setProgress(Math.round(m.progress * 100));
            }
          },
        });
        // Single column of text of varying sizes - fits receipts.
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN });
        const {
          data: { text },
        } = await worker.recognize(input);
        await worker.terminate();
        const items = parseReceipt(text);
        setCandidates(items);
        setPicked(new Set(items.map((_, i) => i)));
        setBatchTax(defaultTax);
      } catch (e) {
        console.error("Receipt OCR failed:", e);
        alert("Couldn't read that image. You can still add items by hand.");
      } finally {
        setScanning(false);
      }
    },
    [defaultTax]
  );

  // Paste an image from the clipboard via the OS paste event (Cmd/Ctrl+V on
  // desktop; a hardware/soft keyboard paste on mobile). The "Paste" menu item
  // uses the async Clipboard API below instead. Screenshot a receipt, paste.
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

  // The "Paste" menu item: read the latest clipboard entry directly (works on
  // desktop and modern mobile Safari/Chrome) and use its image if it has one.
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
    if (chosen.length) onAdd(chosen, batchTax);
    setCandidates(null);
  }

  return (
    <>
      {/* Plain picker: OS photo library / Files app (no `capture`, so a phone
          shows both gallery and camera in its native sheet). */}
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
      {/* Camera picker: `capture="environment"` opens the rear camera directly
          on a phone/tablet (ignored on desktop, which has no camera intent). */}
      <input
        ref={cameraRef}
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
      {scanning ? (
        <button
          disabled
          className="rounded border border-accent-dim px-2 py-1 font-mono text-xs text-foreground/50 opacity-60"
        >
          Scanning {progress}%
        </button>
      ) : (
        // One button, one label everywhere; the sources differ by device. This
        // is a "popover menu": the button toggles a small floating list, and a
        // full-screen transparent backdrop behind it closes it on an outside
        // tap. Same control in portrait, landscape, and on desktop.
        <div className="relative inline-block">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="rounded border border-accent-dim px-2 py-1 font-mono text-xs text-foreground/70 hover:bg-accent-dim hover:text-accent-bright"
          >
            Upload receipt ▾
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
              <div
                role="menu"
                className="absolute left-0 top-full z-20 mt-1 flex w-40 flex-col overflow-hidden rounded border border-accent-dim bg-black shadow-lg"
              >
                {isTouch && (
                  <ReceiptMenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      cameraRef.current?.click();
                    }}
                  >
                    Take photo
                  </ReceiptMenuItem>
                )}
                {isTouch && (
                  <ReceiptMenuItem
                    onClick={() => {
                      setMenuOpen(false);
                      fileRef.current?.click();
                    }}
                  >
                    Upload photo
                  </ReceiptMenuItem>
                )}
                <ReceiptMenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    fileRef.current?.click();
                  }}
                >
                  Choose file
                </ReceiptMenuItem>
                <ReceiptMenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    pasteFromClipboard();
                  }}
                >
                  Paste
                </ReceiptMenuItem>
              </div>
            </>
          )}
        </div>
      )}

      {candidates && (
        <Modal onClose={() => setCandidates(null)}>
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
                <label className="mb-2 flex items-center gap-2 text-xs text-foreground/70">
                  Tax&nbsp;% for this receipt
                  <input
                    inputMode="decimal"
                    value={batchTax}
                    onChange={(e) => setBatchTax(e.target.value)}
                    placeholder="0"
                    className="w-14 rounded border border-accent-dim bg-black px-1.5 py-0.5 text-right text-foreground outline-none focus:border-accent"
                  />
                  <span className="text-foreground/40">applies to all</span>
                </label>
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
        </Modal>
      )}
    </>
  );
}
