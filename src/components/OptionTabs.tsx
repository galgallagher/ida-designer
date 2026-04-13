"use client";

/**
 * OptionTabs — shared pill tab bar for Project Options (A, B, C…).
 *
 * Used by ProjectSpecsClient and ProjectDrawingsClient. Pure client
 * component — no data fetching, renders from props only.
 *
 * Usage:
 *   <OptionTabs
 *     options={options}
 *     activeId={activeOptionId}
 *     onSelect={setActiveOptionId}
 *     onAddOption={() => setAddOptionOpen(true)}
 *   />
 */

import { Plus } from "lucide-react";

export interface OptionTabsProps {
  options: { id: string; label: string; name: string }[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAddOption: () => void;
  disabled?: boolean;
}

export default function OptionTabs({
  options,
  activeId,
  onSelect,
  onAddOption,
  disabled = false,
}: OptionTabsProps) {
  return (
    <div className="flex items-center gap-2">
      {options.map((option) => {
        const isActive = option.id === activeId;
        const showName = option.name !== `Option ${option.label}`;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            disabled={disabled}
            style={{
              height: 34,
              paddingLeft: 14,
              paddingRight: 14,
              borderRadius: 8,
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "#1A1A1A" : "#9A9590",
              backgroundColor: isActive ? "#FFFFFF" : "transparent",
              boxShadow: isActive ? "0 1px 6px rgba(26,26,26,0.08)" : "none",
              border: "none",
              cursor: disabled ? "default" : "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            Option {option.label}
            {showName && (
              <span style={{ marginLeft: 4, fontSize: 12, color: "#9A9590", fontWeight: 400 }}>
                · {option.name}
              </span>
            )}
          </button>
        );
      })}

      {/* Add option ghost button */}
      <button
        type="button"
        onClick={onAddOption}
        disabled={disabled}
        className="flex items-center gap-1 transition-opacity hover:opacity-70"
        style={{
          height: 34,
          paddingLeft: 10,
          paddingRight: 10,
          borderRadius: 8,
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 13,
          color: "#9A9590",
          backgroundColor: "transparent",
          border: "1.5px dashed #D6D2CC",
          cursor: disabled ? "default" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <Plus size={12} />
        Add option
      </button>
    </div>
  );
}
