import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "motion/react";
import { db, type SrsCard } from "@/lib/db";
import { allFlashcards, allUnits, unitLabel, getTopic, type KbFlashcard } from "@/lib/kb-loader";
import { scheduleCard, newCard, type Rating } from "@/lib/srs";
import { Frame, Chip, Button, Eyebrow, MiniLabel, StatCard, PipRow, type PipState } from "@/components/notebook";
import { MarkdownBlock } from "@/components/content/MarkdownBlock";
import { RotateCcw, SkipForward } from "lucide-react";

const DAY_MS = 24 * 60 * 60 * 1000;

export function FlashcardsPage() {
  const cards = useMemo(() => allFlashcards(), []);
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const storedSrs = useLiveQuery(() => db.srs.toArray()) ?? [];
  const srsById = useMemo(() => new Map(storedSrs.map((s) => [s.id, s])), [storedSrs]);

  const [unitFilter, setUnitFilter] = useState<string | "any">("any");
  const [session, setSession] = useState<string[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [streak, setStreak] = useState(0);
  const [results, setResults] = useState<PipState[]>([]);

  const dueCards = useMemo(() => {
    const now = Date.now();
    return cards
      .map((c) => ({ card: c, srs: srsById.get(c.id) }))
      .filter(({ card, srs }) => {
        if (unitFilter !== "any" && !card.tags.includes(unitFilter)) return false;
        return !srs || srs.due <= now;
      })
      .slice(0, 50);
  }, [cards, srsById, unitFilter]);

  const stats = {
    total: cards.length,
    touched: storedSrs.length,
    due: dueCards.length,
    averageInterval: storedSrs.length
      ? Math.round(
          storedSrs.reduce((a, c) => a + c.interval, 0) / storedSrs.length
        )
      : 0,
  };

  const startSession = useCallback((limit = 10) => {
    setSession(dueCards.slice(0, limit).map((d) => d.card.id));
    setIdx(0);
    setFlipped(false);
    setStreak(0);
    setResults([]);
  }, [dueCards]);

  const rate = useCallback(async (rating: Rating) => {
    if (!session) return;
    const cardId = session[idx];
    const card = byId.get(cardId);
    if (!card) return;
    const current = (await db.srs.get(cardId)) ?? newCard(cardId, card.topicSlug, card.cardType);
    const next = scheduleCard(current, rating);
    await db.srs.put(next);
    setResults((r) => [...r, rating === 0 ? "wrong" : "done"]);
    setStreak((s) => (rating === 0 ? 0 : s + 1));
    setFlipped(false);
    if (idx + 1 < session.length) {
      setIdx(idx + 1);
    } else {
      setSession(null);
    }
  }, [session, idx, byId]);

  // Keyboard shortcuts — space flip, 1-4 rate
  useEffect(() => {
    if (!session) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); setFlipped((f) => !f); return; }
      if (!flipped) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 4) { e.preventDefault(); rate((n - 1) as Rating); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [session, flipped, rate]);

  if (session) {
    const card = byId.get(session[idx]);
    if (!card) return null;
    const topic = getTopic(card.topicSlug);
    const currentSrs = srsById.get(card.id);

    const pipStates: PipState[] = session.map((_, i) => {
      if (i < results.length) return results[i];
      if (i === idx) return "now";
      return "pending";
    });

    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-4 flex-wrap">
          <MiniLabel>card {idx + 1} of {session.length} · streak {streak}</MiniLabel>
          <PipRow states={pipStates} />
          <span className="flex-1" />
          <Chip tone="sky">{card.cardType}</Chip>
          <Chip tone="soft">{unitLabel(card.tags[0])}</Chip>
          {currentSrs && currentSrs.correctStreak > 0 && (
            <Chip tone="mint">interval {currentSrs.interval}d</Chip>
          )}
        </div>

        <motion.div
          key={card.id + String(flipped)}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.25 }}
        >
          <Frame
            className="!p-10 cursor-pointer"
            shadow="canvas"
            onClick={() => setFlipped((f) => !f)}
            style={{ minHeight: 320, background: flipped ? "var(--paper-2)" : "var(--paper)" }}
          >
            <Eyebrow>{flipped ? "back" : "front"} · click or space to flip</Eyebrow>
            <AnimatePresence mode="wait">
              <motion.div
                key={flipped ? "back" : "front"}
                initial={{ opacity: 0, rotateY: -15 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: 15 }}
                transition={{ duration: 0.15 }}
              >
                <MarkdownBlock
                  source={flipped ? card.back : card.front}
                  className="mt-4 serif text-[18px] leading-relaxed max-w-[64ch]"
                />
                {flipped && topic?.hook && (
                  <div className="mt-6 pt-4 border-t border-dashed" style={{ borderColor: "var(--rule)" }}>
                    <MiniLabel>from the KB</MiniLabel>
                    <p className="serif italic mt-1 text-[var(--ink-2)] text-[14px]">{topic.hook}</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </Frame>
        </motion.div>

        {flipped ? (
          <div className="flex gap-2 flex-wrap">
            <Button variant="default" onClick={() => rate(0)}>1 · again</Button>
            <Button variant="default" onClick={() => rate(1)}>2 · hard</Button>
            <Button variant="primary" onClick={() => rate(2)}>3 · good</Button>
            <Button variant="pop" onClick={() => rate(3)}>4 · easy</Button>
            <span className="flex-1" />
            <Button variant="ghost" onClick={() => { setFlipped(false); rate(1); }}>
              <SkipForward size={14} /> skip for now
            </Button>
          </div>
        ) : (
          <div className="flex gap-2 items-center">
            <Button variant="pop" size="big" onClick={() => setFlipped(true)}>
              <RotateCcw size={16} /> Reveal the back
            </Button>
            <MiniLabel>or press <code className="code-block inline">space</code></MiniLabel>
          </div>
        )}

        <Frame padded={false} className="!p-4">
          <MiniLabel>related topic</MiniLabel>
          {topic && (
            <Link
              to="/learn/$"
              params={{ _splat: topic.slug }}
              className="display text-[18px] underline decoration-dashed mt-1 inline-block"
            >
              {topic.title}
            </Link>
          )}
        </Frame>
      </div>
    );
  }

  // Picker screen
  return (
    <div className="flex flex-col gap-6">
      <Frame className="!p-8">
        <Eyebrow>active recall deck</Eyebrow>
        <h1 className="mt-2">Flip, rate, stretch the interval.</h1>
        <p className="serif italic text-[var(--ink-2)] mt-3 max-w-[66ch]">
          Seven card types per topic — term ↔ def, code → name, complexity, a gotcha
          consequence, and a Feynman prompt. The 2357 scheduler stretches intervals as you
          get things right (day 1 → 3 → 7 → 14). Keyboard: <code className="code-block inline">space</code> flips,
          <code className="code-block inline">1-4</code> rate.
        </p>
      </Frame>

      <div className="stats-grid">
        <StatCard n={stats.total} label="cards in deck" />
        <StatCard n={stats.touched} label="cards reviewed" tone="accent" />
        <StatCard n={stats.due} label="due right now" tone="mint" />
        <StatCard n={stats.averageInterval + "d"} label="avg interval" />
      </div>

      <Frame>
        <Eyebrow>filter by unit</Eyebrow>
        <div className="mt-2 flex gap-2 flex-wrap">
          <button className={unitFilter === "any" ? "btn-sk primary" : "btn-sk ghost"} onClick={() => setUnitFilter("any")}>
            any
          </button>
          {allUnits().map((u) => (
            <button
              key={u}
              className={unitFilter === u ? "btn-sk primary" : "btn-sk ghost"}
              onClick={() => setUnitFilter(u)}
            >
              {unitLabel(u)}
            </button>
          ))}
        </div>
      </Frame>

      <div className="flex gap-3 items-center flex-wrap">
        <Button variant="pop" size="big" onClick={() => startSession(10)} disabled={dueCards.length === 0}>
          Start · {Math.min(10, dueCards.length)} cards
        </Button>
        <Button onClick={() => startSession(5)} disabled={dueCards.length === 0}>Just 5 more</Button>
        <Button variant="ghost" onClick={() => startSession(25)} disabled={dueCards.length === 0}>
          Big session · 25
        </Button>
        <MiniLabel>{dueCards.length === 0 ? "nothing due right now — come back later" : "space to flip · 1-4 to rate"}</MiniLabel>
      </div>
    </div>
  );
}
