import { db, type MasteryLevel, type MasteryRow } from "./db";

/**
 * Mastery ladder (0-5):
 *   0 fresh — never seen
 *   1 seen — read the concept once
 *   2 recognized — passed a recognition quiz
 *   3 applied — solved a problem using it
 *   4 explained — passed a Feynman/short-answer test
 *   5 mastered — two spaced-correct-in-a-row at level ≥ 4
 */

export function nextLevel(lv: MasteryLevel): MasteryLevel {
  return (Math.min(5, lv + 1) as MasteryLevel);
}
export function prevLevel(lv: MasteryLevel): MasteryLevel {
  return (Math.max(0, lv - 1) as MasteryLevel);
}

export async function getMastery(slug: string): Promise<MasteryRow> {
  const row = await db.mastery.get(slug);
  return (
    row ?? {
      topicSlug: slug,
      level: 0 as MasteryLevel,
      correctStreak: 0,
      lastReviewed: null,
      nextReview: null,
      updatedAt: 0,
    }
  );
}

export async function recordAnswer(
  slug: string,
  outcome: "correct" | "incorrect" | "confident-wrong" | "park"
): Promise<MasteryRow> {
  const now = Date.now();
  const current = await getMastery(slug);
  let level: MasteryLevel = current.level;
  let correctStreak = current.correctStreak;

  switch (outcome) {
    case "correct":
      correctStreak += 1;
      if (correctStreak >= 2) level = nextLevel(level);
      break;
    case "incorrect":
      correctStreak = 0;
      level = prevLevel(level);
      break;
    case "confident-wrong":
      correctStreak = 0;
      level = prevLevel(prevLevel(level));
      break;
    case "park":
      // Hold level, reset streak. Re-surface sooner.
      correctStreak = 0;
      break;
  }

  const row: MasteryRow = {
    topicSlug: slug,
    level,
    correctStreak,
    lastReviewed: now,
    nextReview: null,
    updatedAt: now,
  };
  await db.mastery.put(row);
  return row;
}

export function masteryLabel(lv: MasteryLevel): string {
  return ["fresh", "seen", "recognized", "applied", "explained", "mastered"][lv];
}
