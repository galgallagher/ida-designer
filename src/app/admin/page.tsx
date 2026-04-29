import Link from "next/link";
import { Building2, Layers, Package } from "lucide-react";

export default function AdminLandingPage() {
  return (
      <div className="flex flex-col" style={{ padding: 32, gap: 24 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 28, fontWeight: 700, color: "#1A1A1A" }}>
            Platform Admin
          </h1>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginTop: 4 }}>
            Manage platform-wide defaults that apply to every studio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" style={{ maxWidth: 900 }}>
          <AdminCard
            href="/admin/studios"
            icon={<Building2 size={20} />}
            title="Studios"
            description="View every studio on the platform, their members, and (soon) billing."
          />
          <AdminCard
            href="/admin/default-finishes"
            icon={<Layers size={20} />}
            title="Default Finishes"
            description="Curate the Finishes Library that every new studio is seeded with."
          />
          <AdminCard
            href="/admin/global-specs"
            icon={<Package size={20} />}
            title="Global Library"
            description="Manage scraped products available across all studios."
            soon
          />
        </div>
      </div>
  );
}

function AdminCard({
  href,
  icon,
  title,
  description,
  soon,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  soon?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 9,
            backgroundColor: "#F5F3F0",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#1A1A1A",
          }}
        >
          {icon}
        </div>
        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
          {title}
        </p>
        {soon && (
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", backgroundColor: "#E4E1DC", color: "#9A9590", borderRadius: 4, padding: "2px 6px", fontFamily: "var(--font-inter), sans-serif" }}>
            Soon
          </span>
        )}
      </div>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590", lineHeight: 1.5 }}>
        {description}
      </p>
    </>
  );

  if (soon) {
    return (
      <div
        style={{
          backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC",
          padding: 20, opacity: 0.6, cursor: "not-allowed",
        }}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="hover:shadow-md transition-shadow"
      style={{
        backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC",
        padding: 20, textDecoration: "none", display: "block",
      }}
    >
      {inner}
    </Link>
  );
}
