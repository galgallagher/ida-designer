"use client";

import { useState, useCallback, useRef, useEffect, useTransition } from "react";
import dynamic from "next/dynamic";
import { Loader2, ArrowLeft, Check, AlertCircle } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import type { StudioModelFormat, StudioModelRow } from "@/types/database";
import type { MeshInfo } from "@/components/studio/StudioCanvas";
import type { SpecLite } from "./actions";
import {
  getUploadUrl,
  createStudioModel,
  saveMaterialAssignments,
  saveMeshLabels,
  deleteStudioModel,
  getModelDownloadUrl,
  getProjectSpecsForPicker,
  renameStudioModel,
} from "./actions";
import MeshListPanel from "@/components/studio/MeshListPanel";
import MaterialPanel from "@/components/studio/MaterialPanel";
import ScenePanel from "@/components/studio/ScenePanel";
import ModelGrid from "@/components/studio/ModelGrid";
import type { SaveStatus } from "@/components/studio/ModelCardStrip";
import {
  readAssignment,
  DEFAULT_SCENE,
  type MaterialAssignments,
  type MeshAssignment,
  type SceneSettings,
} from "@/components/studio/StudioCanvas";

// Dynamic import — WebGPU cannot run server-side
const StudioCanvas = dynamic(() => import("@/components/studio/StudioCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: "#1A1A1A" }}>
      <Loader2 size={24} className="animate-spin" color="#9A9590" />
    </div>
  ),
});

interface StudioPageClientProps {
  projectId: string;
  studioId: string;
  projectName: string;
  initialModels: StudioModelRow[];
}

export default function StudioPageClient({
  projectId,
  studioId,
  projectName,
  initialModels,
}: StudioPageClientProps) {
  const [models, setModels] = useState<StudioModelRow[]>(initialModels);
  const [activeModel, setActiveModel] = useState<StudioModelRow | null>(null);
  const [view, setView] = useState<"grid" | "editor">("grid");
  const [meshUrl, setMeshUrl] = useState<string | null>(null);
  const [meshes, setMeshes] = useState<MeshInfo[]>([]);
  const [selectedMeshIds, setSelectedMeshIds] = useState<string[]>([]);
  const [linkSameMaterial, setLinkSameMaterial] = useState<boolean>(true);

  // Scene settings (persisted to localStorage so user preferences survive)
  const [scene, setScene] = useState<SceneSettings>(DEFAULT_SCENE);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("studio:scene");
      if (raw) setScene({ ...DEFAULT_SCENE, ...JSON.parse(raw) });
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    localStorage.setItem("studio:scene", JSON.stringify(scene));
  }, [scene]);
  const handleSceneChange = useCallback((next: Partial<SceneSettings>) => {
    setScene((prev) => ({ ...prev, ...next }));
  }, []);

  // Right-panel tab
  const [rightTab, setRightTab] = useState<"material" | "scene">("material");
  const [materialAssignments, setMaterialAssignments] = useState<MaterialAssignments>({});
  const [meshLabels, setMeshLabels] = useState<Record<string, string>>({});
  const [specs, setSpecs] = useState<SpecLite[]>([]);
  const [specImages, setSpecImages] = useState<Record<string, string | null>>({});

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const dirtyRef = useRef(false);
  const [, startTransition] = useTransition();

  const canvasRef = useRef<{ capture: () => string }>(
    null as unknown as { capture: () => string },
  );

  // Load specs on mount
  useEffect(() => {
    getProjectSpecsForPicker(projectId).then(setSpecs);
  }, [projectId]);

  // Build specImages map whenever specs change
  useEffect(() => {
    setSpecImages(Object.fromEntries(specs.map((s) => [s.id, s.image_url])));
  }, [specs]);

  // When active model changes, load signed URL and restore assignments
  useEffect(() => {
    if (!activeModel) { setMeshUrl(null); return; }
    setMeshes([]);
    setSelectedMeshIds([]);
    setMaterialAssignments((activeModel.material_assignments as MaterialAssignments) ?? {});
    setMeshLabels((activeModel.mesh_labels as Record<string, string>) ?? {});
    getModelDownloadUrl(activeModel.id).then(setMeshUrl);
  }, [activeModel]);

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(
    async (file: File) => {
      const rawExt = file.name.split(".").pop()?.toLowerCase() ?? "glb";
      if (!["glb", "gltf", "fbx", "obj"].includes(rawExt)) {
        alert("Please upload a GLB, GLTF, FBX, or OBJ file.");
        return;
      }

      setUploading(true);
      setUploadProgress(0);

      try {
        const modelId = uuidv4();
        const ext = rawExt as StudioModelFormat;
        const { uploadUrl, filePath } = await getUploadUrl(projectId, file.name, modelId);

        // Upload via XHR so we get progress events
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => (xhr.status < 400 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", "application/octet-stream");
          xhr.send(file);
        });

        const model = await createStudioModel(
          projectId,
          modelId,
          file.name.replace(/\.[^.]+$/, ""),
          filePath,
          ext,
        );

        setModels((prev) => [model, ...prev]);
        // Stay on grid — the new card appears at the top, user clicks to open
      } catch (err) {
        console.error(err);
        alert("Upload failed. Please try again.");
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [projectId],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect],
  );

  // ── Selection ───────────────────────────────────────────────────────────────

  const handleMeshClick = useCallback((id: string | null, additive: boolean) => {
    if (id === null) {
      setSelectedMeshIds([]);
      return;
    }
    setSelectedMeshIds((prev) => {
      if (additive) {
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      }
      return [id];
    });
  }, []);

  // Resolve a list of selectedMeshIds → mesh keys (name || uuid) for assignment storage.
  const selectedMeshKeys = useCallback(() => {
    return selectedMeshIds
      .map((id) => meshes.find((m) => m.id === id))
      .filter((m): m is MeshInfo => Boolean(m))
      .map((m) => m.name || m.id);
  }, [selectedMeshIds, meshes]);

  // ── Material assignment ─────────────────────────────────────────────────────

  const handleAssign = useCallback((specId: string) => {
    const keys = selectedMeshKeys();
    if (keys.length === 0) return;
    setMaterialAssignments((prev) => {
      const updates: Record<string, MeshAssignment> = {};
      for (const key of keys) {
        const current = readAssignment(prev[key]);
        updates[key] = {
          specId,
          scaleX:     current?.scaleX     ?? 1,
          scaleY:     current?.scaleY     ?? 1,
          rotation:   current?.rotation   ?? 0,
          roughness:  current?.roughness  ?? 0.55,
          metalness:  current?.metalness  ?? 0,
          brightness: current?.brightness ?? 1,
        };
      }
      return { ...prev, ...updates };
    });
    dirtyRef.current = true;
  }, [selectedMeshKeys]);

  const handleUnassign = useCallback(() => {
    const keys = selectedMeshKeys();
    if (keys.length === 0) return;
    setMaterialAssignments((prev) => {
      const next = { ...prev };
      for (const key of keys) delete next[key];
      return next;
    });
    dirtyRef.current = true;
  }, [selectedMeshKeys]);

  const handleUpdateTransform = useCallback(
    (
      meshKey: string,
      transform: {
        scaleX?: number;
        scaleY?: number;
        rotation?: number;
        roughness?: number;
        metalness?: number;
        brightness?: number;
      },
    ) => {
      setMaterialAssignments((prev) => {
        const current = readAssignment(prev[meshKey]);
        if (!current) return prev;

        // Determine which mesh keys to update — either just this one, or every mesh
        // assigned the same spec when `linkSameMaterial` is on.
        let targetKeys: string[] = [meshKey];
        if (linkSameMaterial) {
          targetKeys = Object.entries(prev)
            .filter(([, v]) => readAssignment(v)?.specId === current.specId)
            .map(([k]) => k);
        }

        const updates: Record<string, MeshAssignment> = {};
        for (const key of targetKeys) {
          const a = readAssignment(prev[key]);
          if (!a) continue;
          updates[key] = {
            specId:     a.specId,
            scaleX:     transform.scaleX     ?? a.scaleX,
            scaleY:     transform.scaleY     ?? a.scaleY,
            rotation:   transform.rotation   ?? a.rotation,
            roughness:  transform.roughness  ?? a.roughness,
            metalness:  transform.metalness  ?? a.metalness,
            brightness: transform.brightness ?? a.brightness,
          };
        }
        return { ...prev, ...updates };
      });
      dirtyRef.current = true;
    },
    [linkSameMaterial],
  );

  // ── Auto-save (debounced 800 ms after last change to assignments or labels) ─

  useEffect(() => {
    if (!activeModel) return;
    if (!dirtyRef.current) return;

    const handle = setTimeout(async () => {
      const modelId = activeModel.id;
      const assignmentsSnap = materialAssignments;
      const labelsSnap = meshLabels;
      setSaveStatus("saving");
      try {
        await Promise.all([
          saveMaterialAssignments(modelId, assignmentsSnap),
          saveMeshLabels(modelId, labelsSnap),
        ]);
        setModels((prev) =>
          prev.map((m) =>
            m.id === modelId
              ? { ...m, material_assignments: assignmentsSnap, mesh_labels: labelsSnap }
              : m,
          ),
        );
        dirtyRef.current = false;
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 1800);
      } catch (err) {
        console.error(err);
        setSaveStatus("error");
      }
    }, 800);

    return () => clearTimeout(handle);
  }, [materialAssignments, meshLabels, activeModel]);

  // ── Mesh rename ─────────────────────────────────────────────────────────────

  const handleRenameMesh = useCallback((meshKey: string, label: string) => {
    setMeshLabels((prev) => {
      const next = { ...prev };
      const trimmed = label.trim();
      if (!trimmed) delete next[meshKey];
      else next[meshKey] = trimmed;
      return next;
    });
    dirtyRef.current = true;
  }, []);

  // ── Rename ──────────────────────────────────────────────────────────────────

  const handleRename = useCallback(async (modelId: string, name: string) => {
    setModels((prev) => prev.map((m) => (m.id === modelId ? { ...m, name } : m)));
    setActiveModel((prev) => (prev?.id === modelId ? { ...prev, name } : prev));
    try {
      await renameStudioModel(modelId, name);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (modelId: string) => {
      if (!confirm("Delete this model? This cannot be undone.")) return;
      startTransition(async () => {
        await deleteStudioModel(modelId);
        const next = models.filter((m) => m.id !== modelId);
        setModels(next);
        if (activeModel?.id === modelId) setActiveModel(next[0] ?? null);
      });
    },
    [models, activeModel],
  );

  const selectedMeshes = selectedMeshIds
    .map((id) => meshes.find((m) => m.id === id))
    .filter((m): m is MeshInfo => Boolean(m));

  // ── Grid (landing) view ─────────────────────────────────────────────────────

  if (view === "grid") {
    return (
      <div
        className="h-full"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <ModelGrid
          projectName={projectName}
          models={models}
          uploading={uploading}
          uploadProgress={uploadProgress}
          onAdd={() => fileInputRef.current?.click()}
          onOpen={(m) => { setActiveModel(m); setView("editor"); }}
          onDelete={handleDelete}
          onRename={handleRename}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf,.fbx,.obj"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
        />
      </div>
    );
  }

  // ── Editor view ─────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col"
      style={{ margin: -32, height: "calc(100% + 64px)" }}
    >
      {/* Editor top bar — back link + model name + save status */}
      <div
        className="flex items-center gap-4 px-5 flex-shrink-0"
        style={{
          height: 52,
          borderBottom: "1px solid #E4E1DC",
          backgroundColor: "#fff",
        }}
      >
        <button
          onClick={() => { setView("grid"); setSelectedMeshIds([]); }}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
          style={{
            background: "none", border: "none", padding: 0, cursor: "pointer",
            color: "#9A9590", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500,
          }}
          title="Back to all models"
        >
          <ArrowLeft size={14} />
          All models
        </button>

        <div style={{ width: 1, height: 18, backgroundColor: "#E4E1DC" }} />

        {activeModel && (
          <div className="flex items-center gap-2 min-w-0">
            <ModelNameEditable
              key={activeModel.id}
              name={activeModel.name}
              onRename={(name) => handleRename(activeModel.id, name)}
            />
            <span
              style={{
                fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                backgroundColor: "#1A1A1A", color: "#fff", borderRadius: 3, padding: "1px 5px",
                fontFamily: "var(--font-inter), sans-serif", flexShrink: 0,
              }}
            >
              {activeModel.format}
            </span>
          </div>
        )}

        <div className="flex-1" />

        {/* Save status */}
        {saveStatus !== "idle" && (
          <div
            className="flex items-center gap-1.5 flex-shrink-0"
            style={{
              padding: "4px 10px",
              borderRadius: 7,
              backgroundColor: saveStatus === "saving" ? "#F5F3F0" : saveStatus === "saved" ? "#F0FDF4" : "#FEF2F2",
              color: saveStatus === "saving" ? "#9A9590" : saveStatus === "saved" ? "#16A34A" : "#DC2626",
              fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600,
            }}
          >
            {saveStatus === "saving" ? <Loader2 size={11} className="animate-spin" /> :
             saveStatus === "saved"  ? <Check size={11} /> :
                                       <AlertCircle size={11} />}
            {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save failed"}
          </div>
        )}
      </div>

      {/* Three-panel body */}
      <div className="flex flex-1 overflow-hidden">
        <MeshListPanel
          meshes={meshes}
          selectedMeshIds={selectedMeshIds}
          materialAssignments={materialAssignments}
          meshLabels={meshLabels}
          specs={specs}
          onSelectMesh={handleMeshClick}
          onRenameMesh={handleRenameMesh}
        />

        {/* Viewport */}
        <div className="flex-1 relative overflow-hidden">
          {meshUrl ? (
            <StudioCanvas
              meshUrl={meshUrl}
              format={activeModel?.format ?? "glb"}
              selectedMeshIds={selectedMeshIds}
              materialAssignments={materialAssignments}
              specImages={specImages}
              scene={scene}
              onMeshesLoaded={setMeshes}
              onMeshClick={handleMeshClick}
              canvasRef={canvasRef}
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full" style={{ backgroundColor: "#1A1A1A" }}>
              <Loader2 size={24} className="animate-spin" color="#9A9590" />
            </div>
          )}
        </div>

        {/* Right panel — tabbed Material / Scene */}
        <aside
          className="flex flex-col"
          style={{
            width: 264,
            flexShrink: 0,
            backgroundColor: "#fff",
            borderLeft: "1px solid #E4E1DC",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/* Tab bar */}
          <div className="flex" style={{ borderBottom: "1px solid #E4E1DC", padding: "0 8px", gap: 4, flexShrink: 0 }}>
            {(["material", "scene"] as const).map((tab) => {
              const active = rightTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setRightTab(tab)}
                  className="transition-colors"
                  style={{
                    padding: "10px 12px",
                    background: "none",
                    border: "none",
                    borderBottom: active ? "2px solid #1A1A1A" : "2px solid transparent",
                    marginBottom: -1,
                    cursor: "pointer",
                    fontFamily: "var(--font-inter), sans-serif",
                    fontSize: 12,
                    fontWeight: active ? 600 : 500,
                    color: active ? "#1A1A1A" : "#9A9590",
                    textTransform: "capitalize",
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {rightTab === "material" ? (
            <MaterialPanel
              selectedMeshes={selectedMeshes}
              specs={specs}
              materialAssignments={materialAssignments}
              meshLabels={meshLabels}
              linkSameMaterial={linkSameMaterial}
              onLinkSameMaterialChange={setLinkSameMaterial}
              onAssign={handleAssign}
              onUnassign={handleUnassign}
              onUpdateTransform={handleUpdateTransform}
            />
          ) : (
            <ScenePanel scene={scene} onChange={handleSceneChange} />
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Inline-editable model name (used in editor top bar) ───────────────────────

function ModelNameEditable({
  name,
  onRename,
}: {
  name: string;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(name); }, [name]);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    else setDraft(name);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setEditing(false); setDraft(name); }
        }}
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: "#1A1A1A",
          border: "1px solid #E4E1DC",
          borderRadius: 5,
          outline: "none",
          backgroundColor: "#fff",
          padding: "1px 6px",
          maxWidth: 280,
        }}
      />
    );
  }

  return (
    <p
      onDoubleClick={() => setEditing(true)}
      className="truncate"
      style={{
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: 13,
        fontWeight: 600,
        color: "#1A1A1A",
        cursor: "text",
      }}
      title="Double-click to rename"
    >
      {name}
    </p>
  );
}
