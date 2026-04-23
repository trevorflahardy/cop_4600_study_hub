import { Link } from "@tanstack/react-router";
import { Frame, MasteryBar, Chip, MiniLabel } from "@/components/notebook";
import { allTopics, allUnits, topicsInUnit, unitLabel } from "@/lib/kb-loader";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { ChevronRight } from "lucide-react";

/** V3: Full bird's-eye syllabus. One unit per group, topics as rows. */
export function SyllabusView() {
  const mastery = useLiveQuery(() => db.mastery.toArray()) ?? [];
  const mLookup = new Map(mastery.map((m) => [m.topicSlug, m.level]));

  const units = allUnits();

  const overallProgress = (() => {
    const total = allTopics().length;
    const covered = mastery.filter((m) => m.level > 0).length;
    return total ? covered / total : 0;
  })();

  return (
    <div className="flex flex-col gap-6">
      <Frame>
        <div className="eyebrow">birds-eye · {allTopics().length} topics · {units.length} units</div>
        <h2 className="mt-2">Your whole semester, on one page.</h2>
        <p className="serif mt-2 max-w-[64ch] text-(--ink-2) italic">
          Every topic you need for the cumulative final, grouped the way the lectures ran. Status
          dots show where you are. Click any row to jump in.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Chip tone="pop">{(overallProgress * 100).toFixed(0)}% touched</Chip>
          <Chip tone="mint">{mastery.filter((m) => m.level >= 4).length} near-mastery</Chip>
          <Chip tone="amber">{allTopics().length - mastery.filter((m) => m.level > 0).length} untouched</Chip>
        </div>
      </Frame>

      <div className="grid gap-4">
        {units.map((u) => {
          const unitTopics = topicsInUnit(u);
          const covered = unitTopics.filter((t) => (mLookup.get(t.slug) ?? 0) > 0).length;
          return (
            <Frame key={u}>
              <div className="mb-3 flex items-baseline justify-between">
                <div>
                  <div className="eyebrow">{u}</div>
                  <h3 className="mt-1">{unitLabel(u)}</h3>
                </div>
                <MiniLabel>{covered}/{unitTopics.length} touched</MiniLabel>
              </div>
              <div className="flex flex-col">
                {unitTopics.map((t, i) => {
                  const lv = (mLookup.get(t.slug) ?? 0) as 0 | 1 | 2 | 3 | 4 | 5;
                  return (
                    <Link
                      key={t.slug}
                      to="/algorithms/$"
                      params={{ _splat: t.slug }}
                      className="flex items-center gap-3 py-3 no-underline"
                      style={{
                        borderBottom: i < unitTopics.length - 1 ? "1px dashed var(--rule)" : "none",
                        color: "inherit",
                      }}
                    >
                      <span className="mono w-6 text-[10px] text-(--ink-3)">{String(i + 1).padStart(2, "0")}</span>
                      <span className="display flex-1 text-[20px] leading-none">{t.title}</span>
                      <MasteryBar level={lv} />
                      <ChevronRight size={16} className="text-(--ink-3)" />
                    </Link>
                  );
                })}
              </div>
            </Frame>
          );
        })}
      </div>
    </div>
  );
}
