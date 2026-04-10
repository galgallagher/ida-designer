"use client";

/**
 * RolesClient — /settings/roles
 *
 * Lets studio admins manage configurable job titles (e.g. Senior Designer,
 * Middleweight, Junior). These are display labels only — access control is
 * handled separately by the owner/admin/designer/viewer system.
 */

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Check, X, Loader2 } from "lucide-react";
import {
  createStudioRole,
  updateStudioRole,
  deleteStudioRole,
  moveStudioRole,
} from "./actions";
import type { StudioRoleRow } from "@/types/database";

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  height: 36,
  paddingLeft: 10,
  paddingRight: 10,
  fontFamily: "var(--font-inter), sans-serif",
  fontSize: 13,
  color: "#1A1A1A",
  backgroundColor: "#FAFAF9",
  border: "1.5px solid #E4E1DC",
  borderRadius: 8,
  outline: "none",
  boxSizing: "border-box",
  flex: 1,
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  roles: StudioRoleRow[];
  memberCountByRole: Record<string, number>;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RolesClient({ roles, memberCountByRole }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Add new role ────────────────────────────────────────────────────────────

  function handleAddClick() {
    setAddingNew(true);
    setNewName("");
    setError(null);
  }

  function handleAddCancel() {
    setAddingNew(false);
    setNewName("");
    setError(null);
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("name", newName);
    startTransition(async () => {
      const result = await createStudioRole(fd);
      if (result.error) {
        setError(result.error);
      } else {
        setAddingNew(false);
        setNewName("");
      }
    });
  }

  // ── Edit role ───────────────────────────────────────────────────────────────

  function handleEditClick(role: StudioRoleRow) {
    setEditingId(role.id);
    setEditName(role.name);
    setError(null);
  }

  function handleEditCancel() {
    setEditingId(null);
    setEditName("");
    setError(null);
  }

  function handleEditSubmit(e: React.FormEvent, id: string) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("name", editName);
    startTransition(async () => {
      const result = await updateStudioRole(id, fd);
      if (result.error) {
        setError(result.error);
      } else {
        setEditingId(null);
      }
    });
  }

  // ── Delete role ─────────────────────────────────────────────────────────────

  function handleDelete(role: StudioRoleRow) {
    const count = memberCountByRole[role.id] ?? 0;
    const confirm = window.confirm(
      count > 0
        ? `"${role.name}" is assigned to ${count} team member${count === 1 ? "" : "s"}. Deleting it will un-assign them. Continue?`
        : `Delete "${role.name}"?`
    );
    if (!confirm) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteStudioRole(role.id);
      if (result.error) setError(result.error);
    });
  }

  // ── Move role ───────────────────────────────────────────────────────────────

  function handleMove(id: string, direction: "up" | "down") {
    startTransition(async () => {
      await moveStudioRole(id, direction);
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            Studio Roles
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            Define the role titles used in your studio. These are display labels — separate from system access levels.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAddClick}
          disabled={addingNew || isPending}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer", flexShrink: 0 }}
        >
          <Plus size={14} />
          Add role
        </button>
      </div>

      {/* Global error */}
      {error && (
        <div className="mb-4 px-4 py-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
          {error}
        </div>
      )}

      {/* Role list */}
      <div className="flex flex-col gap-2">
        {roles.map((role, i) => {
          const isEditing = editingId === role.id;
          const count = memberCountByRole[role.id] ?? 0;

          return (
            <div
              key={role.id}
              className="flex items-center gap-3 px-4 py-3 bg-white"
              style={{ borderRadius: 12, boxShadow: "0 1px 6px rgba(26,26,26,0.06)" }}
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => handleMove(role.id, "up")}
                  disabled={i === 0 || isPending}
                  style={{ border: "none", background: "none", cursor: i === 0 ? "default" : "pointer", padding: 1, color: i === 0 ? "#E4E1DC" : "#9A9590" }}
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleMove(role.id, "down")}
                  disabled={i === roles.length - 1 || isPending}
                  style={{ border: "none", background: "none", cursor: i === roles.length - 1 ? "default" : "pointer", padding: 1, color: i === roles.length - 1 ? "#E4E1DC" : "#9A9590" }}
                >
                  <ChevronDown size={13} />
                </button>
              </div>

              {/* Name / edit form */}
              {isEditing ? (
                <form onSubmit={(e) => handleEditSubmit(e, role.id)} className="flex items-center gap-2 flex-1">
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={inputStyle}
                    placeholder="Role name"
                    required
                  />
                  <button type="submit" disabled={isPending} style={{ border: "none", background: "none", cursor: "pointer", color: "#22C55E", padding: 4 }}>
                    {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  </button>
                  <button type="button" onClick={handleEditCancel} style={{ border: "none", background: "none", cursor: "pointer", color: "#9A9590", padding: 4 }}>
                    <X size={15} />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 500, color: "#1A1A1A" }}>
                    {role.name}
                  </span>
                  {count > 0 && (
                    <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", backgroundColor: "#F0EEEB", borderRadius: 20, padding: "2px 8px" }}>
                      {count} {count === 1 ? "member" : "members"}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              {!isEditing && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditClick(role)}
                    disabled={isPending}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#9A9590", padding: 6, borderRadius: 6 }}
                    className="hover:bg-black/[0.05] transition-colors"
                    title="Rename"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(role)}
                    disabled={isPending}
                    style={{ border: "none", background: "none", cursor: "pointer", color: "#9A9590", padding: 6, borderRadius: 6 }}
                    className="hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Add new row */}
        {addingNew && (
          <form
            onSubmit={handleAddSubmit}
            className="flex items-center gap-3 px-4 py-3 bg-white"
            style={{ borderRadius: 12, boxShadow: "0 1px 6px rgba(26,26,26,0.06)", border: "1.5px solid #FFDE28" }}
          >
            <div style={{ width: 30, flexShrink: 0 }} /> {/* spacer for reorder column */}
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={inputStyle}
              placeholder="e.g. Senior Designer"
              required
            />
            <button type="submit" disabled={isPending} style={{ border: "none", background: "none", cursor: "pointer", color: "#22C55E", padding: 4 }}>
              {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            </button>
            <button type="button" onClick={handleAddCancel} style={{ border: "none", background: "none", cursor: "pointer", color: "#9A9590", padding: 4 }}>
              <X size={15} />
            </button>
          </form>
        )}

        {/* Empty state */}
        {roles.length === 0 && !addingNew && (
          <div
            className="flex flex-col items-center justify-center py-12 text-center"
            style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
          >
            <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
              No roles yet
            </p>
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 16, lineHeight: 1.6 }}>
              Add role titles like Senior Designer, Middleweight, or Junior.
            </p>
            <button
              type="button"
              onClick={handleAddClick}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
              style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer" }}
            >
              <Plus size={14} />
              Add first role
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
