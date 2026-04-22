import { db } from "./db";

export interface BackupBundle {
  version: 1;
  createdAt: string;
  mastery: unknown[];
  srs: unknown[];
  notes: unknown[];
  sessions: unknown[];
  feynman: unknown[];
  flagged: unknown[];
  settings: unknown[];
}

export async function exportBackup(): Promise<BackupBundle> {
  const [mastery, srs, notes, sessions, feynman, flagged, settings] = await Promise.all([
    db.mastery.toArray(),
    db.srs.toArray(),
    db.notes.toArray(),
    db.sessions.toArray(),
    db.feynman.toArray(),
    db.flagged.toArray(),
    db.settings.toArray(),
  ]);
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    mastery,
    srs,
    notes,
    sessions,
    feynman,
    flagged,
    settings,
  };
}

export async function importBackup(bundle: BackupBundle): Promise<void> {
  if (bundle.version !== 1) throw new Error("Unknown backup version: " + bundle.version);
  await db.transaction(
    "rw",
    [db.mastery, db.srs, db.notes, db.sessions, db.feynman, db.flagged, db.settings],
    async () => {
      await Promise.all([
        db.mastery.clear(),
        db.srs.clear(),
        db.notes.clear(),
        db.sessions.clear(),
        db.feynman.clear(),
        db.flagged.clear(),
        db.settings.clear(),
      ]);
      await Promise.all([
        db.mastery.bulkAdd(bundle.mastery as never),
        db.srs.bulkAdd(bundle.srs as never),
        db.notes.bulkAdd(bundle.notes as never),
        db.sessions.bulkAdd(bundle.sessions as never),
        db.feynman.bulkAdd(bundle.feynman as never),
        db.flagged.bulkAdd(bundle.flagged as never),
        db.settings.bulkAdd(bundle.settings as never),
      ]);
    }
  );
}

export function downloadBundle(bundle: BackupBundle): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cop4600-study-hub-" + bundle.createdAt.replace(/[:.]/g, "-") + ".json";
  a.click();
  URL.revokeObjectURL(url);
}
