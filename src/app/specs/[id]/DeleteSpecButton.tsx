"use client";

/**
 * DeleteSpecButton
 *
 * Client-side delete button for the spec detail page.
 * First click shows an inline confirm; second click calls the server action.
 * If the spec is in use by projects, shows the blocking error instead.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteSpec } from "../actions";

export default function DeleteSpecButton({ specId }: { specId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteSpec(specId);
    setDeleting(false);
    if (result.error) {
      setError(result.error);
      setConfirm(false);
    } else {
      router.push("/specs");
    }
  }

  if (error) {
    return (
      <p
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 12,
          color: "#EF4444",
          maxWidth: 320,
        }}
      >
        {error}
      </p>
    );
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-2">
        <span
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            fontSize: 12,
            color: "#9A9590",
          }}
        >
          Delete this spec?
        </span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          style={{
            height: 28,
            paddingLeft: 12,
            paddingRight: 12,
            backgroundColor: "#EF4444",
            border: "none",
            borderRadius: 7,
            fontFamily: "var(--font-inter), sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: "#FFFFFF",
            cursor: deleting ? "default" : "pointer",
          }}
        >
          {deleting ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirm(false)}
          style={{
            height: 28,
            paddingLeft: 12,
            paddingRight: 12,
            backgroundColor: "#F0EEEB",
            border: "none",
            borderRadius: 7,
            fontFamily: "var(--font-inter), sans-serif",
            fontSize: 12,
            color: "#9A9590",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      title="Delete spec"
      className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
      style={{
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: 12,
        color: "#C0BEBB",
        background: "none",
        border: "none",
        cursor: "pointer",
        textDecoration: "none",
      }}
    >
      <Trash2 size={12} /> Delete
    </button>
  );
}
