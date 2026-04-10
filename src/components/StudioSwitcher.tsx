"use client";

/**
 * StudioSwitcher — Client Component
 *
 * Shows the current studio name in the sidebar.
 * If the user belongs to multiple studios, adds a chevron that opens
 * a dropdown to switch studios.
 *
 * Clicking a studio calls the switchStudio server action which sets
 * the current_studio_id cookie and redirects to /clients.
 */

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { switchStudio } from "@/app/actions/switchStudio";

interface Studio {
  id: string;
  name: string;
  slug: string;
}

interface StudioSwitcherProps {
  currentStudio: { id: string; name: string };
  allStudios: Studio[];
}

export default function StudioSwitcher({
  currentStudio,
  allStudios,
}: StudioSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasMultiple = allStudios.length > 1;

  async function handleSwitch(studioId: string) {
    if (studioId === currentStudio.id) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    await switchStudio(studioId);
    // redirect() in the server action will navigate away — no need to reset state
  }

  return (
    <div
      ref={containerRef}
      style={{ padding: "4px 8px 16px 8px", position: "relative" }}
    >
      <div
        className="flex items-center gap-1"
        style={{ cursor: hasMultiple ? "pointer" : "default" }}
        onClick={() => hasMultiple && setOpen((prev) => !prev)}
      >
        {/* Studio name */}
        <span
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            fontWeight: 700,
            fontSize: 10,
            color: "#1A1A1A",
            letterSpacing: "1.3px",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          {currentStudio.name}
        </span>

        {/* Chevron — only if multiple studios */}
        {hasMultiple && (
          <ChevronDown
            size={12}
            style={{
              color: "#9A9590",
              flexShrink: 0,
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
            }}
          />
        )}
      </div>

      {/* Dropdown */}
      {open && hasMultiple && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% - 8px)",
            left: 8,
            right: 0,
            backgroundColor: "#FFFFFF",
            borderRadius: 10,
            boxShadow: "0 4px 16px rgba(26,26,26,0.12)",
            zIndex: 50,
            overflow: "hidden",
            minWidth: 160,
          }}
        >
          {allStudios.map((studio) => {
            const isCurrent = studio.id === currentStudio.id;
            return (
              <button
                key={studio.id}
                disabled={switching}
                onClick={() => handleSwitch(studio.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  fontFamily: "var(--font-inter), sans-serif",
                  fontSize: 12,
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? "#1A1A1A" : "#9A9590",
                  backgroundColor: isCurrent ? "#F7F6F4" : "transparent",
                  border: "none",
                  cursor: switching ? "wait" : "pointer",
                  letterSpacing: 0,
                  textTransform: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "#F7F6F4";
                    (e.currentTarget as HTMLButtonElement).style.color = "#1A1A1A";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "#9A9590";
                  }
                }}
              >
                {studio.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
