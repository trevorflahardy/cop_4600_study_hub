import { useEffect } from "react";

export interface Shortcut {
  keys: string;
  label: string;
  action: () => void;
}

/**
 * Global keyboard handler — attaches once at the app shell level.
 * Keys are case-insensitive; chords are not yet supported.
 */
export function useGlobalShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      for (const s of shortcuts) {
        if (e.key.toLowerCase() === s.keys.toLowerCase()) {
          e.preventDefault();
          s.action();
          return;
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcuts]);
}
