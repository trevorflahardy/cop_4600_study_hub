import Dexie, { type EntityTable } from "dexie";

/**
 * Local persistence layer — all user progress lives here.
 * No accounts, no cloud sync. Survives page reloads and app updates.
 */

export type MasteryLevel = 0 | 1 | 2 | 3 | 4 | 5;

export interface MasteryRow {
  topicSlug: string;          // e.g. "02-scheduling/fifo"
  level: MasteryLevel;
  correctStreak: number;
  lastReviewed: number | null;   // epoch ms
  nextReview: number | null;     // epoch ms
  updatedAt: number;
}

export interface SrsCard {
  id: string;                 // card UID (topicSlug + cardType + variant)
  topicSlug: string;
  cardType: string;           // "term2def", "def2term", "concept2example", etc.
  deck: "main" | "review";
  interval: number;           // days
  easeFactor: number;         // SM-2 default 2.5
  due: number;                // epoch ms
  lapses: number;
  correctStreak: number;
  lastRated: number | null;
  rating: number | null;      // 0..3 (again/hard/good/easy)
  createdAt: number;
}

export interface NoteRow {
  id: string;
  topicSlug: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionRow {
  id: string;
  startedAt: number;
  endedAt: number | null;
  plannedMinutes: number;
  topicsTouched: string[];
  correct: number;
  incorrect: number;
  masteryGained: number;
  flagged: string[];
}

export interface FeynmanRow {
  id: string;
  topicSlug: string;
  explanation: string;
  rubricScore: number;          // 0..1
  rubricBreakdown: Record<string, boolean>;
  llmFeedback: string | null;
  createdAt: number;
}

export interface FlaggedRow {
  topicSlug: string;
  reason: string;
  createdAt: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
  updatedAt: number;
}

export class StudyHubDB extends Dexie {
  mastery!: EntityTable<MasteryRow, "topicSlug">;
  srs!: EntityTable<SrsCard, "id">;
  notes!: EntityTable<NoteRow, "id">;
  sessions!: EntityTable<SessionRow, "id">;
  feynman!: EntityTable<FeynmanRow, "id">;
  flagged!: EntityTable<FlaggedRow, "topicSlug">;
  settings!: EntityTable<SettingRow, "key">;

  constructor() {
    super("cop4600-study-hub");

    this.version(1).stores({
      mastery: "topicSlug, level, nextReview, updatedAt",
      srs: "id, topicSlug, deck, due, createdAt",
      notes: "id, topicSlug, updatedAt",
      sessions: "id, startedAt, endedAt",
      feynman: "id, topicSlug, createdAt",
      flagged: "topicSlug, createdAt",
      settings: "key",
    });
  }
}

export const db = new StudyHubDB();

/** Small helper: read/write a typed setting. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return (row?.value as T) ?? fallback;
}
export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value, updatedAt: Date.now() });
}
