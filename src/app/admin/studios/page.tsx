import Link from "next/link";
import { ChevronRight, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { StudioRow } from "@/types/database";

type StudioWithCounts = StudioRow & {
  member_count: number;
  project_count: number;
};

export default async function AdminStudiosPage() {
  const supabase = await createClient();

  const { data: studios } = await supabase
    .from("studios")
    .select("*")
    .order("created_at", { ascending: false });

  const studioIds = (studios ?? []).map((s) => s.id);

  // Two queries total — no longer N+1. We pull every relevant member/project
  // row once and tally per-studio counts in JS. Cheaper than one round-trip
  // per studio, and Supabase doesn't expose GROUP BY in the JS client.
  const [membersRes, projectsRes] = await Promise.all([
    studioIds.length > 0
      ? supabase.from("studio_members").select("studio_id").in("studio_id", studioIds)
      : Promise.resolve({ data: [] as { studio_id: string }[] }),
    studioIds.length > 0
      ? supabase.from("projects").select("studio_id").in("studio_id", studioIds)
      : Promise.resolve({ data: [] as { studio_id: string }[] }),
  ]);

  const memberCounts = new Map<string, number>();
  for (const m of membersRes.data ?? []) {
    memberCounts.set(m.studio_id, (memberCounts.get(m.studio_id) ?? 0) + 1);
  }
  const projectCounts = new Map<string, number>();
  for (const p of projectsRes.data ?? []) {
    projectCounts.set(p.studio_id, (projectCounts.get(p.studio_id) ?? 0) + 1);
  }

  const enriched: StudioWithCounts[] = (studios ?? []).map((s) => ({
    ...s,
    member_count: memberCounts.get(s.id) ?? 0,
    project_count: projectCounts.get(s.id) ?? 0,
  }));

  return (
    <div className="flex flex-col" style={{ padding: 32, gap: 16 }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC" }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 22, fontWeight: 700, color: "#1A1A1A" }}>
            Studios
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", marginTop: 2 }}>
            {enriched.length} {enriched.length === 1 ? "studio" : "studios"} on the platform
          </p>
        </div>
      </div>

      {/* Studios list */}
      {enriched.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center"
          style={{ border: "2px dashed #E4E1DC", borderRadius: 14, padding: 48, textAlign: "center", backgroundColor: "#FFFFFF", marginTop: 24 }}
        >
          <Building2 size={32} color="#C0BEBB" />
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 12 }}>
            No studios on the platform yet.
          </p>
        </div>
      ) : (
        <div
          className="flex flex-col"
          style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC", overflow: "hidden" }}
        >
          {/* Table header */}
          <div
            className="grid items-center px-6 py-3"
            style={{
              gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) 90px 90px 24px",
              gap: 16,
              borderBottom: "1px solid #E4E1DC",
              backgroundColor: "#FAFAF9",
            }}
          >
            <Th>Studio</Th>
            <Th>Plan</Th>
            <Th>Members</Th>
            <Th>Projects</Th>
            <span />
          </div>

          {enriched.map((s) => (
            <Link
              key={s.id}
              href={`/admin/studios/${s.id}`}
              className="grid items-center px-6 py-4 transition-colors hover:bg-[#F5F3F0]"
              style={{
                gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr) 90px 90px 24px",
                gap: 16,
                borderBottom: "1px solid #F5F3F0",
                textDecoration: "none",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  style={{
                    width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                    backgroundColor: "#F5F3F0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#1A1A1A",
                  }}
                >
                  <Building2 size={16} />
                </div>
                <div className="min-w-0">
                  <p
                    className="truncate"
                    style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600, color: "#1A1A1A" }}
                  >
                    {s.name}
                  </p>
                  <p
                    className="truncate"
                    style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}
                  >
                    {s.slug}
                  </p>
                </div>
              </div>

              <SubStatusBadge status={s.subscription_status} />

              <Td>{s.member_count}</Td>
              <Td>{s.project_count}</Td>

              <ChevronRight size={14} color="#9A9590" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
        color: "#9A9590",
      }}
    >
      {children}
    </span>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: 13, color: "#1A1A1A", fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </span>
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
        borderRadius: 6, padding: "3px 8px",
        width: "fit-content",
      }}
    >
      {c.label}
    </span>
  );
}
