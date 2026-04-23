import { motion, AnimatePresence } from "motion/react";
import { Button, Chip, Eyebrow } from "@/components/notebook";
import { X } from "lucide-react";

interface ShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { k: string; label: string }[] = [
  { k: "h", label: "Home · Study hub" },
  { k: "m", label: "Concept map" },
  { k: "v", label: "Viz gallery" },
  { k: "c", label: "Flashcards" },
  { k: "q", label: "Self-quiz" },
  { k: "f", label: "Feynman workbench" },
  { k: "t", label: "Common exam traps" },
  { k: "r", label: "Spaced review" },
  { k: "g", label: "Mastery dashboard" },
  { k: "s", label: "Settings" },
  { k: "?", label: "Toggle this help" },
  { k: "d", label: "Toggle dark mode" },
];

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "var(--ink)", zIndex: 60 }}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            style={{
              position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
              background: "var(--paper)",
              border: "2px solid var(--ink)",
              borderRadius: 14,
              boxShadow: "8px 8px 0 rgba(0,0,0,0.15)",
              padding: 28,
              zIndex: 61,
              width: "min(520px, 92vw)",
            }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <Eyebrow>keyboard shortcuts</Eyebrow>
                <h2 className="mt-1">Go fast.</h2>
              </div>
              <Button variant="ghost" onClick={onClose}><X size={14} /></Button>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
              {SHORTCUTS.map((s) => (
                <div key={s.k} className="flex items-center gap-3">
                  <Chip tone="soft">{s.k}</Chip>
                  <span className="serif text-[13px]">{s.label}</span>
                </div>
              ))}
            </div>
            <p className="serif mt-4 text-[12px] text-(--ink-3) italic">
              Shortcuts are ignored while typing in text fields. Flashcards have their own keys (space/1-4).
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
