"use client";

/**
 * ClientsPageClient — thin client wrapper for the Clients page.
 *
 * Owns only the modal open/close state. All data rendering is passed down
 * from the Server Component (page.tsx) as children or props.
 */

import { useState } from "react";
import AddClientModal from "./AddClientModal";

interface ClientsPageClientProps {
  children: React.ReactNode;
}

export default function ClientsPageClient({ children }: ClientsPageClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {/* Inject the open-modal trigger via CSS class + data attribute */}
      {/* We render children, but need to intercept the button click.   */}
      {/* The cleanest approach: render the button here and pass the    */}
      {/* "Add client" header section separately.                       */}

      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <h1
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: 32,
            fontWeight: 700,
            color: "#1A1A1A",
            letterSpacing: "-0.01em",
            lineHeight: 1.2,
          }}
        >
          Clients{" "}
          <span style={{ fontWeight: 300, color: "#C0BEBB" }}>overview</span>
        </h1>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] transition-opacity hover:opacity-80"
          style={{
            backgroundColor: "#FFDE28",
            borderRadius: 10,
            fontFamily: "var(--font-inter), sans-serif",
          }}
        >
          + Add client
        </button>
      </div>

      {/* Page content (client list / empty state) */}
      {children}

      {/* Modal */}
      <AddClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
