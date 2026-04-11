"use client";

/**
 * ProjectTeamClient — /projects/[id]/team
 *
 * Shows which studio members are assigned to this project.
 * Admins can add (multi-select modal) or remove members.
 */

import { useState, useTransition } from "react";
import { UserPlus, Trash2, Loader2, Users, Check } from "lucide-react";
import { addProjectMember, removeProjectMember } from "./actions";
import type { StudioMemberRole } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectMemberEntry {
  projectMemberId: string;
  studioMemberId: string;
  userId: string | null;
  role: StudioMemberRole;
  jobTitle: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface StudioMemberOption {
  studioMemberId: string;
  userId: string | null;
  role: StudioMemberRole;
  jobTitle: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface Props {
  projectId: string;
  projectName: string;
  assignedMembers: ProjectMemberEntry[];
  availableMembers: StudioMemberOption[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ") || "Unnamed";
}

function initials(first: string | null, last: string | null): string {
  return [(first ?? "")[0], (last ?? "")[0]].filter(Boolean).join("").toUpperCase() || "?";
}

const roleColour: Record<StudioMemberRole, string> = {
  owner:    "#6366F1",
  admin:    "#F59E0B",
  designer: "#22C55E",
  viewer:   "#9A9590",
};

// ── Add members modal (multi-select) ──────────────────────────────────────────

function AddMembersModal({
  projectId,
  available,
  onDone,
  onError,
}: {
  projectId: string;
  available: StudioMemberOption[];
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAdd() {
    if (selected.size === 0) return;
    startTransition(async () => {
      const ids = Array.from(selected);
      const results = await Promise.all(ids.map((id) => addProjectMember(projectId, id)));
      const errors = results.map((r) => r.error).filter(Boolean);
      if (errors.length > 0) onError(errors[0]!);
      onDone();
    });
  }

  return (
    <>
      {/* Header */}
      <DialogHeader
        style={{ borderBottom: "1px solid #F0EEEB", padding: "16px 20px", flexShrink: 0 }}
      >
        <DialogTitle
          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 15, fontWeight: 600, color: "#1A1A1A" }}
        >
          Add team members
        </DialogTitle>
        {selected.size > 0 && (
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", marginTop: 1 }}>
            {selected.size} selected
          </p>
        )}
      </DialogHeader>

      {/* Member list */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {available.map((m) => {
          const isSelected = selected.has(m.studioMemberId);
          return (
            <button
              key={m.studioMemberId}
              type="button"
              onClick={() => toggle(m.studioMemberId)}
              className="flex items-center gap-3 w-full px-5 py-3 text-left transition-colors"
              style={{
                border: "none",
                borderBottom: "1px solid #F0EEEB",
                background: isSelected ? "#FFFBEB" : "white",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {/* Avatar */}
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: isSelected ? "#FFDE28" : "#F0EEEB", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", transition: "background 0.15s" }}
              >
                {isSelected ? <Check size={16} /> : initials(m.firstName, m.lastName)}
              </div>

              {/* Name + title */}
              <div className="flex-1 min-w-0">
                <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#1A1A1A" }}>
                  {displayName(m.firstName, m.lastName)}
                </p>
                {m.jobTitle && (
                  <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
                    {m.jobTitle}
                  </p>
                )}
              </div>

              {/* Role dot */}
              <span
                className="inline-block rounded-full flex-shrink-0"
                style={{ width: 7, height: 7, backgroundColor: roleColour[m.role] }}
                title={m.role}
              />
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 px-5 py-4" style={{ borderTop: "1px solid #F0EEEB", flexShrink: 0 }}>
        <button
          type="button"
          onClick={onDone}
          style={{ height: 36, paddingLeft: 16, paddingRight: 16, backgroundColor: "transparent", border: "1px solid #E4E1DC", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#9A9590", cursor: "pointer", outline: "none" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={selected.size === 0 || isPending}
          className="flex items-center gap-1.5 transition-opacity"
          style={{ height: 36, paddingLeft: 16, paddingRight: 16, backgroundColor: selected.size > 0 ? "#FFDE28" : "#F0EEEB", border: "none", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: selected.size > 0 ? "#1A1A1A" : "#C0BEBB", cursor: selected.size > 0 ? "pointer" : "default", outline: "none", transition: "background 0.15s" }}
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
          {isPending ? "Adding…" : `Add${selected.size > 0 ? ` ${selected.size}` : ""}`}
        </button>
      </div>
    </>
  );
}

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({
  member,
  projectId,
  onError,
}: {
  member: ProjectMemberEntry;
  projectId: string;
  onError: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    const name = displayName(member.firstName, member.lastName);
    if (!window.confirm(`Remove ${name} from this project?`)) return;
    startTransition(async () => {
      const result = await removeProjectMember(member.projectMemberId, projectId);
      if (result.error) onError(result.error);
    });
  }

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 bg-white"
      style={{ borderRadius: 12, boxShadow: "0 1px 6px rgba(26,26,26,0.06)", opacity: isPending ? 0.6 : 1 }}
    >
      {/* Avatar */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 38, height: 38, borderRadius: "50%", backgroundColor: "#F0EEEB", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#9A9590" }}
      >
        {initials(member.firstName, member.lastName)}
      </div>

      {/* Name + title */}
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 500, color: "#1A1A1A" }}>
          {displayName(member.firstName, member.lastName)}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {member.jobTitle && (
            <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}>
              {member.jobTitle}
            </span>
          )}
          {member.jobTitle && <span style={{ color: "#E4E1DC" }}>·</span>}
          <div className="flex items-center gap-1">
            <span className="inline-block rounded-full" style={{ width: 6, height: 6, backgroundColor: roleColour[member.role], flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", textTransform: "capitalize" }}>
              {member.role}
            </span>
          </div>
        </div>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        title="Remove from project"
        style={{ border: "none", background: "none", cursor: "pointer", color: "#C0BEBB", padding: 6, borderRadius: 6, flexShrink: 0, outline: "none" }}
        className="hover:text-red-400 hover:bg-red-50 transition-colors"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectTeamClient({
  projectId,
  projectName,
  assignedMembers,
  availableMembers,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            Project Team
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            {assignedMembers.length === 0
              ? `No one assigned to ${projectName} yet.`
              : `${assignedMembers.length} ${assignedMembers.length === 1 ? "person" : "people"} assigned to ${projectName}.`}
          </p>
        </div>

        {availableMembers.length > 0 && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer", outline: "none" }}
          >
            <UserPlus size={14} />
            Add member
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, fontWeight: 600, background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>✕</button>
        </div>
      )}

      {/* Member list */}
      {assignedMembers.length > 0 ? (
        <div className="flex flex-col gap-2">
          {assignedMembers.map((m) => (
            <MemberCard key={m.projectMemberId} member={m} projectId={projectId} onError={setError} />
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center py-16 text-center"
          style={{ borderRadius: 14, border: "1.5px dashed #E4E1DC", backgroundColor: "#FAFAF9" }}
        >
          <div className="flex items-center justify-center rounded-full mb-3" style={{ width: 44, height: 44, backgroundColor: "#F0EEEB" }}>
            <Users size={18} style={{ color: "#C0BEBB" }} />
          </div>
          <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 16, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
            No team members yet
          </p>
          <p className="max-w-xs mb-5" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", lineHeight: 1.6 }}>
            Assign studio members to track who is working on this project.
          </p>
          {availableMembers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
              style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer", outline: "none" }}
            >
              <UserPlus size={14} />
              Add first member
            </button>
          )}
        </div>
      )}

      {/* Multi-select modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent
          style={{ width: 420, padding: 0, overflow: "hidden", borderRadius: 16 }}
          className="flex flex-col max-h-[70vh] gap-0"
        >
          <AddMembersModal
            projectId={projectId}
            available={availableMembers}
            onDone={() => setShowModal(false)}
            onError={setError}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
