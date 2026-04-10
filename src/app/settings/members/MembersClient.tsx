"use client";

/**
 * MembersClient — /settings/members
 *
 * Shows all current studio members. Admins can:
 * - Change a member's access role (owner/admin/designer/viewer)
 * - Assign a job title from the studio's configured roles
 * - Remove a member
 */

import { useState, useTransition } from "react";
import { Trash2, Loader2, Shield, UserCircle, UserPlus, X, Check } from "lucide-react";
import { updateMemberAccessRole, updateMemberJobTitle, removeMember, addMember } from "./actions";
import type { StudioMemberRole, StudioRoleRow } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemberWithProfile {
  id: string;
  user_id: string | null;
  role: StudioMemberRole;
  studio_role_id: string | null;
  created_at: string;
  email: string | null;
  // Name from profile (active members) or directly on the row (pending)
  first_name: string | null;
  last_name: string | null;
}

interface Props {
  members: MemberWithProfile[];
  roles: StudioRoleRow[];
  currentUserId: string;
}

// ── Access role config ────────────────────────────────────────────────────────

const ACCESS_ROLES: { value: StudioMemberRole; label: string; description: string }[] = [
  { value: "owner",    label: "Owner",    description: "Full control, can delete studio" },
  { value: "admin",    label: "Admin",    description: "Manage members and all content" },
  { value: "designer", label: "Designer", description: "Create and edit content" },
  { value: "viewer",   label: "Viewer",   description: "Read-only access" },
];

const roleColour: Record<StudioMemberRole, string> = {
  owner:    "#6366F1",
  admin:    "#F59E0B",
  designer: "#22C55E",
  viewer:   "#9A9590",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function displayName(member: MemberWithProfile): string {
  const { first_name, last_name } = member;
  if (first_name || last_name) return [first_name, last_name].filter(Boolean).join(" ");
  return member.email ?? "Unnamed member";
}

function initials(member: MemberWithProfile): string {
  const { first_name, last_name } = member;
  return [(first_name ?? "")[0], (last_name ?? "")[0]].filter(Boolean).join("").toUpperCase() || "?";
}

// ── Row component ─────────────────────────────────────────────────────────────

function MemberRow({
  member,
  roles,
  currentUserId,
  onError,
}: {
  member: MemberWithProfile;
  roles: StudioRoleRow[];
  currentUserId: string;
  onError: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const isSelf = member.user_id === currentUserId;

  function handleAccessRoleChange(newRole: StudioMemberRole) {
    startTransition(async () => {
      const result = await updateMemberAccessRole(member.id, newRole);
      if (result.error) onError(result.error);
    });
  }

  function handleJobTitleChange(roleId: string) {
    const value = roleId === "" ? null : roleId;
    startTransition(async () => {
      const result = await updateMemberJobTitle(member.id, value);
      if (result.error) onError(result.error);
    });
  }

  function handleRemove() {
    const name = displayName(member);
    if (!window.confirm(`Remove ${name} from the studio?`)) return;
    startTransition(async () => {
      const result = await removeMember(member.id);
      if (result.error) onError(result.error);
    });
  }

  const selectStyle: React.CSSProperties = {
    height: 32,
    paddingLeft: 8,
    paddingRight: 24,
    fontFamily: "var(--font-inter), sans-serif",
    fontSize: 12,
    color: "#1A1A1A",
    backgroundColor: "#FAFAF9",
    border: "1.5px solid #E4E1DC",
    borderRadius: 7,
    outline: "none",
    cursor: "pointer",
    appearance: "auto",
  };

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 bg-white"
      style={{ borderRadius: 12, boxShadow: "0 1px 6px rgba(26,26,26,0.06)", opacity: isPending ? 0.6 : 1 }}
    >
      {/* Avatar */}
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "#F0EEEB", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#9A9590" }}
      >
        {initials(member)}
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 500, color: "#1A1A1A" }}>
            {displayName(member)}
          </span>
          {isSelf && (
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: "#E4E1DC", color: "#9A9590", borderRadius: 4, padding: "2px 6px" }}>
              You
            </span>
          )}
          {!member.user_id && (
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: "#FEF3C7", color: "#B45309", borderRadius: 4, padding: "2px 6px" }}>
              Pending
            </span>
          )}
        </div>
        {/* Email (pending) or access role (active) */}
        {!member.user_id && member.email ? (
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}>
            {member.email}
          </p>
        ) : (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="inline-block rounded-full" style={{ width: 6, height: 6, backgroundColor: roleColour[member.role], flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", textTransform: "capitalize" }}>
              {member.role}
            </span>
          </div>
        )}
      </div>

      {/* Job title select */}
      <select
        value={member.studio_role_id ?? ""}
        onChange={(e) => handleJobTitleChange(e.target.value)}
        disabled={isPending}
        style={selectStyle}
        title="Job title"
      >
        <option value="">No title</option>
        {roles.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      {/* Access role select */}
      <select
        value={member.role}
        onChange={(e) => handleAccessRoleChange(e.target.value as StudioMemberRole)}
        disabled={isPending}
        style={selectStyle}
        title="Access level"
      >
        {ACCESS_ROLES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>

      {/* Remove button */}
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending || isSelf}
        title={isSelf ? "Cannot remove yourself" : "Remove from studio"}
        style={{ border: "none", background: "none", cursor: isSelf ? "not-allowed" : "pointer", color: "#C0BEBB", padding: 6, borderRadius: 6, flexShrink: 0 }}
        className="hover:text-red-400 hover:bg-red-50 transition-colors"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// ── Add member form ───────────────────────────────────────────────────────────

function AddMemberForm({ onSuccess, onError }: { onSuccess: () => void; onError: (msg: string) => void }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !email.trim()) return;
    startTransition(async () => {
      const result = await addMember(firstName.trim(), lastName.trim(), email.trim());
      if (result.error) {
        onError(result.error);
      } else {
        setFirstName(""); setLastName(""); setEmail("");
        onSuccess();
      }
    });
  }

  const inputStyle: React.CSSProperties = {
    height: 34,
    paddingLeft: 10,
    paddingRight: 10,
    fontFamily: "var(--font-inter), sans-serif",
    fontSize: 13,
    color: "#1A1A1A",
    backgroundColor: "#FAFAF9",
    border: "1.5px solid #E4E1DC",
    borderRadius: 7,
    outline: "none",
    minWidth: 0,
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 px-4 py-3 bg-white"
      style={{ borderRadius: 12, boxShadow: "0 1px 6px rgba(26,26,26,0.06)", border: "1.5px solid #FFDE28" }}
    >
      <input
        type="text"
        value={firstName}
        onChange={(e) => setFirstName(e.target.value)}
        placeholder="First name"
        required
        autoFocus
        style={{ ...inputStyle, flex: "0 0 130px" }}
      />
      <input
        type="text"
        value={lastName}
        onChange={(e) => setLastName(e.target.value)}
        placeholder="Last name"
        style={{ ...inputStyle, flex: "0 0 130px" }}
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email address"
        required
        style={{ ...inputStyle, flex: 1 }}
      />
      <button
        type="submit"
        disabled={isPending || !firstName.trim() || !email.trim()}
        style={{ border: "none", background: "none", cursor: "pointer", color: "#22C55E", padding: 6, outline: "none", flexShrink: 0 }}
      >
        {isPending ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
      </button>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MembersClient({ members, roles, currentUserId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
            Team Members
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            {members.length} {members.length === 1 ? "member" : "members"} in this studio. Assign job titles and access levels below.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowAddForm((v) => !v); setError(null); }}
          className="flex items-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ height: 36, paddingLeft: 14, paddingRight: 14, backgroundColor: "#FFDE28", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A", border: "none", cursor: "pointer", flexShrink: 0, outline: "none" }}
        >
          {showAddForm ? <X size={14} /> : <UserPlus size={14} />}
          {showAddForm ? "Cancel" : "Add member"}
        </button>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-4 px-4 mb-2" style={{ paddingLeft: 64 }}>
        <div className="flex-1" />
        <span style={{ width: 120, fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>
          Job title
        </span>
        <span style={{ width: 100, fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "right" }}>
          Access
        </span>
        <div style={{ width: 32 }} />
      </div>

      {/* Add member form */}
      {showAddForm && (
        <div className="mb-3">
          <AddMemberForm
            onSuccess={() => setShowAddForm(false)}
            onError={setError}
          />
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 6, paddingLeft: 4 }}>
            Added as Designer by default. You can invite them to log in later.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 px-4 py-3" style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#DC2626" }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 8, fontWeight: 600, background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>✕</button>
        </div>
      )}

      {/* Member list */}
      <div className="flex flex-col gap-2">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            roles={roles}
            currentUserId={currentUserId}
            onError={setError}
          />
        ))}
      </div>

      {/* Info callout */}
      <div className="flex items-start gap-3 mt-6 px-4 py-3" style={{ backgroundColor: "#F0EEEB", borderRadius: 10 }}>
        <Shield size={14} style={{ color: "#9A9590", flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", lineHeight: 1.6 }}>
            <strong style={{ color: "#1A1A1A" }}>Job titles</strong> are display labels (e.g. Senior Designer).{" "}
            <strong style={{ color: "#1A1A1A" }}>Access levels</strong> control what each person can do in the system.{" "}
            Configure job title options in{" "}
            <a href="/settings/roles" style={{ color: "#1A1A1A", fontWeight: 500 }}>Studio Roles</a>.
          </p>
        </div>
      </div>

      {/* No roles hint */}
      {roles.length === 0 && (
        <div className="flex items-center gap-2 mt-3 px-4" style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}>
          <UserCircle size={13} />
          <span>No job titles configured yet. <a href="/settings/roles" style={{ color: "#1A1A1A", fontWeight: 500 }}>Add some in Studio Roles →</a></span>
        </div>
      )}
    </div>
  );
}
