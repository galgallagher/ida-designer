"use client";

/**
 * exportPdf — render a list of tldraw frames into a single multi-page PDF.
 *
 * Each frame becomes one PDF page at its true print dimensions (calculated
 * from the frame's pixel size assuming 96 DPI). We rasterize each frame to
 * a PNG via tldraw's editor.toImage() at 2× pixelRatio for sharp prints,
 * then embed it in the PDF with pdf-lib.
 *
 * No server round-trip — everything happens client-side in the browser.
 */

import { PDFDocument } from "pdf-lib";
import type { Editor, TLShape } from "tldraw";

// PDF uses PostScript points (72 pt = 1 inch). tldraw shapes are in CSS
// pixels at 96 px = 1 inch. So 1 CSS pixel = 72/96 = 0.75 PDF points.
const PX_TO_PT = 72 / 96;

export interface ExportProgressCallback {
  (current: number, total: number): void;
}

/**
 * Rasterize each frame, embed in PDF, return the resulting PDF Blob.
 * Caller is responsible for downloading or otherwise using the Blob.
 */
export async function exportFramesToPdf(
  editor: Editor,
  frames: TLShape[],
  opts: { onProgress?: ExportProgressCallback } = {},
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    opts.onProgress?.(i + 1, frames.length);

    // Guard: a malformed frame without w/h gets skipped rather than crashing.
    const props = frame.props as { w?: number; h?: number };
    const widthPx = props.w ?? 0;
    const heightPx = props.h ?? 0;
    if (!widthPx || !heightPx) continue;

    // Rasterize the frame + its children to PNG.
    // - padding: 0 → no extra margin around the frame bounds
    // - background: true → white sheet (matches print)
    // - pixelRatio default (2) → crisp at 100% zoom on print
    const { blob } = await editor.toImage([frame.id], {
      format: "png",
      background: true,
      padding: 0,
    });

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const png = await pdfDoc.embedPng(bytes);

    // PDF page sized to the frame's true print dimensions.
    const pageWidth = widthPx * PX_TO_PT;
    const pageHeight = heightPx * PX_TO_PT;
    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // Fill the page with the PNG. (PDF's origin is bottom-left; pdf-lib
    // handles that internally, so x:0,y:0 with full size fills correctly.)
    page.drawImage(png, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }

  const pdfBytes = await pdfDoc.save();
  // Copy into a fresh Uint8Array so the Blob doesn't retain a reference to
  // pdf-lib's internal buffer.
  return new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
}

/**
 * Trigger a browser download of a Blob. Standard anchor-click pattern.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a short delay so the browser has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
