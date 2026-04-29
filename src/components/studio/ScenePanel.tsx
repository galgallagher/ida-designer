"use client";

import { RotateCcw } from "lucide-react";
import {
  DEFAULT_SCENE,
  type SceneSettings,
  type ToneMappingOption,
  type SceneBackground,
} from "./StudioCanvas";

interface ScenePanelProps {
  scene: SceneSettings;
  onChange: (next: Partial<SceneSettings>) => void;
}

export default function ScenePanel({ scene, onChange }: ScenePanelProps) {
  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #E4E1DC" }}>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Scene Settings
        </p>
        <button
          onClick={() => onChange(DEFAULT_SCENE)}
          className="flex items-center gap-1 transition-opacity hover:opacity-60"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#9A9590", fontFamily: "var(--font-inter), sans-serif", fontSize: 10 }}
          title="Reset all scene settings"
        >
          <RotateCcw size={10} />
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Tone Mapping */}
        <Field label="Tone Mapping">
          <select
            value={scene.toneMapping}
            onChange={(e) => onChange({ toneMapping: e.target.value as ToneMappingOption })}
            style={selectStyle}
          >
            <option value="agx">AgX (default)</option>
            <option value="aces">ACES Filmic</option>
            <option value="neutral">Neutral</option>
          </select>
        </Field>

        {/* Background */}
        <Field label="Background">
          <div className="flex gap-1">
            {(["white", "grey", "dark"] as SceneBackground[]).map((bg) => {
              const active = scene.background === bg;
              const swatch = bg === "white" ? "#FFFFFF" : bg === "grey" ? "#E8E6E3" : "#1A1A1A";
              return (
                <button
                  key={bg}
                  onClick={() => onChange({ background: bg })}
                  className="flex-1 transition-all"
                  style={{
                    height: 28,
                    borderRadius: 7,
                    border: active ? "2px solid #FFDE28" : "1px solid #E4E1DC",
                    backgroundColor: swatch,
                    cursor: "pointer",
                    fontFamily: "var(--font-inter), sans-serif",
                    fontSize: 11,
                    color: bg === "dark" ? "#fff" : "#1A1A1A",
                    fontWeight: active ? 600 : 400,
                    textTransform: "capitalize",
                  }}
                >
                  {bg}
                </button>
              );
            })}
          </div>
        </Field>

        {/* Exposure */}
        <Slider
          label="Exposure"
          value={scene.exposure}
          min={0.25} max={4} step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => onChange({ exposure: v })}
        />

        {/* Environment intensity */}
        <Slider
          label="Environment"
          value={scene.envIntensity}
          min={0} max={3} step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(v) => onChange({ envIntensity: v })}
        />

        {/* Key light */}
        <Slider
          label="Key Light"
          value={scene.keyLight}
          min={0} max={1.5} step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(v) => onChange({ keyLight: v })}
        />

        {/* Shadow */}
        <Slider
          label="Shadow Strength"
          value={scene.shadowStrength}
          min={0} max={1} step={0.05}
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => onChange({ shadowStrength: v })}
        />

        {/* Grid toggle */}
        <label
          className="flex items-center gap-2 cursor-pointer select-none"
          style={{
            padding: "8px 10px",
            borderRadius: 7,
            backgroundColor: scene.showGrid ? "#FFFBEB" : "#F5F3F0",
            border: scene.showGrid ? "1px solid #FFE873" : "1px solid #E4E1DC",
          }}
        >
          <input
            type="checkbox"
            checked={scene.showGrid}
            onChange={(e) => onChange({ showGrid: e.target.checked })}
            style={{ width: 13, height: 13, cursor: "pointer", accentColor: "#1A1A1A" }}
          />
          <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#1A1A1A", fontWeight: 500 }}>
            Show grid
          </span>
        </label>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 12,
  fontFamily: "var(--font-inter), sans-serif",
  borderRadius: 7,
  border: "1px solid #E4E1DC",
  padding: "5px 8px",
  backgroundColor: "#fff",
  color: "#1A1A1A",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 10, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Slider({
  label, value, min, max, step, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
          {label}
        </span>
        <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#1A1A1A", fontWeight: 600 }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%" }}
      />
    </div>
  );
}
