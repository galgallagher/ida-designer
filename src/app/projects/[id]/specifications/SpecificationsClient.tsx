"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Maximize2, Search, Package, X, Eye, EyeOff, ChevronDown, ChevronRight } from "lucide-react";
import { assignSpecToCode, createSpecCode, deleteSpecCode, unassignCode, updateSpecCode } from "./actions";
import SpecDetailModal from "@/app/specs/SpecDetailModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SlotSpec {
  id: string;
  name: string;
  image_url: string | null;
  code: string | null;
}

interface Slot {
  id: string;
  code: string;
  sequence: number;
  quantity: number;
  price: number | null;
  budget: number | null;
  notes: string | null;
  category_id: string;
  spec: SlotSpec | null;
}

interface Category {
  id: string;
  name: string;
  abbreviation: string | null;
  parent_id: string | null;
}

interface LibrarySpec {
  id: string;
  name: string;
  image_url: string | null;
  code: string | null;
  category_id: string | null;
}

interface Props {
  projectId: string;
  projectName: string;
  currency: string;
  slots: Slot[];
  categories: Category[];
  librarySpecs: LibrarySpec[];
  optionSpecIds: string[];
}

export default function SpecificationsClient({ projectId, projectName, currency, slots, categories, librarySpecs, optionSpecIds }: Props) {
  const [isPending, startTransition] = useTransition();
  const [addCategoryId, setAddCategoryId] = useState<string>("");
  const [openSpecId, setOpenSpecId] = useState<string | null>(null);
  const [notesEditor, setNotesEditor] = useState<{ slotId: string; code: string; value: string } | null>(null);
  const [picker, setPicker] = useState<{ slotId: string; categoryId: string; code: string } | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerTab, setPickerTab] = useState<"options" | "library">("options");
  const optionSpecIdSet = useMemo(() => new Set(optionSpecIds), [optionSpecIds]);
  const [unassignDialog, setUnassignDialog] = useState<{
    slotId: string;
    code: string;
    specName: string;
    flags: { quantity: boolean; price: boolean; budget: boolean; notes: boolean };
  } | null>(null);
  const [showBudget, setShowBudget] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const collapsedKey = `specs:collapsed:${projectId}`;

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("specs:showBudget") : null;
    if (stored !== null) setShowBudget(stored === "1");
    const storedCollapsed = typeof window !== "undefined" ? window.localStorage.getItem(collapsedKey) : null;
    if (storedCollapsed) {
      try {
        const ids = JSON.parse(storedCollapsed) as string[];
        setCollapsed(new Set(ids));
      } catch {}
    }
  }, [collapsedKey]);

  function toggleCollapsed(catId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(collapsedKey, JSON.stringify([...next]));
      }
      return next;
    });
  }

  function toggleBudget() {
    setShowBudget((v) => {
      const next = !v;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("specs:showBudget", next ? "1" : "0");
      }
      return next;
    });
  }

  const categoryById = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  // Group slots by category, preserving the category order from the categories list.
  const groups = useMemo(() => {
    const byCat = new Map<string, Slot[]>();
    slots.forEach((s) => {
      const list = byCat.get(s.category_id) ?? [];
      list.push(s);
      byCat.set(s.category_id, list);
    });
    return Array.from(byCat.entries()).map(([catId, list]) => ({
      category: categoryById.get(catId) ?? null,
      slots: list.sort((a, b) => a.sequence - b.sequence),
    }));
  }, [slots, categoryById]);

  function handleAddSlot(categoryId: string) {
    if (!categoryId) return;
    startTransition(async () => {
      const { error } = await createSpecCode(projectId, categoryId);
      if (error) alert(error);
    });
  }

  function handleDelete(slotId: string) {
    if (!confirm("Delete this code? Drawings referencing it will lose their link.")) return;
    startTransition(async () => {
      const { error } = await deleteSpecCode(slotId, projectId);
      if (error) alert(error);
    });
  }

  function handleQuantityBlur(slotId: string, raw: string) {
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty < 0) return;
    startTransition(async () => {
      await updateSpecCode(slotId, projectId, { quantity: qty });
    });
  }

  // Build category descendants map (catId → set of catId + descendants).
  const descendantsByRoot = useMemo(() => {
    const childrenByParent = new Map<string, string[]>();
    categories.forEach((c) => {
      if (c.parent_id) {
        const list = childrenByParent.get(c.parent_id) ?? [];
        list.push(c.id);
        childrenByParent.set(c.parent_id, list);
      }
    });
    const out = new Map<string, Set<string>>();
    categories.forEach((c) => {
      const acc = new Set<string>([c.id]);
      const stack = [c.id];
      while (stack.length) {
        const next = stack.pop()!;
        const kids = childrenByParent.get(next) ?? [];
        for (const k of kids) {
          if (!acc.has(k)) {
            acc.add(k);
            stack.push(k);
          }
        }
      }
      out.set(c.id, acc);
    });
    return out;
  }, [categories]);

  function openPicker(slot: Slot) {
    setPicker({ slotId: slot.id, categoryId: slot.category_id, code: slot.code });
    setPickerSearch("");
    setPickerTab(optionSpecIds.length > 0 ? "options" : "library");
  }

  function handleAssign(specId: string) {
    if (!picker) return;
    const slotId = picker.slotId;
    setPicker(null);
    startTransition(async () => {
      const { error } = await assignSpecToCode(slotId, projectId, specId);
      if (error) alert(error);
    });
  }

  function openUnassignDialog(slot: Slot) {
    if (!slot.spec) return;
    setUnassignDialog({
      slotId: slot.id,
      code: slot.code,
      specName: slot.spec.name,
      flags: { quantity: false, price: false, budget: false, notes: false },
    });
  }

  function handleUnassignConfirmed() {
    if (!unassignDialog) return;
    const { slotId, flags } = unassignDialog;
    setUnassignDialog(null);
    startTransition(async () => {
      const { error } = await unassignCode(slotId, projectId, flags);
      if (error) alert(error);
    });
  }

  function toggleUnassignFlag(key: "quantity" | "price" | "budget" | "notes") {
    setUnassignDialog((prev) =>
      prev ? { ...prev, flags: { ...prev.flags, [key]: !prev.flags[key] } } : prev,
    );
  }

  const pickerEligibleSpecs = useMemo(() => {
    if (!picker) return [];
    const allowed = descendantsByRoot.get(picker.categoryId) ?? new Set([picker.categoryId]);
    const q = pickerSearch.toLowerCase().trim();
    return librarySpecs
      .filter((s) => s.category_id && allowed.has(s.category_id))
      .filter((s) => {
        if (pickerTab === "options" && !optionSpecIdSet.has(s.id)) return false;
        if (q && !s.name.toLowerCase().includes(q)) return false;
        return true;
      });
  }, [picker, descendantsByRoot, pickerSearch, pickerTab, librarySpecs, optionSpecIdSet]);

  function handleNotesBlur(slotId: string, raw: string) {
    const notes = raw.trim() === "" ? null : raw;
    startTransition(async () => {
      await updateSpecCode(slotId, projectId, { notes });
    });
  }

  function handleSaveNotesModal() {
    if (!notesEditor) return;
    const { slotId, value } = notesEditor;
    setNotesEditor(null);
    handleNotesBlur(slotId, value);
  }

  function handlePriceBlur(slotId: string, raw: string) {
    const price = raw.trim() === "" ? null : Number(raw);
    if (price !== null && (!Number.isFinite(price) || price < 0)) return;
    startTransition(async () => {
      await updateSpecCode(slotId, projectId, { price });
    });
  }

  function handleBudgetBlur(slotId: string, raw: string) {
    const budget = raw.trim() === "" ? null : Number(raw);
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) return;
    startTransition(async () => {
      await updateSpecCode(slotId, projectId, { budget });
    });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h1 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 28, fontWeight: 700, color: "#1A1A1A" }}>
          Specifications
        </h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleBudget}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:bg-black/[0.04]"
            style={{
              background: "none",
              border: "1px solid #E4E1DC",
              borderRadius: 8,
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: 12,
              color: "#1A1A1A",
              cursor: "pointer",
            }}
            title={showBudget ? "Hide budget column" : "Show budget column"}
          >
            {showBudget ? <Eye size={13} /> : <EyeOff size={13} />}
            Budget
          </button>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            {projectName}
          </p>
        </div>
      </div>
      <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", marginBottom: 24 }}>
        The committed schedule. Each row is a code (e.g. FB1) that drawings can reference.
        Codes can be empty until you assign a spec.
      </p>

      {/* Add code bar */}
      <div
        className="flex items-center gap-2 mb-6 p-3"
        style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC", boxShadow: "0 2px 12px rgba(26,26,26,0.04)" }}
      >
        <select
          value={addCategoryId}
          onChange={(e) => setAddCategoryId(e.target.value)}
          className="flex-1 px-3 py-2"
          style={{ borderRadius: 8, border: "1px solid #E4E1DC", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A", backgroundColor: "#FFFFFF" }}
        >
          <option value="">Choose a category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.abbreviation ? ` (${c.abbreviation})` : ""}
            </option>
          ))}
        </select>
        <button
          onClick={() => handleAddSlot(addCategoryId)}
          disabled={!addCategoryId || isPending}
          className="flex items-center gap-1.5 px-4 py-2 transition-opacity disabled:opacity-40"
          style={{ backgroundColor: "#FFDE28", color: "#1A1A1A", borderRadius: 8, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 600 }}
        >
          <Plus size={14} />
          Add code
        </button>
      </div>

      {/* Empty state */}
      {groups.length === 0 && (
        <div
          className="flex flex-col items-center justify-center text-center py-16"
          style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC" }}
        >
          <p style={{ fontFamily: "var(--font-playfair), serif", fontSize: 18, color: "#1A1A1A", marginBottom: 6 }}>
            No specifications yet
          </p>
          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}>
            Pick a category above and add your first code, or add from Project Options.
          </p>
        </div>
      )}

      {/* Groups */}
      {groups.map(({ category, slots: groupSlots }) => {
        const catKey = category?.id ?? "unknown";
        const isCollapsed = collapsed.has(catKey);
        return (
        <section key={catKey} className="mb-8">
          <button
            type="button"
            onClick={() => toggleCollapsed(catKey)}
            className="flex items-center gap-2 mb-3 w-full text-left transition-opacity hover:opacity-80"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            {isCollapsed
              ? <ChevronRight size={18} style={{ color: "#9A9590" }} />
              : <ChevronDown size={18} style={{ color: "#9A9590" }} />}
            <h2 style={{ fontFamily: "var(--font-playfair), serif", fontSize: 18, fontWeight: 700, color: "#1A1A1A" }}>
              {category?.name ?? "Unknown category"}
            </h2>
            {category?.abbreviation && (
              <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, fontWeight: 600, color: "#9A9590", backgroundColor: "#E4E1DC", padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em" }}>
                {category.abbreviation}
              </span>
            )}
            <span style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 12, color: "#9A9590" }}>
              · {groupSlots.length} {groupSlots.length === 1 ? "code" : "codes"}
            </span>
          </button>

          {!isCollapsed && (
          <div
            style={{ backgroundColor: "#FFFFFF", borderRadius: 14, border: "1px solid #E4E1DC", overflow: "hidden", boxShadow: "0 2px 12px rgba(26,26,26,0.04)" }}
          >
            <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", fontFamily: "var(--font-inter), sans-serif", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #E4E1DC", backgroundColor: "#F8F7F5" }}>
                  <Th width={90}>Code</Th>
                  <Th>Assigned spec</Th>
                  <Th align="right" width={90}>Qty</Th>
                  {showBudget && <Th align="right" width={120}>Budget</Th>}
                  <Th align="right" width={120}>Price</Th>
                  <Th align="right" width={120}>Total</Th>
                  <Th width={280}>Notes</Th>
                  <Th width={48}></Th>
                </tr>
              </thead>
              <tbody>
                {/* slots */}
                {groupSlots.map((slot) => (
                  <tr key={slot.id} style={{ borderBottom: "1px solid #F0EEEB", verticalAlign: "middle" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1A1A1A" }}>{slot.code}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {slot.spec ? (
                        <div className="flex items-center gap-2 group/spec">
                          <button
                            type="button"
                            onClick={() => slot.spec && setOpenSpecId(slot.spec.id)}
                            className="flex items-center gap-2 text-left transition-opacity hover:opacity-70"
                            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                            title="View spec details"
                          >
                            {slot.spec.image_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={slot.spec.image_url}
                                alt=""
                                style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                              />
                            )}
                            <span style={{ color: "#1A1A1A" }}>{slot.spec.name}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openUnassignDialog(slot)}
                            disabled={isPending}
                            className="p-1 transition-opacity opacity-0 group-hover/spec:opacity-100 hover:bg-black/5 rounded"
                            title="Clear assignment"
                            style={{ color: "#9A9590" }}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openPicker(slot)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 transition-colors hover:bg-black/[0.04]"
                          style={{
                            background: "none",
                            border: "1px dashed #C0BEBB",
                            borderRadius: 6,
                            fontFamily: "var(--font-inter), sans-serif",
                            fontSize: 12,
                            color: "#9A9590",
                            cursor: "pointer",
                          }}
                        >
                          <Plus size={12} />
                          Assign spec
                        </button>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <input
                        type="number"
                        defaultValue={slot.quantity}
                        min={0}
                        step="0.01"
                        onBlur={(e) => handleQuantityBlur(slot.id, e.target.value)}
                        className="text-right px-2 py-1"
                        style={{ width: 70, borderRadius: 6, border: "1px solid #E4E1DC", fontFamily: "var(--font-inter), sans-serif", fontSize: 13 }}
                      />
                    </td>
                    {showBudget && (
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <input
                          type="number"
                          defaultValue={slot.budget ?? ""}
                          min={0}
                          step="0.01"
                          placeholder="—"
                          onBlur={(e) => handleBudgetBlur(slot.id, e.target.value)}
                          className="text-right px-2 py-1"
                          style={{ width: 100, borderRadius: 6, border: "1px solid #E4E1DC", fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590" }}
                        />
                      </td>
                    )}
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <input
                        type="number"
                        defaultValue={slot.price ?? ""}
                        min={0}
                        step="0.01"
                        placeholder="—"
                        onBlur={(e) => handlePriceBlur(slot.id, e.target.value)}
                        className="text-right px-2 py-1"
                        style={{ width: 100, borderRadius: 6, border: "1px solid #E4E1DC", fontFamily: "var(--font-inter), sans-serif", fontSize: 13 }}
                      />
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#1A1A1A", fontWeight: 600 }}>
                      {(() => {
                        const unit = slot.price ?? slot.budget;
                        if (unit === null) {
                          return <span style={{ color: "#C0BEBB", fontWeight: 400 }}>—</span>;
                        }
                        const isBudgeted = slot.price === null;
                        return (
                          <span className="inline-flex items-center gap-1.5">
                            <span style={{ color: isBudgeted ? "#9A9590" : "#1A1A1A", fontWeight: isBudgeted ? 500 : 600 }}>
                              {formatCurrency(slot.quantity * unit, currency)}
                            </span>
                            {isBudgeted && (
                              <span
                                title="Budgeted figure — no actual price set yet"
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  color: "#9A9590",
                                  backgroundColor: "#F0EEEB",
                                  border: "1px solid #E4E1DC",
                                  borderRadius: 3,
                                  padding: "1px 4px",
                                  letterSpacing: "0.06em",
                                  textTransform: "uppercase",
                                }}
                              >
                                Budget
                              </span>
                            )}
                          </span>
                        );
                      })()}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      <div className="relative">
                        <textarea
                          key={`${slot.id}-${slot.notes ?? ""}`}
                          defaultValue={slot.notes ?? ""}
                          rows={2}
                          placeholder="Add notes…"
                          onBlur={(e) => {
                            if ((e.target.value || "") === (slot.notes ?? "")) return;
                            handleNotesBlur(slot.id, e.target.value);
                          }}
                          className="w-full resize-y px-2 py-1.5 pr-7"
                          style={{
                            borderRadius: 6,
                            border: "1px solid #E4E1DC",
                            fontFamily: "var(--font-inter), sans-serif",
                            fontSize: 12,
                            color: "#1A1A1A",
                            lineHeight: 1.4,
                            minHeight: 44,
                            backgroundColor: "#FFFFFF",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setNotesEditor({ slotId: slot.id, code: slot.code, value: slot.notes ?? "" })
                          }
                          className="absolute top-1.5 right-1.5 p-1 rounded transition-colors hover:bg-black/[0.06]"
                          title="Expand notes"
                          style={{ color: "#9A9590", background: "rgba(255,255,255,0.85)", lineHeight: 0 }}
                        >
                          <Maximize2 size={11} />
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <button
                        onClick={() => handleDelete(slot.id)}
                        disabled={isPending}
                        className="p-1.5 transition-colors hover:bg-black/5 rounded-md"
                        title="Delete code"
                        style={{ color: "#9A9590" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
                {/* inline add-slot row */}
                {category && (
                  <tr>
                    <td colSpan={showBudget ? 8 : 7} style={{ padding: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleAddSlot(category.id)}
                        disabled={isPending}
                        className="flex items-center justify-center gap-1.5 w-full py-2.5 transition-colors hover:bg-black/[0.03]"
                        style={{
                          background: "none",
                          border: "none",
                          borderTop: "1px dashed #E4E1DC",
                          cursor: isPending ? "default" : "pointer",
                          fontFamily: "var(--font-inter), sans-serif",
                          fontSize: 12,
                          fontWeight: 500,
                          color: "#9A9590",
                        }}
                      >
                        <Plus size={13} />
                        Add {category.abbreviation ?? category.name} code
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </section>
        );
      })}

      {openSpecId && (
        <SpecDetailModal specId={openSpecId} onClose={() => setOpenSpecId(null)} />
      )}

      <Dialog
        open={!!picker}
        onOpenChange={(open) => { if (!open) setPicker(null); }}
      >
        <DialogContent style={{ maxWidth: 560 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-playfair), serif" }}>
              Assign spec to code {picker?.code}
            </DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 mb-3" style={{ borderBottom: "1px solid #E4E1DC" }}>
            <PickerTab
              active={pickerTab === "options"}
              onClick={() => setPickerTab("options")}
              label="Project Options"
            />
            <PickerTab
              active={pickerTab === "library"}
              onClick={() => setPickerTab("library")}
              label="Studio Library"
            />
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search
              size={14}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9A9590" }}
            />
            <input
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search by name…"
              className="w-full pl-8 pr-3 py-2"
              style={{
                borderRadius: 8,
                border: "1px solid #E4E1DC",
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 13,
                color: "#1A1A1A",
                backgroundColor: "#FFFFFF",
              }}
            />
          </div>

          {/* Results */}
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {pickerEligibleSpecs.length === 0 ? (
              <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#9A9590", padding: "24px 8px", textAlign: "center" }}>
                {pickerTab === "options"
                  ? "No matching specs in this project's options. Try the Studio Library tab."
                  : "No matching specs in your studio library for this category."}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {pickerEligibleSpecs.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => handleAssign(s.id)}
                      className="flex items-center gap-3 w-full px-2 py-2 transition-colors hover:bg-black/[0.04] text-left"
                      style={{
                        background: "none",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          backgroundColor: "#F0EEEB",
                          backgroundImage: s.image_url ? `url(${s.image_url})` : undefined,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {!s.image_url && <Package size={16} style={{ color: "#D4D2CF" }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 13, fontWeight: 500, color: "#1A1A1A", lineHeight: 1.3 }}>
                          {s.name}
                        </p>
                        {s.code && (
                          <p style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: 11, color: "#9A9590", marginTop: 1 }}>
                            {s.code}
                          </p>
                        )}
                      </div>
                      {pickerTab === "library" && !optionSpecIdSet.has(s.id) && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: "#9A9590",
                            backgroundColor: "#E4E1DC",
                            borderRadius: 4,
                            padding: "2px 6px",
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            flexShrink: 0,
                          }}
                          title="Will be added to Project Options"
                        >
                          Library
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!notesEditor}
        onOpenChange={(open) => { if (!open) setNotesEditor(null); }}
      >
        <DialogContent style={{ maxWidth: 640 }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "var(--font-playfair), serif" }}>
              Notes — {notesEditor?.code}
            </DialogTitle>
          </DialogHeader>
          <textarea
            value={notesEditor?.value ?? ""}
            onChange={(e) =>
              setNotesEditor((prev) => (prev ? { ...prev, value: e.target.value } : prev))
            }
            rows={14}
            placeholder="Anything the studio or supplier needs to know about this code — finishes, supplier instructions, install notes…"
            className="w-full resize-y px-3 py-2"
            style={{
              borderRadius: 8,
              border: "1px solid #E4E1DC",
              fontFamily: "var(--font-inter), sans-serif",
              fontSize: 13,
              color: "#1A1A1A",
              lineHeight: 1.5,
              minHeight: 240,
              backgroundColor: "#FFFFFF",
            }}
          />
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={() => setNotesEditor(null)}
              className="px-4 py-2 transition-colors hover:bg-black/[0.05]"
              style={{
                borderRadius: 8,
                background: "none",
                border: "1px solid #E4E1DC",
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 13,
                color: "#1A1A1A",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveNotesModal}
              className="px-4 py-2 transition-opacity hover:opacity-80"
              style={{
                borderRadius: 8,
                backgroundColor: "#FFDE28",
                border: "none",
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 13,
                fontWeight: 600,
                color: "#1A1A1A",
              }}
            >
              Save notes
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!unassignDialog}
        onOpenChange={(open) => { if (!open) setUnassignDialog(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ fontFamily: "var(--font-playfair), serif" }}>
              Unassign {unassignDialog?.specName} from {unassignDialog?.code}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The code stays in place so drawings remain linked. Tick any fields you also want to clear.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <UnassignCheckbox
              checked={!!unassignDialog?.flags.quantity}
              onChange={() => toggleUnassignFlag("quantity")}
              label="Reset quantity to 1"
            />
            <UnassignCheckbox
              checked={!!unassignDialog?.flags.budget}
              onChange={() => toggleUnassignFlag("budget")}
              label="Clear budget"
            />
            <UnassignCheckbox
              checked={!!unassignDialog?.flags.price}
              onChange={() => toggleUnassignFlag("price")}
              label="Clear price"
            />
            <UnassignCheckbox
              checked={!!unassignDialog?.flags.notes}
              onChange={() => toggleUnassignFlag("notes")}
              label="Clear notes"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnassignConfirmed}>
              Unassign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UnassignCheckbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label
      className="flex items-center gap-2 cursor-pointer select-none px-2 py-1.5 transition-colors hover:bg-black/[0.03]"
      style={{ borderRadius: 6, fontFamily: "var(--font-inter), sans-serif", fontSize: 13, color: "#1A1A1A" }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ width: 14, height: 14, cursor: "pointer", accentColor: "#1A1A1A" }}
      />
      {label}
    </label>
  );
}

function PickerTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 transition-colors"
      style={{
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid #1A1A1A" : "2px solid transparent",
        marginBottom: -1,
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        color: active ? "#1A1A1A" : "#9A9590",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function formatCurrency(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function Th({ children, align = "left", width }: { children?: React.ReactNode; align?: "left" | "right"; width?: number }) {
  return (
    <th
      style={{
        padding: "10px 14px",
        textAlign: align,
        width,
        fontFamily: "var(--font-inter), sans-serif",
        fontSize: 11,
        fontWeight: 600,
        color: "#9A9590",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </th>
  );
}
