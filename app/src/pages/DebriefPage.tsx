import { Link } from "@tanstack/react-router";
import { Frame, Eyebrow, Highlighter, StatCard, Button, Chip, MasteryBar, MiniLabel } from "@/components/notebook";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { allTopics, unitLabel, getTopic } from "@/lib/kb-loader";

export function DebriefPage() {
  const sessions = useLiveQuery(() => db.sessions.toArray()) ?? [];
  const mastery = useLiveQuery(() => db.mastery.toArray()) ?? [];
  const flagged = useLiveQuery(() => db.flagged.toArray()) ?? [];

  const active = sessions.find((s) => s.id === "__active-session__" && !s.endedAt);
  const latest = sessions.filter((s) => s.endedAt).sort((a, b) => b.endedAt! - a.endedAt!)[0];
  const sess = active ?? latest;

  const correct = sess?.correct ?? 0;
  const incorrect = sess?.incorrect ?? 0;
  const total = correct + incorrect;

  const recentMastery = [...mastery]
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 4);

  const weakest = [...allTopics()]
    .map((t) => ({ t, lv: mastery.find((m) => m.topicSlug === t.slug)?.level ?? 0 }))
    .filter((x) => x.lv >= 1 && x.lv <= 3)
    .sort((a, b) => a.lv - b.lv)[0];

  return (
    <div className="flex flex-col gap-6">
      <Frame className="!p-8">
        <Eyebrow>session debrief · complete</Eyebrow>
        <h1 className="mt-2">Good session. Here's <Highlighter>what moved.</Highlighter></h1>
        <p className="serif italic text-[var(--ink-2)] mt-3 max-w-[64ch]">
          No scores, no streaks — just movement. Mastery shifts for topics you touched, and a concrete
          plan for what comes back.
        </p>
      </Frame>

      <div className="stats-grid">
        <StatCard n={total} label="questions answered" tone="accent" foot={total ? `${correct}/${total} correct` : "none yet"} />
        <StatCard n={correct} label="right" tone="mint" foot="these count toward mastery" />
        <StatCard n={recentMastery.filter((m) => m.correctStreak >= 1).length} label="topics trending up" />
        <StatCard n={flagged.length} label="flagged for tighter loop" />
      </div>

      <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Frame>
          <h3>What moved</h3>
          <MiniLabel>mastery ladder shifts from this session</MiniLabel>
          <div className="mt-3 flex flex-col gap-3">
            {recentMastery.length === 0 ? (
              <p className="serif italic text-[var(--ink-2)]">Nothing yet — do a practice or review round to see movement.</p>
            ) : (
              recentMastery.map((m) => {
                const t = getTopic(m.topicSlug);
                return (
                  <div key={m.topicSlug} className="flex items-center gap-3 py-2 border-b border-dashed" style={{ borderColor: "var(--rule)" }}>
                    <div className="flex-1">
                      <div className="display text-lg leading-none">{t?.title ?? m.topicSlug}</div>
                      <div className="mini-label mt-1">{unitLabel(t?.unit ?? "")} · streak {m.correctStreak}</div>
                    </div>
                    <MasteryBar level={m.level} gain={m.correctStreak > 0} />
                  </div>
                );
              })
            )}
          </div>
        </Frame>

        <Frame>
          <h3>Worth reflecting on</h3>
          <MiniLabel>optional · 30 seconds · stays with you</MiniLabel>
          <textarea
            className="workspace mt-3"
            rows={5}
            placeholder="what clicked? what didn't?"
          />
          <div className="mt-3 flex gap-2 flex-wrap">
            <Chip tone="hl">case 2 finally clicks</Chip>
            <Chip tone="amber">struggled: unrolling</Chip>
            <Chip tone="soft">want a second pass</Chip>
          </div>

          {weakest && (
            <div className="mt-5">
              <h4>The weak spot, explicitly</h4>
              <p className="serif italic mt-2">
                <strong>{weakest.t.title}</strong> is sitting at mastery {weakest.lv}/5.{" "}
                We'll schedule a 3-question booster for your next session.
              </p>
              <Link
                to="/learn/$"
                params={{ _splat: weakest.t.slug }}
                className="btn-sk pop mt-3 inline-flex"
              >
                Go learn {weakest.t.title} →
              </Link>
            </div>
          )}
        </Frame>
      </div>

      <Frame>
        <h3>What happens next · your personalized plan</h3>
        <MiniLabel>you don't have to do anything · this is queued up for next time</MiniLabel>
        <div className="mt-3 flex flex-col">
          {[
            { when: "next time", kind: "review", t: "3 questions on your weak spot", tone: "hl" as const },
            { when: "in 2 days", kind: "practice", t: "Fresh problems in this module", tone: "sky" as const },
            { when: "in ~5 days", kind: "review", t: "Spaced review across the whole unit", tone: "mint" as const },
          ].map((row, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-dashed last:border-0" style={{ borderColor: "var(--rule)" }}>
              <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-3)] w-24">{row.when}</span>
              <Chip tone={row.tone}>{row.kind}</Chip>
              <span className="flex-1 serif">{row.t}</span>
            </div>
          ))}
        </div>
      </Frame>

      <div className="flex gap-3 flex-wrap items-center">
        <Link to="/" className="btn-sk pop big">Done for the day</Link>
        <Link to="/review" className="btn-sk">Keep going — one more round</Link>
        <Link to="/map" className="btn-sk ghost">Back to the map</Link>
      </div>
    </div>
  );
}
