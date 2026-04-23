import { Link, useParams } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  topicsInUnit,
  unitLabel,
  allTopics,
  type KbTopic,
} from "@/lib/kb-loader";
import { Frame, Chip, Eyebrow, MasteryBar, Button, MiniLabel, ProgressBar, StatCard, KeyIdea } from "@/components/notebook";
import { db, type MasteryLevel } from "@/lib/db";
import { Play } from "lucide-react";
import { StubPage } from "./_stub";

export function ModulePage() {
  const { moduleId } = useParams({ strict: false }) as { moduleId: string };
  const topics = topicsInUnit(moduleId);
  const mastery = useLiveQuery(() => db.mastery.toArray()) ?? [];

  if (topics.length === 0) {
    return (
      <StubPage
        title={moduleId}
        description="No topics in this unit yet. Check the slug or run `bun kb` to refresh."
        eyebrow="module"
      />
    );
  }

  const mLookup = new Map(mastery.map((m) => [m.topicSlug, m.level]));
  const covered = topics.filter((t) => (mLookup.get(t.slug) ?? 0) > 0).length;
  const mastered = topics.filter((t) => (mLookup.get(t.slug) ?? 0) >= 4).length;
  const weakest = [...topics]
    .sort((a, b) => (mLookup.get(a.slug) ?? 0) - (mLookup.get(b.slug) ?? 0))
    .slice(0, 3);
  const nextUp =
    topics.find((t) => (mLookup.get(t.slug) ?? 0) === 0) ??
    topics.find((t) => (mLookup.get(t.slug) ?? 0) < 4) ??
    topics[0];

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0, 1fr) 320px" }}>
      <div className="flex min-w-0 flex-col gap-6">
        <Frame className="p-8!">
          <Eyebrow>module {moduleId} · {topics.length} lessons</Eyebrow>
          <h1 className="mt-2">{unitLabel(moduleId)}</h1>
          <p className="serif mt-3 max-w-[64ch] text-(--ink-2) italic">
            Start at the top, or jump to wherever feels right. Everything here chains back to something
            in "prereqs" on the topic page if you get lost.
          </p>

          <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <StatCard n={`${covered}/${topics.length}`} label="topics touched" />
            <StatCard n={mastered} label="near mastery" tone="mint" />
            <StatCard n={`${Math.round((covered / topics.length) * 100)}%`} label="coverage" tone="accent" />
            <StatCard n={weakest.length} label="weak spots flagged" />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link to="/learn/$" params={{ _splat: nextUp.slug }} className="btn-sk pop big">
              <Play size={18} /> Continue: {nextUp.title}
            </Link>
            <Link
              to="/learn/$"
              params={{ _splat: topics[0].slug }}
              className="btn-sk ghost"
            >
              Start from the top
            </Link>
            <Link
              to="/module/$moduleId/quiz"
              params={{ moduleId }}
              className="btn-sk ghost"
            >
              Chapter quiz →
            </Link>
            <MiniLabel>session auto-saves</MiniLabel>
          </div>
        </Frame>

        <Frame>
          <Eyebrow>lessons in order</Eyebrow>
          <h3 className="mt-2">Take them one at a time.</h3>
          <div className="mt-4 flex flex-col gap-3">
            {topics.map((t, i) => {
              const lv = (mLookup.get(t.slug) ?? 0) as MasteryLevel;
              const state = lv >= 4 ? "done" : lv > 0 || t.slug === nextUp.slug ? "now" : "";
              return (
                <Link
                  key={t.slug}
                  to="/learn/$"
                  params={{ _splat: t.slug }}
                  className={"lesson " + state + " no-underline"}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  <div className="n-circle">{String(i + 1).padStart(2, "0")}</div>
                  <div className="flex-1">
                    <div className="display text-[22px] leading-none">{t.title}</div>
                    <div className="mini-label mt-1 flex gap-3">
                      {t.complexity?.worst && <span>worst: {t.complexity.worst}</span>}
                      {t.pseudocodes.length > 0 && <span>{t.pseudocodes.length} pseudocode block{t.pseudocodes.length > 1 ? "s" : ""}</span>}
                      {t.traceIds.length > 0 && <span>has trace</span>}
                    </div>
                  </div>
                  <MasteryBar level={lv} />
                  <Chip tone={state === "done" ? "mint" : state === "now" ? "hl" : "soft"}>
                    {state === "done" ? "done" : state === "now" ? "now" : "open"}
                  </Chip>
                </Link>
              );
            })}
          </div>
        </Frame>
      </div>

      <aside className="sticky top-4 flex flex-col gap-4 self-start">
        <Frame>
          <h3>Coming back</h3>
          <MiniLabel>weakest topics in this module</MiniLabel>
          <div className="mt-3">
            {weakest.map((t) => (
              <div key={t.slug} className="queue-row">
                <div>
                  <Link to="/learn/$" params={{ _splat: t.slug }} className="tt underline decoration-dashed">
                    {t.title}
                  </Link>
                  <div className="src">{unitLabel(t.unit)}</div>
                </div>
                <MasteryBar level={(mLookup.get(t.slug) ?? 0) as MasteryLevel} />
              </div>
            ))}
          </div>
        </Frame>

        <Frame>
          <h3>Key ideas, in a glance</h3>
          <div className="mt-2">
            {topics.slice(0, 3).map((t) =>
              t.hook ? <KeyIdea key={t.slug} title={t.title}>{t.hook}</KeyIdea> : null
            )}
          </div>
        </Frame>

        <Frame>
          <h3>Related modules</h3>
          <div className="mt-2 flex flex-col gap-1">
            {allModulesAround(moduleId).map((u) => (
              <Link key={u} to="/module/$moduleId" params={{ moduleId: u }} className="underline decoration-dashed">
                {unitLabel(u)}
              </Link>
            ))}
          </div>
        </Frame>
      </aside>
    </div>
  );
}

function allModulesAround(current: string): string[] {
  const units = [...new Set(allTopics().map((t: KbTopic) => t.unit))].sort();
  return units.filter((u) => u !== current);
}
