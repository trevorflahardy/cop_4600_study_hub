import { db, type SrsCard } from "./db";

/**
 * Spaced-repetition scheduler.
 *
 * Default policy: **2357** (review at day 1, 3, 7, 14) for simplicity and
 * predictability. Once a card has > 4 successful reviews we upgrade to SM-2
 * so the interval can stretch beyond 14 days based on performance.
 */

const TWO_THREE_FIVE_SEVEN = [1, 2, 4, 7]; // add to current interval → 1, 3, 7, 14
const DAY_MS = 24 * 60 * 60 * 1000;

export type Rating = 0 | 1 | 2 | 3; // again | hard | good | easy

export function scheduleCard(card: SrsCard, rating: Rating, now = Date.now()): SrsCard {
  // 2357 phase — simple, predictable
  if (card.correctStreak < TWO_THREE_FIVE_SEVEN.length) {
    if (rating === 0) {
      // again — reset streak, re-show tomorrow
      return {
        ...card,
        interval: 1,
        due: now + DAY_MS,
        correctStreak: 0,
        lapses: card.lapses + 1,
        lastRated: now,
        rating,
      };
    }
    const step = TWO_THREE_FIVE_SEVEN[Math.min(card.correctStreak, TWO_THREE_FIVE_SEVEN.length - 1)];
    const interval = Math.max(1, step);
    return {
      ...card,
      interval,
      due: now + interval * DAY_MS,
      correctStreak: card.correctStreak + 1,
      lastRated: now,
      rating,
    };
  }

  // SM-2 phase
  let { easeFactor, interval, correctStreak, lapses } = card;
  if (rating === 0) {
    interval = 1;
    correctStreak = 0;
    lapses += 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else {
    const quality = rating + 2; // 0→2, 1→3, 2→4, 3→5
    easeFactor = Math.max(
      1.3,
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );
    if (correctStreak === 0) interval = 1;
    else if (correctStreak === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);
    correctStreak += 1;
  }

  return {
    ...card,
    interval,
    easeFactor,
    correctStreak,
    lapses,
    due: now + interval * DAY_MS,
    lastRated: now,
    rating,
  };
}

export async function dueCards(deck: "main" | "review" = "main", limit = 50): Promise<SrsCard[]> {
  const now = Date.now();
  const all = await db.srs.where("deck").equals(deck).toArray();
  return all
    .filter((c) => c.due <= now)
    .sort((a, b) => a.due - b.due)
    .slice(0, limit);
}

export function newCard(id: string, topicSlug: string, cardType: string, deck: "main" | "review" = "main"): SrsCard {
  return {
    id,
    topicSlug,
    cardType,
    deck,
    interval: 0,
    easeFactor: 2.5,
    due: Date.now(),
    lapses: 0,
    correctStreak: 0,
    lastRated: null,
    rating: null,
    createdAt: Date.now(),
  };
}
