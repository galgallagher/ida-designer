import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, CreditCard, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { StudioMemberRow, StudioRow, ProjectRow } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminStudioDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: studio } = await supabase
    .from("studios")
    .select("*")
    .eq("id", id)
    .single();

  if (!studio) notFound();

  const [{ data: members }, { data: projects }] = await Promise.all([
    supabase
      .from("studio_members")
      .select("*")
      .eq("studio_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("projects")
      .select("*")
      .eq("studio_id", id)
      .order("name", { ascending: true }),
  ]);

  return (
    <div className="flex flex-col" style={{ padding: 32, gap: 16 }}>
      <Link
        href="/admin/studios"
        className="flex items-center gap-1.5 transition-opacity hover:opacity-70"
        style={{ color: "#9A9590", fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 500, textDecoration: "none", width: "fit-content" }}
      >
        <ArrowLeft size={13} />
        Studios
      </Link>

      {/* Header card */}
      <div
        className="flex items-center gap-4 px-6 py-5"
        style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC" }}
      >
        <div
          style={{
            width: 52, height: 52, borderRadius: 12, flexShrink: 0,
            backgroundColor: "#F5F3F0",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#1A1A1A",
          }}
        >
          <Building2 size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 22, fontWeight: 700, color: "#1A1A1A" }}>
            {studio.name}
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", marginTop: 2 }}>
            {studio.slug} · created {new Date(studio.created_at).toLocaleDateString()}
          </p>
        </div>
        <SubStatusBadge status={studio.subscription_status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Members */}
        <div
          className="flex flex-col"
          style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC", overflow: "hidden" }}
        >
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid #E4E1DC" }}>
            <Users size={14} color="#9A9590" />
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>
              Members
            </p>
            <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
              {(members ?? []).length}
            </span>
          </div>
          {(members ?? []).length === 0 ? (
            <p
              className="px-5 py-6 text-center"
              style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB" }}
            >
              No members yet.
            </p>
          ) : (
            <div className="flex flex-col">
              {(members ?? []).map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
            </div>
          )}
        </div>

        {/* Billing — placeholder */}
        <div
          className="flex flex-col"
          style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC", overflow: "hidden" }}
        >
          <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid #E4E1DC" }}>
            <CreditCard size={14} color="#9A9590" />
            <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>
              Billing
            </p>
            <span
              style={{
                fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                backgroundColor: "#E4E1DC", color: "#9A9590", borderRadius: 4, padding: "2px 6px",
                fontFamily: "var(--font-inter), sans-serif", marginLeft: "auto",
              }}
            >
              Soon
            </span>
          </div>
          <div className="px-5 py-5 flex flex-col gap-3">
            <Field label="Subscription">
              <SubStatusBadge status={studio.subscription_status} />
            </Field>
            <Field label="Plan">
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
                Stripe integration not yet configured
              </p>
            </Field>
            <Field label="Renewal date">
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>—</p>
            </Field>
          </div>
        </div>
      </div>

      {/* Projects */}
      <div
        className="flex flex-col"
        style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC", overflow: "hidden" }}
      >
        <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid #E4E1DC" }}>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}>
            Projects
          </p>
          <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590" }}>
            {(projects ?? []).length}
          </span>
        </div>
        {(projects ?? []).length === 0 ? (
          <p
            className="px-5 py-6 text-center"
            style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB" }}
          >
            No projects yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 p-4">
            {(projects ?? []).map((p: ProjectRow) => (
              <div
                key={p.id}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid #E4E1DC",
                  backgroundColor: "#FAFAF9",
                }}
              >
                <p
                  className="truncate"
                  style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600, color: "#1A1A1A" }}
                >
                  {p.name}
                </p>
                {p.code && (
                  <p
                    style={{
                      fontFamily: "var(--font-inter), sans-serif",
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                      color: "#9A9590", marginTop: 1,
                    }}
                  >
                    {p.code}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
          color: "#9A9590",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function MemberRow({ member }: { member: StudioMemberRow }) {
  const name = member.first_name
    ? `${member.first_name} ${member.last_name ?? ""}`.trim()
    : member.email ?? "Unknown";
  const initials = (member.first_name?.[0] ?? member.email?.[0] ?? "?").toUpperCase();
  return (
    <div className="flex items-center gap-3 px-5 py-3" style={{ borderBottom: "1px solid #F5F3F0" }}>
      <div
        style={{
          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
          backgroundColor: "#F5F3F0", color: "#1A1A1A",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-inter), sans-serif", fontSize: 12, fontWeight: 600,
        }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="truncate"
          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}
        >
          {name}
        </p>
        {member.email && (
          <p
            className="truncate"
            style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}
          >
            {member.email}
          </p>
        )}
      </div>
      <span
        style={{
          fontFamily: "var(--font-inter), sans-serif",
          fontSize: 11, fontWeight: 600, color: "#1A1A1A",
          backgroundColor: "#F5F3F0", borderRadius: 5, padding: "2px 8px",
          textTransform: "capitalize",
        }}
      >
        {member.role}
      </span>
    </div>
  );
}

function SubStatusBadge({ status }: { status: StudioRow["subscription_status"] }) {
  const config: Record<StudioRow["subscription_status"], { label: string; color: string; bg: string }> = {
    trial:     { label: "Trial",     color: "#1A1A1A", bg: "#FFFBEB" },
    active:    { label: "Active",    color: "#16A34A", bg: "#F0FDF4" },
    past_due:  { label: "Past due",  color: "#DC2626", bg: "#FEF2F2" },
    cancelled: { label: "Cancelled", color: "#9A9590", bg: "#F5F3F0" },
  };
  const c = config[status] ?? config.cancelled;
  return (
    <span
      style={{
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: 11, fontWeight: 600,
        color: c.color, backgroundColor: c.bg,
        borderRadius: 6, padding: "4px 10px",
        width: "fit-content",
      }}
    >
      {c.label}
    </span>
  );
}
