"use client";

import { useState } from "react";
import Image from "next/image";
import { ImageIcon, Trash2 } from "lucide-react";
import type { ProjectImageRow, ProjectImageType } from "@/types/database";
import { tagProjectImage, deleteProjectImage } from "../canvas/actions";

interface Props {
  projectId: string;
  images: ProjectImageRow[];
}

const TABS: { key: ProjectImageType; label: string }[] = [
  { key: "inspiration", label: "Inspiration" },
  { key: "sketch",      label: "Sketches" },
];

export default function ProjectImagesClient({ images: initialImages }: Props) {
  const [images, setImages] = useState(initialImages);
  const [activeTab, setActiveTab] = useState<ProjectImageType>("inspiration");

  const visible = images.filter((img) => img.type === activeTab);

  async function handleRetag(imageId: string, newType: ProjectImageType) {
    const { error } = await tagProjectImage(imageId, newType);
    if (!error) {
      setImages((prev) =>
        prev.map((img) => (img.id === imageId ? { ...img, type: newType } : img)),
      );
    }
  }

  async function handleDelete(imageId: string) {
    // Optimistic remove
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    const { error } = await deleteProjectImage(imageId);
    if (error) {
      // Restore on failure
      setImages(initialImages);
    }
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ fontFamily: "var(--font-inter), sans-serif", backgroundColor: "#EDEDED" }}
    >
      {/* Header */}
      <div
        className="flex items-center px-8 flex-shrink-0"
        style={{ height: 64, backgroundColor: "#FFFFFF", borderBottom: "1px solid #E4E1DC" }}
      >
        <h1
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: 22,
            fontWeight: 700,
            color: "#1A1A1A",
          }}
        >
          Project Images
        </h1>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center gap-1 px-8 flex-shrink-0"
        style={{ height: 48, backgroundColor: "#FFFFFF", borderBottom: "1px solid #E4E1DC" }}
      >
        {TABS.map((tab) => {
          const count = images.filter((i) => i.type === tab.key).length;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-md transition-colors"
              style={{
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#1A1A1A" : "#9A9590",
                backgroundColor: isActive ? "#F5F4F2" : "transparent",
              }}
            >
              {tab.label}
              <span
                className="rounded-full flex items-center justify-center"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  width: 18,
                  height: 18,
                  backgroundColor: isActive ? "#1A1A1A" : "#E4E1DC",
                  color: isActive ? "#FFFFFF" : "#9A9590",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <ImageIcon size={32} style={{ color: "#C0BEBB" }} />
            <p style={{ fontSize: 14, color: "#9A9590" }}>
              {activeTab === "inspiration"
                ? "No inspiration images yet. Paste or drop images on the canvas and tag them."
                : "No sketches yet. Paste or drop images on the canvas and tag them as Sketch."}
            </p>
          </div>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
          >
            {visible.map((img) => (
              <ImageCard
                key={img.id}
                image={img}
                onRetag={handleRetag}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Image card ────────────────────────────────────────────────────────────────

function ImageCard({
  image,
  onRetag,
  onDelete,
}: {
  image: ProjectImageRow;
  onRetag: (id: string, type: ProjectImageType) => void;
  onDelete: (id: string) => void;
}) {
  const otherType: ProjectImageType = image.type === "inspiration" ? "sketch" : "inspiration";
  const otherLabel = image.type === "inspiration" ? "Move to Sketches" : "Move to Inspiration";

  return (
    <div
      className="group relative overflow-hidden rounded-xl"
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid #E4E1DC",
        boxShadow: "0 2px 12px rgba(26,26,26,0.06)",
      }}
    >
      <div className="relative w-full" style={{ aspectRatio: "4/3" }}>
        <Image
          src={image.url}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Hover overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "linear-gradient(to top, rgba(26,26,26,0.55) 0%, transparent 55%)" }}
      >
        {/* Delete button — top-right */}
        <button
          onClick={() => onDelete(image.id)}
          className="absolute top-2 right-2 flex items-center justify-center rounded-lg transition-colors hover:bg-red-600"
          style={{
            width: 28,
            height: 28,
            backgroundColor: "rgba(26,26,26,0.65)",
            border: "none",
            cursor: "pointer",
            color: "#FFFFFF",
          }}
          title="Delete image"
        >
          <Trash2 size={13} />
        </button>

        {/* Retag button — bottom centre */}
        <button
          onClick={() => onRetag(image.id, otherType)}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          style={{
            fontSize: 11,
            fontWeight: 600,
            backgroundColor: "rgba(255,255,255,0.92)",
            color: "#1A1A1A",
            border: "none",
            cursor: "pointer",
          }}
        >
          {otherLabel}
        </button>
      </div>

      {/* Date footer */}
      <div className="px-3 py-2" style={{ borderTop: "1px solid #F0EDEA" }}>
        <p style={{ fontSize: 11, color: "#9A9590" }}>
          {new Date(image.created_at).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </div>
    </div>
  );
}
