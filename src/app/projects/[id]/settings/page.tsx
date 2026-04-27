import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentStudioId } from "@/lib/studio-context";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectSettingsPage({ params }: PageProps) {
  const { id: projectId } = await params;
  const supabase = await createClient();
  const studioId = await getCurrentStudioId();
  if (!studioId) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, code, status, site_address, description")
    .eq("id", projectId)
    .eq("studio_id", studioId)
    .single();

  if (!project) notFound();

  return (
    <div style={{ maxWidth: 560 }}>
      <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 26, fontWeight: 700, color: "#1A1A1A", marginBottom: 4 }}>
        Settings
      </h1>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 32 }}>
        {project.name}
      </p>

      <div className="flex flex-col gap-4">
        <Field label="Project name" value={project.name} />
        {project.code && <Field label="Project code" value={project.code} />}
        {project.site_address && <Field label="Site address" value={project.site_address} />}
        {project.description && <Field label="Description" value={project.description} />}
      </div>

      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#C0BEBB", marginTop: 32 }}>
        Editing project details coming soon.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ backgroundColor: "#FFFFFF", borderRadius: 10, padding: "14px 16px", boxShadow: "0 1px 6px rgba(26,26,26,0.06)" }}>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
        {label}
      </p>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, color: "#1A1A1A" }}>
        {value}
      </p>
    </div>
  );
}
