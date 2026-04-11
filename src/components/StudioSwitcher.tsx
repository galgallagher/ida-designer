"use client";

/**
 * StudioSwitcher — Client Component
 *
 * Shows the current studio name in the sidebar.
 * If the user belongs to multiple studios, adds a chevron that opens
 * a shadcn DropdownMenu to switch studios.
 */

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { switchStudio } from "@/app/actions/switchStudio";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [switching, setSwitching] = useState(false);
  const hasMultiple = allStudios.length > 1;

  async function handleSwitch(studioId: string) {
    if (studioId === currentStudio.id) return;
    setSwitching(true);
    await switchStudio(studioId);
    // redirect() in the server action navigates away — no need to reset state
  }

  const label = (
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
  );

  if (!hasMultiple) {
    return (
      <div style={{ padding: "4px 8px 16px 8px" }}>
        {label}
      </div>
    );
  }

  return (
    <div style={{ padding: "4px 8px 16px 8px" }}>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={switching}
          className="flex items-center gap-1 outline-none"
          style={{ cursor: switching ? "wait" : "pointer" }}
        >
          {label}
          <ChevronDown
            size={12}
            style={{ color: "#9A9590", flexShrink: 0 }}
            className="transition-transform duration-150 data-[state=open]:rotate-180"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={8}
          style={{
            fontFamily: "var(--font-inter), sans-serif",
            fontSize: 12,
            minWidth: 160,
          }}
        >
          {allStudios.map((studio) => {
            const isCurrent = studio.id === currentStudio.id;
            return (
              <DropdownMenuItem
                key={studio.id}
                disabled={switching}
                onSelect={() => handleSwitch(studio.id)}
                className="flex items-center justify-between gap-3 cursor-pointer"
                style={{ fontWeight: isCurrent ? 600 : 400 }}
              >
                {studio.name}
                {isCurrent && <Check size={12} style={{ color: "#9A9590", flexShrink: 0 }} />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
