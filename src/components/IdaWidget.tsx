"use client";

/**
 * IdaWidget — persistent AI assistant chat bubble.
 *
 * The bubble itself is a tiny always-on button. The chat panel
 * (with its Vercel AI SDK / SpecDetailModal / message renderers — the heavy
 * stuff) is a separate component, dynamically imported on first open so it
 * stays out of the initial JS bundle for users who never click it.
 *
 * Once mounted, the panel stays mounted for the rest of the page lifetime
 * so chat state, streaming responses, and message history are preserved
 * when the user closes and reopens the widget.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";

const IdaPanel = dynamic(() => import("./IdaPanel"), { ssr: false });

export default function IdaWidget({
  projectId,
  projectName,
}: {
  projectId?: string;
  projectName?: string;
} = {}) {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  function handleToggle() {
    setHasOpened(true);
    setOpen((v) => !v);
  }

  return (
    <>
      {hasOpened && (
        <IdaPanel
          open={open}
          onClose={() => setOpen(false)}
          projectId={projectId}
          projectName={projectName}
        />
      )}

      {/* Bubble button — always rendered, zero panel JS until first click */}
      <button
        type="button"
        onClick={handleToggle}
        title={open ? "Close Ida" : "Open Ida — Design Assistant"}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          width: 52,
          height: 52,
          backgroundColor: "#1A1A1A",
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 16px rgba(26,26,26,0.24)",
          zIndex: 101,
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        className="hover:scale-105 hover:shadow-xl"
      >
        {open ? (
          <X size={18} style={{ color: "#FFDE28" }} />
        ) : (
          <span
            style={{
              fontFamily: "var(--font-playfair), serif",
              fontSize: 22,
              fontWeight: 600,
              color: "#FFDE28",
              lineHeight: 1,
              userSelect: "none",
            }}
          >
            i
          </span>
        )}
      </button>
    </>
  );
}
