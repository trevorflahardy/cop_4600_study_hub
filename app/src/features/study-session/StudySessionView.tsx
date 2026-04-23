import { Link } from "@tanstack/react-router";
import { Chip, Eyebrow, Frame, Highlighter, MasteryBar, MiniLabel } from "@/components/notebook";
import { Play } from "lucide-react";
import { allTopics, unitLabel } from "@/lib/kb-loader";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

/** V1: Study session homepage hero. */
export function StudySessionView() {
  const topics = allTopics();
  const mastery = useLiveQuery(() => db.mastery.toArray()) ?? [];
  const mLookup = new Map(mastery.map((m) => [m.topicSlug, m.level]));

  // Pick three weakest topics for the "coming back" queue.
  const reviewQueue = [...topics]
    .sort((a, b) => (mLookup.get(a.slug) ?? 0) - (mLookup.get(b.slug) ?? 0))
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <Frame variant="wobble" shadow="card" className="p-8!">
        <div className="flex flex-wrap items-start gap-8">
          <div className="min-w-[340px] flex-1">
            <Eyebrow>Next session · ~45 min · sit somewhere quiet</Eyebrow>
            <h1 className="mt-3">
              Tonight you'll actually <Highlighter>understand</Highlighter> CFS scheduling
            </h1>
            <p className="serif mt-3 max-w-[58ch] text-(--ink-2) italic">
              We'll cold-open with the scheduling trace that burned you last time, unroll two
              worked examples, then hit you with a spaced review of CFS vruntime questions from
              module 02. Four steps, forty-five minutes, and a lower-stakes feeling than reading.
            </p>
          </div>

          <Frame variant="soft" padded={false} className="w-[280px] p-5!">
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <span className="display text-4xl">04</span>
                <span className="mini-label">steps today</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="display text-4xl">~45</span>
                <span className="mini-label">minutes budgeted</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="display text-4xl">3</span>
                <span className="mini-label">topics from earlier weeks</span>
              </div>
            </div>
          </Frame>
        </div>
      </Frame>

      <div className="session-arc">
        <div className="step done">
          <div className="dotnum">1</div>
          <div className="mono text-[10px] tracking-wider text-(--ink-3) uppercase">warm up · 3 min</div>
          <h4>Growth hierarchy recall</h4>
          <div className="mini-label">3 questions · done ✓</div>
        </div>
        <div className="step now">
          <div className="dotnum">2</div>
          <div className="mono text-[10px] tracking-wider uppercase" style={{ color: "var(--pop-ink)" }}>mini-lecture · ~12 min</div>
          <h4>CFS scheduling, vruntime & fairness</h4>
          <div className="mini-label">next up</div>
        </div>
        <div className="step">
          <div className="dotnum">3</div>
          <div className="mono text-[10px] tracking-wider text-(--ink-3) uppercase">practice · 5 Q</div>
          <h4>Classify these scheduling outcomes</h4>
          <div className="mini-label">~15 min</div>
        </div>
        <div className="step">
          <div className="dotnum">4</div>
          <div className="mono text-[10px] tracking-wider text-(--ink-3) uppercase">review · mixed</div>
          <h4>From module 02 · scheduling</h4>
          <div className="mini-label">~10 min</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/learn/$"
          params={{ _splat: reviewQueue[0]?.slug ?? "02-scheduling/fifo" }}
          className="btn-sk pop big"
        >
          <Play size={18} /> Continue learning
        </Link>
        <Link to="/map" className="btn-sk ghost">
          Open the map
        </Link>
        <MiniLabel>autosaves · pause anytime</MiniLabel>
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        <Frame>
          <h3>What you'll actually do</h3>
          <div className="mini-label mb-3">four steps, already laid out</div>

          {[
            { tag: "WATCH", title: "Mini-lecture on CFS vruntime", time: "~12 min", tone: "sky" as const },
            { tag: "SOLVE", title: "Five scheduling problems to trace", time: "~15 min", tone: "hl" as const },
            { tag: "MIX", title: "Interleaved with fairness-property review", time: "~10 min", tone: "mint" as const },
            { tag: "LOOP", title: "Wrap with a 30-second reflect", time: "~3 min", tone: "pop" as const },
          ].map((row, i, arr) => (
            <div
              key={row.tag}
              className="flex items-center gap-3 py-3"
              style={{ borderBottom: i < arr.length - 1 ? "1px dashed var(--rule)" : "none" }}
            >
              <div
                style={{
                  width: 40, height: 40,
                  border: "1.5px solid var(--ink)", borderRadius: 8,
                  background: "var(--paper-2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--ff-mono)", fontSize: 10, fontWeight: 600,
                  letterSpacing: "0.08em", flexShrink: 0,
                }}
              >
                {row.tag}
              </div>
              <div className="flex-1">
                <div className="display text-xl leading-none">{row.title}</div>
                <div className="mt-1 text-[13px] text-(--ink-2)">Scoped and timed so you don't wander.</div>
              </div>
              <Chip tone={row.tone}>{row.time}</Chip>
            </div>
          ))}
        </Frame>

        <Frame>
          <h3>Coming back to you</h3>
          <div className="mini-label mb-3">your personal spaced-review queue</div>

          {reviewQueue.map((t, i, arr) => {
            const lv = (mLookup.get(t.slug) ?? 0) as 0 | 1 | 2 | 3 | 4 | 5;
            return (
              <Link
                key={t.slug}
                to="/learn/$"
                params={{ _splat: t.slug }}
                className="flex items-center gap-3 py-3 no-underline"
                style={{ borderBottom: i < arr.length - 1 ? "1px dashed var(--rule)" : "none", color: "inherit" }}
              >
                <div
                  style={{
                    width: 36, height: 36,
                    border: "1.5px solid var(--ink)", borderRadius: 8,
                    background: "var(--paper-2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--ff-mono)", fontSize: 14, flexShrink: 0,
                  }}
                >
                  Q
                </div>
                <div className="flex-1">
                  <div className="display text-lg leading-none">{t.title}</div>
                  <div className="mini-label mt-1">{unitLabel(t.unit)} · not yet seen</div>
                </div>
                <MasteryBar level={lv} />
              </Link>
            );
          })}
        </Frame>
      </div>
    </div>
  );
}
