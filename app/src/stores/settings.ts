import { create } from "zustand";
import { db, getSetting, setSetting } from "@/lib/db";

type Theme = "light" | "dark" | "system";
export type FontTheme = "notebook" | "apple";

interface SettingsState {
  theme: Theme;
  fontTheme: FontTheme;
  ollamaEnabled: boolean;
  ollamaEndpoint: string;
  ollamaModel: string;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setTheme: (t: Theme) => Promise<void>;
  setFontTheme: (f: FontTheme) => Promise<void>;
  setOllama: (patch: Partial<Pick<SettingsState, "ollamaEnabled" | "ollamaEndpoint" | "ollamaModel">>) => Promise<void>;
  resetProgress: () => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  theme: "system",
  fontTheme: "notebook",
  ollamaEnabled: false,
  ollamaEndpoint: "http://localhost:11434",
  ollamaModel: "llama3.1:8b",
  hydrated: false,

  async hydrate() {
    const [theme, fontTheme, enabled, endpoint, model] = await Promise.all([
      getSetting<Theme>("theme", "system"),
      getSetting<FontTheme>("fontTheme", "notebook"),
      getSetting<boolean>("ollama.enabled", false),
      getSetting<string>("ollama.endpoint", "http://localhost:11434"),
      getSetting<string>("ollama.model", "llama3.1:8b"),
    ]);
    set({
      theme,
      fontTheme,
      ollamaEnabled: enabled,
      ollamaEndpoint: endpoint,
      ollamaModel: model,
      hydrated: true,
    });
    applyTheme(theme);
    applyFontTheme(fontTheme);
  },

  async setTheme(t) {
    await setSetting("theme", t);
    set({ theme: t });
    applyTheme(t);
  },

  async setFontTheme(f) {
    await setSetting("fontTheme", f);
    set({ fontTheme: f });
    applyFontTheme(f);
  },

  async setOllama(patch) {
    const next = { ...get(), ...patch };
    await Promise.all([
      patch.ollamaEnabled !== undefined ? setSetting("ollama.enabled", patch.ollamaEnabled) : null,
      patch.ollamaEndpoint !== undefined ? setSetting("ollama.endpoint", patch.ollamaEndpoint) : null,
      patch.ollamaModel !== undefined ? setSetting("ollama.model", patch.ollamaModel) : null,
    ]);
    set({
      ollamaEnabled: next.ollamaEnabled,
      ollamaEndpoint: next.ollamaEndpoint,
      ollamaModel: next.ollamaModel,
    });
  },

  async resetProgress() {
    await db.transaction(
      "rw",
      [db.mastery, db.srs, db.sessions, db.feynman, db.flagged],
      async () => {
        await Promise.all([
          db.mastery.clear(),
          db.srs.clear(),
          db.sessions.clear(),
          db.feynman.clear(),
          db.flagged.clear(),
        ]);
      }
    );
  },
}));

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved =
    theme === "system"
      ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
  root.classList.toggle("dark", resolved === "dark");
}

function applyFontTheme(fontTheme: FontTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("font-apple", fontTheme === "apple");
}
