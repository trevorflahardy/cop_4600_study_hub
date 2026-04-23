import { useParams, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  topicsInUnit,
  quizzesFor,
  unitLabel,
  allUnits,
  type KbQuizQuestion,
} from "@/lib/kb-loader";
import {
  Frame,
  Chip,
  Eyebrow,
  MiniLabel,
  Button,
  StatCard,
  KeyIdea,
} from "@/components/notebook";
import { QuizRunner } from "@/features/practice/QuizRunner";
import { StubPage } from "./_stub";
import { AlertTriangle, ArrowRight, Trophy } from "lucide-react";

type Length = "quick" | "medium" | "full";

const TARGETS: Record<Length, number> = {
  quick: 5,
  medium: 10,
  full: 9999, // effectively all
};

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build a balanced set pulling at least one question per topic in the module
 * before padding out. Prefers a mix of difficulties.
 */
function buildChapterSet(
  topicSlugs: string[],
  length: Length
): KbQuizQuestion[] {
  const perTopic = topicSlugs.map((s) => shuffle(quizzesFor(s)));
  const target = TARGETS[length];
  const out: KbQuizQuestion[] = [];

  // Round-robin to ensure every topic is represented early.
  let i = 0;
  while (out.length < target) {
    let placed = false;
    for (const bucket of perTopic) {
      if (bucket[i]) {
        out.push(bucket[i]);
        placed = true;
        if (out.length >= target) break;
      }
    }
    if (!placed) break;
    i++;
  }

  // Prefer MCQ-first ordering with short-answer questions sprinkled at the end.
  out.sort((a, b) => {
    if (a.kind === b.kind) return 0;
    if (a.kind === "mcq") return -1;
    if (b.kind === "mcq") return 1;
    return 0;
  });

  return out;
}

export function ChapterQuizPage() {
  const { moduleId } = useParams({ strict: false }) as { moduleId: string };
  const topics = topicsInUnit(moduleId);

  const allQs = useMemo(() => {
    const arr: KbQuizQuestion[] = [];
    for (const t of topics) arr.push(...quizzesFor(t.slug));
    return arr;
  }, [moduleId]);

  const [length, setLength] = useState<Length>("medium");
  const [started, setStarted] = useState(false);
  const [runId, setRunId] = useState(0);
  const [stats, setStats] = useState<{ correct: number; incorrect: number } | null>(
    null
  );

  const questions = useMemo(
    () => buildChapterSet(topics.map((t) => t.slug), length),
    [topics, length, runId]
  );

  if (topics.length === 0) {
    return (
      <StubPage
        title={moduleId}
        description="No topics in this unit yet — can't build a chapter quiz."
        eyebrow="chapter quiz"
      />
    );
  }

  if (allQs.length === 0) {
    return (
      <StubPage
        title={`${unitLabel(moduleId)} · chapter quiz`}
        description="No quiz questions authored for this module yet. Add some to src/data/quizzes.json (or run bun kb) and come back."
        eyebrow="chapter quiz · empty"
      />
    );
  }

  const units = allUnits();
  const myIndex = units.indexOf(moduleId);
  const nextModule = units[myIndex + 1];

  // --- Start screen ---
  if (!started) {
    return (
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
        <Frame className="p-8!">
          <Eyebrow>chapter quiz · {unitLabel(moduleId)}</Eyebrow>
          <h1 className="mt-2">
            Let's see if {unitLabel(moduleId)} actually stuck.
          </h1>
          <p className="serif mt-3 max-w-[66ch] text-(--ink-2) italic">
            A mixed set of questions drawn from every topic in this module. Unlike
            per-topic quizzes, the ordering and prompts won't match any one lesson — that's
            the point. If you forget which algorithm the question is about, you've hit a gap.
          </p>

          <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <StatCard n={topics.length} label="topics in module" />
            <StatCard n={allQs.length} label="questions in bank" />
            <StatCard
              n={allQs.filter((q) => q.kind === "mcq").length}
              label="multiple choice"
            />
            <StatCard
              n={allQs.filter((q) => q.kind !== "mcq").length}
              label="short / scenario"
            />
          </div>

          <div className="mt-6">
            <MiniLabel>pick a length</MiniLabel>
            <div className="mt-2 flex flex-wrap gap-3">
              {(["quick", "medium", "full"] as Length[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLength(l)}
                  className="chip"
                  style={{
                    border: length === l ? "2px solid var(--ink)" : "1.5px solid var(--ink-2)",
                    background: length === l ? "var(--hl-2)" : "var(--paper-2)",
                    padding: "8px 16px",
                    cursor: "pointer",
                    fontWeight: length === l ? 700 : 500,
                  }}
                >
                  {l === "quick" && "Quick · 5 Q"}
                  {l === "medium" && "Medium · ~10 Q"}
                  {l === "full" && `Full · ${allQs.length} Q`}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="pop" size="big" onClick={() => setStarted(true)}>
              Start chapter quiz <ArrowRight size={16} />
            </Button>
            <Link
              to="/module/$moduleId"
              params={{ moduleId }}
              className="btn-sk ghost"
            >
              ← Back to module
            </Link>
          </div>
        </Frame>

        <Frame>
          <Eyebrow>topics covered</Eyebrow>
          <div className="mt-3 flex flex-col gap-2">
            {topics.map((t) => {
              const count = quizzesFor(t.slug).length;
              return (
                <div
                  key={t.slug}
                  className="flex items-center gap-3 px-3 py-2"
                  style={{ borderBottom: "1px dashed var(--rule)" }}
                >
                  <Link
                    to="/learn/$"
                    params={{ _splat: t.slug }}
                    className="serif text-[15px] underline decoration-dashed"
                  >
                    {t.title}
                  </Link>
                  <span className="flex-1" />
                  <Chip tone={count === 0 ? "amber" : "soft"}>
                    {count === 0 && <AlertTriangle size={12} />} {count} Q
                  </Chip>
                </div>
              );
            })}
          </div>
        </Frame>
      </div>
    );
  }

  // --- Done screen ---
  if (stats) {
    const total = stats.correct + stats.incorrect;
    const pct = total === 0 ? 0 : stats.correct / total;
    const passed = pct >= 0.7;

    return (
      <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
        <Frame className="p-8!">
          <Eyebrow>chapter quiz · done</Eyebrow>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Trophy size={36} />
            <h1>
              {stats.correct} of {total} ({Math.round(pct * 100)}%)
            </h1>
          </div>

          <div
            className="mt-4 p-4"
            style={{
              border: "2px solid var(--ink)",
              borderRadius: 10,
              background: passed ? "var(--hl-2)" : "color-mix(in oklch, var(--wrong) 10%, var(--paper))",
            }}
          >
            <strong>{passed ? "Solid — this module is in your bones." : "Below 70% — worth another pass."}</strong>
            <p className="serif mt-2 text-[14px] text-(--ink-2)">
              {passed
                ? `Consider spaced review via the review queue over the next few days, or roll into ${
                    nextModule ? unitLabel(nextModule) : "exam prep"
                  }.`
                : "The review queue will surface the weakest topics first. Going back through the stepper on weak topics is also a solid move."}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {!passed && (
              <Button
                variant="pop"
                size="big"
                onClick={() => {
                  setStats(null);
                  setStarted(false);
                }}
              >
                Another pass →
              </Button>
            )}
            <Link to="/review" className="btn-sk pop">
              Go to review queue
            </Link>
            {nextModule && passed && (
              <Link
                to="/module/$moduleId"
                params={{ moduleId: nextModule }}
                className="btn-sk pop"
              >
                Next module: {unitLabel(nextModule)} <ArrowRight size={14} />
              </Link>
            )}
            <Link
              to="/module/$moduleId"
              params={{ moduleId }}
              className="btn-sk ghost"
            >
              Back to module
            </Link>
            <Button
              variant="ghost"
              onClick={() => {
                setStats(null);
                setStarted(false);
                setRunId((n) => n + 1);
              }}
            >
              Retake (new questions)
            </Button>
          </div>
        </Frame>
      </div>
    );
  }

  // --- Running the quiz ---
  return (
    <div className="mx-auto w-full max-w-[900px]">
      <QuizRunner
        questions={questions}
        onComplete={(s) => setStats(s)}
        banner={
          <Frame>
            <div className="flex flex-wrap items-center gap-3">
              <Eyebrow>chapter quiz · {unitLabel(moduleId)}</Eyebrow>
              <span className="flex-1" />
              <Chip tone="sky">{questions.length} Q</Chip>
              <MiniLabel>mixed topics</MiniLabel>
            </div>
            <p className="serif mt-2 text-[13px] text-(--ink-2) italic">
              Take your time. Mastery for each topic updates as you answer.
            </p>
          </Frame>
        }
      />
    </div>
  );
}

