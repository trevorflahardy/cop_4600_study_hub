import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { allQuizzes, allTopics, getTopic, unitLabel } from "@/lib/kb-loader";
import { QuizRunner } from "@/features/practice/QuizRunner";
import { ReviewBanner, Frame, Button, MiniLabel, MasteryBar, Chip } from "@/components/notebook";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export function ReviewPage() {
  const mastery = useLiveQuery(() => db.mastery.toArray()) ?? [];
  const navigate = useNavigate();

  const questions = useMemo(() => {
    const byTopic = new Map(mastery.map((m) => [m.topicSlug, m.level]));
    // Prefer questions from weak topics (level 1-3); skip mastered & fresh for this run.
    const all = allQuizzes();
    const scored = all
      .map((q) => ({ q, lv: byTopic.get(q.topicSlug) ?? 0 }))
      .filter((x) => x.lv >= 1 && x.lv <= 3)
      .sort((a, b) => a.lv - b.lv)
      .slice(0, 8)
      .map((x) => x.q);
    // If user hasn't touched anything yet, seed with a few fresh questions.
    if (scored.length === 0) return all.slice(0, 5);
    return scored;
  }, [mastery]);

  const weakTopics = useMemo(() => {
    const byTopic = new Map(mastery.map((m) => [m.topicSlug, m.level]));
    return allTopics()
      .map((t) => ({ t, lv: byTopic.get(t.slug) ?? 0 }))
      .filter((x) => x.lv >= 1 && x.lv <= 3)
      .sort((a, b) => a.lv - b.lv)
      .slice(0, 5);
  }, [mastery]);

  const sourceLabel =
    questions.length === 0
      ? "no due items"
      : (() => {
          const topics = [...new Set(questions.map((q) => q.topicSlug))];
          const first = getTopic(topics[0]);
          return `${unitLabel(first?.unit ?? "")} · ${first?.title ?? ""}${topics.length > 1 ? " +more" : ""}`;
        })();

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0, 1fr) 280px" }}>
      <QuizRunner
        questions={questions}
        onComplete={() => navigate({ to: "/debrief" })}
        banner={
          <ReviewBanner
            source={sourceLabel}
            actions={<Button variant="ghost">why am I seeing this?</Button>}
          >
            You haven't re-locked these in yet. Get them right twice in a row — spaced out over the
            next week — and they move into "mastered."
          </ReviewBanner>
        }
      />

      <aside className="flex flex-col gap-4 sticky top-4 self-start">
        <Frame>
          <h3>Up next in review</h3>
          <MiniLabel>weakest topics, based on mastery</MiniLabel>
          <div className="mt-3">
            {weakTopics.length === 0 ? (
              <p className="serif italic text-[var(--ink-2)]">Nothing due yet — great. Keep going.</p>
            ) : (
              weakTopics.map(({ t, lv }) => (
                <div key={t.slug} className="queue-row">
                  <div>
                    <div className="tt">{t.title}</div>
                    <div className="src">{unitLabel(t.unit)}</div>
                  </div>
                  <MasteryBar level={lv as 0 | 1 | 2 | 3 | 4 | 5} />
                </div>
              ))
            )}
          </div>
        </Frame>

        <Frame>
          <h3>How spacing works</h3>
          <p className="serif italic text-[var(--ink-2)] mt-2 text-[13px] leading-relaxed">
            We default to 2357 — a topic comes back at days 1, 3, 7, and 14 after you first see it.
            Once mastery ≥ 4 and you've passed review twice, the card retires.
          </p>
          <div className="mt-3 flex gap-2">
            <Chip tone="mint">day 1</Chip>
            <Chip tone="hl">day 3</Chip>
            <Chip tone="sky">day 7</Chip>
            <Chip tone="amber">day 14</Chip>
          </div>
        </Frame>
      </aside>
    </div>
  );
}
