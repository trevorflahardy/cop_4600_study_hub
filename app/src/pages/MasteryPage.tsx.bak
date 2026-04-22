import { Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { allTopics, allUnits, unitLabel, topicsInUnit } from "@/lib/kb-loader";
import { db, type MasteryLevel } from "@/lib/db";
import { Frame, Chip, Eyebrow, MasteryBar, MiniLabel, ProgressBar, StatCard, Highlighter } from "@/components/notebook";
import { masteryLabel } from "@/lib/mastery";

export function MasteryPage() {
  const mastery = useLiveQuery(() => db.mastery.toArray()) ?? [];
  const mLookup = new Map(mastery.map((m) => [m.topicSlug, m.level]));

  const totals = {
    all: allTopics().length,
    touched: mastery.filter((m) => m.level > 0).length,
    mastered: mastery.filter((m) => m.level >= 5).length,
    nearMastered: mastery.filter((m) => m.level >= 4).length,
  };

  const weakest = [...allTopics()]
    .map((t) => ({ t, lv: (mLookup.get(t.slug) ?? 0) as MasteryLevel }))
    .filter((x) => x.lv >= 1 && x.lv <= 3)
    .sort((a, b) => a.lv - b.lv)
    .slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <Frame className="!p-8">
        <Eyebrow>mastery · status across {totals.all} topics</Eyebrow>
        <h1 className="mt-2">Where you actually <Highlighter color="mint">stand</Highlighter>.</h1>
        <p className="serif italic text-[var(--ink-2)] mt-3 max-w-[66ch]">
          No scores. No streaks. Just a pip ladder per topic — 0 (fresh) through 5 (mastered). A topic
          reaches 4 after you explain it back; 5 after you pass review twice in a row.
        </p>

        <div className="mt-6 grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <StatCard n={`${totals.touched}/${totals.all}`} label="topics touched" />
          <StatCard n={totals.nearMastered} label="near mastery" tone="mint" />
          <StatCard n={totals.mastered} label="fully mastered" tone="accent" />
          <StatCard n={weakest.length} label="weak spots" foot={weakest.length ? "show below" : "nothing shaky"} />
        </div>

        <div className="mt-6">
          <MiniLabel>overall touched</MiniLabel>
          <ProgressBar value={totals.touched / Math.max(1, totals.all)} />
          <MiniLabel>near-mastery (≥ 4/5)</MiniLabel>
          <ProgressBar value={totals.nearMastered / Math.max(1, totals.all)} color="var(--hl)" />
        </div>
      </Frame>

      {weakest.length > 0 && (
        <Frame>
          <Eyebrow>weak spots</Eyebrow>
          <h3 className="mt-1">Start with these.</h3>
          <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {weakest.map(({ t, lv }) => (
              <Link
                key={t.slug}
                to="/learn/$"
                params={{ _splat: t.slug }}
                className="block no-underline"
                style={{ color: "inherit" }}
              >
                <Frame className="!p-5" shadow="card">
                  <div className="flex items-center gap-2">
                    <MasteryBar level={lv} />
                    <Chip tone={lv >= 3 ? "hl" : "amber"}>{masteryLabel(lv)}</Chip>
                  </div>
                  <h4 className="mt-2">{t.title}</h4>
                  <MiniLabel>{unitLabel(t.unit)}</MiniLabel>
                </Frame>
              </Link>
            ))}
          </div>
        </Frame>
      )}

      {allUnits().map((u) => {
        const topics = topicsInUnit(u);
        const covered = topics.filter((t) => (mLookup.get(t.slug) ?? 0) > 0).length;
        return (
          <Frame key={u}>
            <div className="flex justify-between items-baseline mb-2">
              <div>
                <Eyebrow>{u}</Eyebrow>
                <h3 className="mt-1">{unitLabel(u)}</h3>
              </div>
              <MiniLabel>{covered}/{topics.length} touched</MiniLabel>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {topics.map((t) => {
                const lv = (mLookup.get(t.slug) ?? 0) as MasteryLevel;
                return (
                  <Link
                    key={t.slug}
                    to="/learn/$"
                    params={{ _splat: t.slug }}
                    className="flex items-center gap-2 py-2 px-3 rounded no-underline"
                    style={{
                      border: "1.5px solid var(--ink)",
                      background: lv >= 4 ? "var(--hl-2)" : lv > 0 ? "var(--hl)" : "var(--paper)",
                      color: "inherit",
                    }}
                  >
                    <span className="flex-1 serif text-[14px] leading-tight">{t.title}</span>
                    <MasteryBar level={lv} />
                  </Link>
                );
              })}
            </div>
          </Frame>
        );
      })}
    </div>
  );
}
