import { useParams, Link } from "@tanstack/react-router";
import { useMemo, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getTopic,
  topicsInUnit,
  unitLabel,
  quizzesFor,
  tracesFor,
  rubricFor,
  type KbSection,
  type KbQuizQuestion,
  type KbTopic,
} from "@/lib/kb-loader";
import { db, type MasteryLevel } from "@/lib/db";
import { recordAnswer } from "@/lib/mastery";
import { gradeWithRubric } from "@/lib/rubrics";
import {
  Frame,
  Chip,
  Eyebrow,
  MasteryBar,
  Button,
  MiniLabel,
  KeyIdea,
  ProgressBar,
  PipRow,
  type PipState,
} from "@/components/notebook";
import { MarkdownBlock } from "@/components/content/MarkdownBlock";
import { Pseudocode } from "@/components/content/Pseudocode";
import { ComplexityCard } from "@/components/content/ComplexityCard";
import { TracePlayer } from "@/components/content/TracePlayer";
import { vizFor } from "@/components/viz";
import { ExamQuestionsQuiz } from "@/features/practice/ExamQuestionsQuiz";
import { StubPage } from "./_stub";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  MessageSquare,
  Sparkles,
  XCircle,
} from "lucide-react";
import clsx from "clsx";

/* ----------------------------------------------------------------
 * Step plan — built once per topic. Each step fills one screen.
 * Principle: one section at a time, mandatory 2-Q check every 2
 * teach steps, short explain-back every ~3, big Feynman + full
 * topic quiz at the end.
 * ---------------------------------------------------------------- */

type Decoration = "plain" | "pseudocode" | "trace" | "viz" | "complexity" | "exam-quiz";

type TeachStep = {
  kind: "teach";
  section: KbSection;
  decoration: Decoration;
  number: number;
  total: number;
};

type Step =
  | { kind: "intro" }
  | TeachStep
  | { kind: "mini-quiz"; questions: KbQuizQuestion[]; label: string }
  | { kind: "mini-feynman"; prompt: string }
  | { kind: "topic-feynman" }
  | { kind: "topic-quiz"; questions: KbQuizQuestion[] }
  | { kind: "done" };

const CANONICAL_ORDER: RegExp[] = [
  /^definition$/i,
  /^when/i,
  /^pseudocode$/i,
  /^hand-trace|example/i,
  /^complexity/i,
  /^correctness|invariant/i,
  /^common exam questions|exam questions/i,
  /^gotcha|trap/i,
  /^notation/i,
];

const SKIP_IN_LEARN = [/^source/i, /^body$/i];

function orderedSections(topic: KbTopic): KbSection[] {
  const buckets: KbSection[][] = CANONICAL_ORDER.map(() => []);
  const rest: KbSection[] = [];
  for (const s of topic.sections) {
    if (SKIP_IN_LEARN.some((re) => re.test(s.heading))) continue;
    const idx = CANONICAL_ORDER.findIndex((re) => re.test(s.heading));
    if (idx >= 0) buckets[idx].push(s);
    else rest.push(s);
  }
  return [...buckets.flat(), ...rest];
}

function inferDecoration(section: KbSection, topic: KbTopic): Decoration {
  const h = section.heading.toLowerCase();
  if (/common exam questions|exam questions/.test(h)) return "exam-quiz";
  if (/pseudocode/.test(h) && topic.pseudocodes.length > 0) return "pseudocode";
  if (/hand-trace|example/.test(h) && tracesFor(topic.slug).length > 0) return "trace";
  if (/complexity/.test(h) && topic.complexity) return "complexity";
  if (/definition/.test(h) && vizFor(topic.slug)) return "viz";
  return "plain";
}

const SHORT_PROMPTS = [
  "In one sentence: what problem does this solve?",
  "Explain the mechanism to a classmate who missed the lecture.",
  "When would you choose a different approach?",
  "Re-state the invariant or key property in your own words.",
];

function buildSteps(topic: KbTopic): Step[] {
  const sections = orderedSections(topic);
  const allQuizzes = quizzesFor(topic.slug);
  const mcqs = allQuizzes.filter((q) => q.kind === "mcq");
  const nonMcqs = allQuizzes.filter((q) => q.kind !== "mcq");

  const steps: Step[] = [{ kind: "intro" }];
  const total = sections.length;

  let teachCount = 0;
  let mcqCursor = 0;
  let promptCursor = 0;
  let miniQuizNumber = 0;

  sections.forEach((section, idx) => {
    teachCount++;
    steps.push({
      kind: "teach",
      section,
      decoration: inferDecoration(section, topic),
      number: idx + 1,
      total,
    });

    const isLast = idx === sections.length - 1;

    // Mandatory check-in every 2 sections, but not right before the big finale.
    if (teachCount > 0 && teachCount % 2 === 0 && !isLast) {
      const picked = mcqs.slice(mcqCursor, mcqCursor + 2);
      if (picked.length === 2) {
        miniQuizNumber++;
        steps.push({
          kind: "mini-quiz",
          questions: picked,
          label: `Check-in ${miniQuizNumber}`,
        });
        mcqCursor += 2;
      }
    }

    // Short explain-back every ~3 sections.
    if (teachCount > 0 && teachCount % 3 === 0 && !isLast && promptCursor < SHORT_PROMPTS.length) {
      steps.push({ kind: "mini-feynman", prompt: SHORT_PROMPTS[promptCursor] });
      promptCursor++;
    }
  });

  // Big Feynman explain-back
  steps.push({ kind: "topic-feynman" });

  // Full topic quiz gets any remaining MCQ + all short/scenario questions.
  const remainingQs = [...mcqs.slice(mcqCursor), ...nonMcqs];
  if (remainingQs.length > 0) {
    steps.push({ kind: "topic-quiz", questions: remainingQs });
  }

  steps.push({ kind: "done" });
  return steps;
}

/* ----------------------------------------------------------------
 * The page itself
 * ---------------------------------------------------------------- */

export function LearnPage() {
  const params = useParams({ strict: false }) as { _splat?: string };
  const slug = params._splat ?? "";
  const topic = getTopic(slug);

  const masteryRow = useLiveQuery(() => db.mastery.get(slug), [slug]);

  // Per-step state — reset when topic changes
  const steps = useMemo(() => (topic ? buildSteps(topic) : []), [topic?.slug]);
  const [cursor, setCursor] = useState(0);

  if (!topic) {
    return (
      <StubPage
        title="Topic not found"
        description={`No KB entry at "${slug}". Check the slug or run bun kb.`}
        eyebrow="404 · learn"
      />
    );
  }

  const step = steps[cursor];
  const level = (masteryRow?.level ?? 0) as MasteryLevel;
  const progress = steps.length <= 1 ? 0 : cursor / (steps.length - 1);

  const back = () => setCursor((c) => Math.max(0, c - 1));
  const next = () => setCursor((c) => Math.min(steps.length - 1, c + 1));

  // Find the next topic in the same module for the "done" screen.
  const moduleTopics = topicsInUnit(topic.unit);
  const myIndex = moduleTopics.findIndex((t) => t.slug === topic.slug);
  const nextTopic = moduleTopics[myIndex + 1];
  const moduleComplete = myIndex >= 0 && myIndex === moduleTopics.length - 1;

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0, 1fr) 300px" }}>
      <div className="flex flex-col gap-6 min-w-0">
        <StepperHeader
          topic={topic}
          level={level}
          cursor={cursor}
          steps={steps}
          onJump={(i) => setCursor(i)}
        />

        <ProgressBar value={progress} />

        {step.kind === "intro" && (
          <IntroStep topic={topic} onBegin={next} />
        )}

        {step.kind === "teach" && (
          <TeachStepView
            step={step}
            topic={topic}
            onBack={back}
            onNext={next}
            canGoBack={cursor > 0}
          />
        )}

        {step.kind === "mini-quiz" && (
          <MiniQuizStep
            label={step.label}
            questions={step.questions}
            onBack={back}
            onComplete={next}
          />
        )}

        {step.kind === "mini-feynman" && (
          <MiniFeynmanStep
            prompt={step.prompt}
            onBack={back}
            onNext={next}
          />
        )}

        {step.kind === "topic-feynman" && (
          <TopicFeynmanStep
            topic={topic}
            onBack={back}
            onNext={next}
          />
        )}

        {step.kind === "topic-quiz" && (
          <MiniQuizStep
            label="Full topic quiz"
            questions={step.questions}
            onBack={back}
            onComplete={next}
            bigMode
          />
        )}

        {step.kind === "done" && (
          <DoneStep
            topic={topic}
            nextTopic={nextTopic}
            moduleComplete={moduleComplete}
            onRestart={() => setCursor(0)}
          />
        )}
      </div>

      <aside className="flex flex-col gap-4 sticky top-4 self-start">
        <Frame>
          <Eyebrow>you are here</Eyebrow>
          <h3 className="mt-1 leading-tight">{topic.title}</h3>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Chip tone="sky">{unitLabel(topic.unit)}</Chip>
            <MasteryBar level={level} />
          </div>
          {topic.complexity?.worst && (
            <div className="mt-3">
              <MiniLabel>worst case</MiniLabel>
              <div className="mono text-[13px]">{topic.complexity.worst}</div>
            </div>
          )}
        </Frame>

        <Frame>
          <Eyebrow>step map</Eyebrow>
          <div className="mt-2 flex flex-col gap-1 text-[12.5px]">
            {steps.map((s, i) => (
              <button
                key={i}
                onClick={() => setCursor(i)}
                className={clsx(
                  "text-left px-2 py-1 rounded transition-colors",
                  i === cursor && "bg-[var(--hl)]",
                  i < cursor && "text-[var(--ink-2)]"
                )}
                style={{ border: "1px dashed transparent" }}
              >
                <span className="mono text-[10px] mr-2 text-[var(--ink-3)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {labelForStep(s)}
              </button>
            ))}
          </div>
        </Frame>

        <Frame variant="dashed">
          <Eyebrow>need the whole thing?</Eyebrow>
          <p className="serif italic text-[13px] text-[var(--ink-2)] mt-2">
            Reading stepper too slow? Jump to the reference page with every section on one canvas.
          </p>
          <Link
            to="/algorithms/$"
            params={{ _splat: topic.slug }}
            className="btn-sk ghost mt-3 inline-flex"
          >
            Open reference view →
          </Link>
        </Frame>
      </aside>
    </div>
  );
}

/* ----------------------------------------------------------------
 * Sub-views
 * ---------------------------------------------------------------- */

function StepperHeader({
  topic,
  level,
  cursor,
  steps,
  onJump,
}: {
  topic: KbTopic;
  level: MasteryLevel;
  cursor: number;
  steps: Step[];
  onJump: (i: number) => void;
}) {
  const pips: PipState[] = steps.map((_, i) =>
    i < cursor ? "done" : i === cursor ? "now" : "pending"
  );

  return (
    <Frame>
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <Eyebrow>learning · {unitLabel(topic.unit)}</Eyebrow>
          <h2 className="mt-1 leading-tight">{topic.title}</h2>
        </div>
        <span className="flex-1" />
        <MasteryBar level={level} />
      </div>
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <MiniLabel>
          step {cursor + 1} of {steps.length}
        </MiniLabel>
        <PipRow states={pips.slice(0, Math.min(pips.length, 24))} />
        {cursor > 0 && (
          <Button variant="ghost" onClick={() => onJump(0)}>
            Restart
          </Button>
        )}
      </div>
    </Frame>
  );
}

function IntroStep({ topic, onBegin }: { topic: KbTopic; onBegin: () => void }) {
  return (
    <Frame className="!p-8">
      <Eyebrow>about to learn</Eyebrow>
      <h1 className="mt-2">{topic.title}</h1>
      {topic.hook && (
        <p className="serif italic text-[var(--ink-2)] mt-3 max-w-[70ch] text-[17px]">
          {topic.hook}
        </p>
      )}

      <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <KeyIdea title="How this page works">
          One concept per screen. Every couple of screens, a two-question check-in. You can't skip
          those — they're the whole point.
        </KeyIdea>
        <KeyIdea title="At the end">
          A short explain-back, then a full topic quiz, then the next topic or chapter quiz.
        </KeyIdea>
      </div>

      {topic.complexity && (
        <div className="mt-5">
          <ComplexityCard complexity={topic.complexity} />
        </div>
      )}

      {topic.warnings.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {topic.warnings.slice(0, 3).map((w, i) => (
            <Chip key={i} tone="amber">
              <AlertTriangle size={12} /> {w.length > 50 ? w.slice(0, 50) + "…" : w}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-6 flex gap-3 flex-wrap">
        <Button variant="pop" size="big" onClick={onBegin}>
          <BookOpen size={16} /> Begin
        </Button>
        <Link to="/map" className="btn-sk ghost">
          See the map
        </Link>
      </div>
    </Frame>
  );
}

function TeachStepView({
  step,
  topic,
  onBack,
  onNext,
  canGoBack,
}: {
  step: TeachStep;
  topic: KbTopic;
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
}) {
  const traces = tracesFor(topic.slug);
  const viz = vizFor(topic.slug);

  return (
    <Frame className="!p-8">
      <div className="flex items-center gap-3 flex-wrap">
        <Eyebrow>
          section {step.number} of {step.total} · {step.section.heading}
        </Eyebrow>
        <span className="flex-1" />
        <Chip tone="soft">{step.decoration}</Chip>
      </div>

      <h2 className="mt-2">{step.section.heading}</h2>

      {step.decoration === "exam-quiz" ? (
        <div className="mt-4 flex flex-col gap-4">
          <p className="serif italic text-[var(--ink-2)] max-w-[66ch]">
            Time to spar with the question bank for this topic. No penalty for wrong —
            correct answers nudge your mastery, missed ones just bank for later.
          </p>
          <ExamQuestionsQuiz topicSlug={topic.slug} topicTitle={topic.title} />
        </div>
      ) : (
        <div className="mt-4">
          <MarkdownBlock source={step.section.body} />
        </div>
      )}

      {step.decoration === "pseudocode" && topic.pseudocodes.length > 0 && (
        <div className="mt-5">
          <MiniLabel>pseudocode</MiniLabel>
          <div className="mt-1">
            <Pseudocode blocks={topic.pseudocodes} />
          </div>
        </div>
      )}

      {step.decoration === "trace" && traces.length > 0 && (
        <div className="mt-5">
          <KeyIdea title="Step through the trace">
            Move one row at a time. Watch which variables change.
          </KeyIdea>
          <div className="mt-3">
            <TracePlayer table={traces[0]} />
          </div>
        </div>
      )}

      {step.decoration === "complexity" && topic.complexity && (
        <div className="mt-5">
          <ComplexityCard complexity={topic.complexity} />
        </div>
      )}

      {step.decoration === "viz" && viz && (
        <div className="mt-5" style={{ border: "1.5px dashed var(--ink-2)", borderRadius: 10, padding: 16 }}>
          <Eyebrow>visualization · {viz.title}</Eyebrow>
          <p className="serif italic text-[13px] text-[var(--ink-2)] mt-1">{viz.description}</p>
          <div className="mt-3">{viz.render()}</div>
        </div>
      )}

      <div className="mt-6 flex gap-3 flex-wrap">
        {canGoBack && (
          <Button variant="ghost" onClick={onBack}>
            ← Back
          </Button>
        )}
        <Button variant="pop" size="big" onClick={onNext}>
          Got it · next <ArrowRight size={16} />
        </Button>
      </div>
    </Frame>
  );
}

function MiniQuizStep({
  label,
  questions,
  onBack,
  onComplete,
  bigMode = false,
}: {
  label: string;
  questions: KbQuizQuestion[];
  onBack: () => void;
  onComplete: () => void;
  bigMode?: boolean;
}) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<("right" | "wrong")[]>([]);
  const [confidence, setConfidence] = useState(50);
  const [shortText, setShortText] = useState("");
  const q = questions[i];

  const pips: PipState[] = questions.map((_, idx) => {
    if (idx < results.length) return results[idx] === "right" ? "done" : "wrong";
    if (idx === i) return "now";
    return "pending";
  });

  const submit = useCallback(async () => {
    if (!q) return;
    if (q.kind === "mcq" && picked !== null && q.choices) {
      const isRight = q.choices[picked].correct;
      setRevealed(true);
      const outcome: "correct" | "confident-wrong" | "incorrect" = isRight
        ? "correct"
        : confidence > 70
        ? "confident-wrong"
        : "incorrect";
      await recordAnswer(q.topicSlug, outcome);
    } else {
      setRevealed(true);
    }
  }, [q, picked, confidence]);

  const advance = useCallback(
    (result: "right" | "wrong") => {
      const next = [...results, result];
      setResults(next);
      setPicked(null);
      setRevealed(false);
      setConfidence(50);
      setShortText("");
      if (i + 1 >= questions.length) {
        onComplete();
        return;
      }
      setI(i + 1);
    },
    [i, questions.length, results, onComplete]
  );

  if (!q) {
    // No questions — just pass through.
    return (
      <Frame>
        <Eyebrow>{label}</Eyebrow>
        <p className="serif italic text-[var(--ink-2)] mt-2">
          No quiz questions available for this section yet. Moving on.
        </p>
        <Button variant="pop" className="mt-3" onClick={onComplete}>
          Continue →
        </Button>
      </Frame>
    );
  }

  const isRight =
    q.kind === "mcq" && q.choices && picked !== null && q.choices[picked].correct;

  return (
    <Frame className="!p-8">
      <div className="flex items-center gap-3 flex-wrap">
        <Eyebrow>
          {label} · {i + 1} of {questions.length}
        </Eyebrow>
        <span className="flex-1" />
        <PipRow states={pips} />
        <Chip tone={q.kind === "mcq" ? "sky" : "soft"}>{q.kind.toUpperCase()}</Chip>
      </div>

      <h2 className="mt-3">{q.prompt}</h2>
      <MiniLabel>mandatory · you must answer to move on</MiniLabel>

      {q.kind === "mcq" && q.choices && (
        <div className="m3-choices mt-5">
          {q.choices.map((c, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const picks = picked === idx;
            const cls = clsx(
              "m3-ch",
              picks && "picked",
              revealed && picks && (c.correct ? "right" : "wrong")
            );
            return (
              <button
                type="button"
                key={idx}
                className={cls}
                onClick={() => !revealed && setPicked(idx)}
                disabled={revealed}
              >
                <span className="letter">{letter}</span>
                <span>{c.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {q.kind !== "mcq" && (
        <textarea
          className="workspace mt-4"
          rows={bigMode ? 8 : 5}
          placeholder="your answer · free-form"
          value={shortText}
          onChange={(e) => setShortText(e.target.value)}
          disabled={revealed}
        />
      )}

      {q.kind === "mcq" && (
        <div className="mt-4">
          <MiniLabel>how confident?</MiniLabel>
          <input
            type="range"
            min={0}
            max={100}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            style={{ width: 240, marginTop: 6, accentColor: "var(--pop)" }}
            disabled={revealed}
          />
          <span className="mini-label ml-3">{confidence}%</span>
        </div>
      )}

      {!revealed ? (
        <div className="mt-6 flex gap-3 flex-wrap">
          {i === 0 && (
            <Button variant="ghost" onClick={onBack}>
              ← Back to lesson
            </Button>
          )}
          <Button
            variant="pop"
            size="big"
            onClick={submit}
            disabled={
              (q.kind === "mcq" && picked === null) ||
              (q.kind !== "mcq" && shortText.trim().length < 3)
            }
          >
            Submit
          </Button>
        </div>
      ) : (
        <div
          className="feedback-card mt-6"
          style={{
            background: isRight
              ? "var(--hl-2)"
              : "color-mix(in oklch, var(--wrong) 14%, var(--paper))",
          }}
        >
          <h4 className="flex items-center gap-2">
            {isRight ? (
              <>
                <CheckCircle2 size={18} /> Right — nicely done.
              </>
            ) : (
              <>
                <XCircle size={18} /> Not quite.
              </>
            )}
          </h4>
          <div className="why mt-2">
            {q.kind === "mcq" && q.choices && picked !== null ? (
              <>
                <p>
                  <strong>Why:</strong> {q.choices[picked].why || q.explanation}
                </p>
                {!isRight && (
                  <div className="mt-2 text-[13px]">
                    <strong>Correct answer: </strong>
                    {q.choices.find((c) => c.correct)?.text}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="serif text-[14px]">
                  <strong>Expected:</strong> {q.answer ?? q.explanation ?? "See the KB entry."}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => advance("right")}
                  >
                    I got it
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => advance("wrong")}
                  >
                    Needs work
                  </Button>
                </div>
              </>
            )}
          </div>
          {q.kind === "mcq" && (
            <div className="mt-4 flex gap-3 flex-wrap">
              <Button
                variant="pop"
                onClick={() => advance(isRight ? "right" : "wrong")}
              >
                {i + 1 >= questions.length ? "Finish check-in →" : "Next question →"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Frame>
  );
}

function MiniFeynmanStep({
  prompt,
  onBack,
  onNext,
}: {
  prompt: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const [text, setText] = useState("");
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const enough = wordCount >= 15;

  return (
    <Frame className="!p-8">
      <Eyebrow>
        <Sparkles size={12} className="inline mr-1" />
        quick explain-back
      </Eyebrow>
      <h2 className="mt-2">{prompt}</h2>
      <p className="serif italic text-[var(--ink-2)] mt-2 text-[14px]">
        No grade — just type it out. Writing forces the gap in your understanding to surface.
        One or two sentences is fine.
      </p>
      <textarea
        className="workspace mt-4"
        rows={5}
        placeholder="Type a short answer in your own words…"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <MiniLabel>{wordCount} words</MiniLabel>
        <span className="flex-1" />
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button variant="ghost" onClick={onNext}>
          Skip
        </Button>
        <Button variant="pop" onClick={onNext} disabled={!enough}>
          {enough ? "Looks good · continue" : `Need ~${Math.max(0, 15 - wordCount)} more words`}
        </Button>
      </div>
    </Frame>
  );
}

function TopicFeynmanStep({
  topic,
  onBack,
  onNext,
}: {
  topic: KbTopic;
  onBack: () => void;
  onNext: () => void;
}) {
  const [text, setText] = useState("");
  const [graded, setGraded] = useState(false);
  const rubric = rubricFor(topic.slug);
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  const score = graded ? gradeWithRubric(topic.slug, text) : null;

  const handleGrade = async () => {
    setGraded(true);
    const rubricScore = gradeWithRubric(topic.slug, text);
    await db.feynman.put({
      id: topic.slug + "-learn-" + Date.now(),
      topicSlug: topic.slug,
      explanation: text,
      rubricScore: rubricScore?.pct ?? 0,
      rubricBreakdown: Object.fromEntries(
        (rubricScore?.items ?? []).map((i) => [i.id, i.met])
      ),
      llmFeedback: null,
      createdAt: Date.now(),
    });
  };

  return (
    <Frame className="!p-8">
      <Eyebrow>
        <MessageSquare size={12} className="inline mr-1" />
        teach it back
      </Eyebrow>
      <h2 className="mt-2">
        Explain <em>{topic.title}</em> from scratch.
      </h2>
      <p className="serif italic text-[var(--ink-2)] mt-2 max-w-[66ch]">
        Pretend you're teaching a classmate who missed the lecture. Cover: the problem it solves,
        the mechanism, a small worked example, and why it's correct. If you want deep rubric-plus-LLM
        feedback, the dedicated Feynman workbench has that — here, we just want to lock in the big
        picture.
      </p>

      {rubric && (
        <div className="mt-4">
          <MiniLabel>aim for</MiniLabel>
          <ul className="mt-2 list-disc pl-5 text-[13px] serif text-[var(--ink-2)]">
            {rubric.items.map((it) => (
              <li key={it.id}>{it.prompt}</li>
            ))}
          </ul>
        </div>
      )}

      <textarea
        className="workspace mt-4"
        rows={10}
        placeholder={`Teach ${topic.title} in your own words.`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={graded}
      />
      <MiniLabel>{wordCount} words</MiniLabel>

      {score && (
        <div
          className="mt-4 p-4"
          style={{
            border: "1.5px solid var(--ink)",
            borderRadius: 10,
            background:
              score.pct >= 0.75
                ? "var(--hl-2)"
                : score.pct >= 0.5
                ? "var(--hl)"
                : "color-mix(in oklch, var(--wrong) 10%, var(--paper))",
          }}
        >
          <div className="flex items-center gap-2">
            <strong>{Math.round(score.pct * 100)}% of rubric hit</strong>
            <span className="flex-1" />
            {score.pct >= 0.75 ? (
              <Chip tone="mint">solid</Chip>
            ) : score.pct >= 0.5 ? (
              <Chip tone="hl">almost there</Chip>
            ) : (
              <Chip tone="amber">revise</Chip>
            )}
          </div>
          {score.gaps.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-[13px] serif text-[var(--ink-2)]">
              {score.gaps.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-3 flex-wrap">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        {!graded ? (
          <Button
            variant="pop"
            size="big"
            onClick={handleGrade}
            disabled={wordCount < 30}
          >
            {wordCount < 30 ? `Write ~${30 - wordCount} more words` : "Grade my explanation"}
          </Button>
        ) : (
          <>
            <Link
              to="/feynman"
              search={{ topic: topic.slug } as never}
              className="btn-sk ghost"
            >
              Deep-dive in Feynman workbench →
            </Link>
            <Button variant="pop" size="big" onClick={onNext}>
              On to the topic quiz <ArrowRight size={16} />
            </Button>
          </>
        )}
      </div>
    </Frame>
  );
}

function DoneStep({
  topic,
  nextTopic,
  moduleComplete,
  onRestart,
}: {
  topic: KbTopic;
  nextTopic: KbTopic | undefined;
  moduleComplete: boolean;
  onRestart: () => void;
}) {
  return (
    <Frame className="!p-8">
      <Eyebrow>done · for now</Eyebrow>
      <h1 className="mt-2">
        You walked through <em>{topic.title}</em>.
      </h1>
      <p className="serif italic text-[var(--ink-2)] mt-3 max-w-[66ch]">
        Mastery got a nudge where you answered correctly. Come back for spaced review
        before it fades — the review page keeps a queue of what's due.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {nextTopic && !moduleComplete && (
          <div
            className="p-4 flex items-center gap-3 flex-wrap"
            style={{
              border: "2px solid var(--ink)",
              borderRadius: 10,
              background: "var(--paper-2)",
            }}
          >
            <Sparkles size={18} />
            <div className="flex-1 min-w-[200px]">
              <MiniLabel>next up in {unitLabel(topic.unit)}</MiniLabel>
              <div className="display text-[20px] leading-tight">{nextTopic.title}</div>
            </div>
            <Link
              to="/learn/$"
              params={{ _splat: nextTopic.slug }}
              className="btn-sk pop"
            >
              Start <ArrowRight size={16} />
            </Link>
          </div>
        )}

        {moduleComplete && (
          <div
            className="p-4"
            style={{
              border: "2px solid var(--ink)",
              borderRadius: 10,
              background: "var(--hl-2)",
            }}
          >
            <MiniLabel>module complete</MiniLabel>
            <h3 className="mt-1">You finished every topic in {unitLabel(topic.unit)}.</h3>
            <p className="serif italic text-[var(--ink-2)] text-[14px] mt-1">
              Time for the chapter quiz — a mixed set that cuts across the whole module.
            </p>
            <Link
              to="/module/$moduleId/quiz"
              params={{ moduleId: topic.unit }}
              className="btn-sk pop big mt-3 inline-flex"
            >
              Take the chapter quiz <ArrowRight size={16} />
            </Link>
          </div>
        )}

        <div className="flex gap-3 flex-wrap">
          <Link
            to="/module/$moduleId"
            params={{ moduleId: topic.unit }}
            className="btn-sk"
          >
            Back to module
          </Link>
          <Link to="/map" className="btn-sk ghost">
            Open the map
          </Link>
          <Link to="/review" className="btn-sk ghost">
            Review queue
          </Link>
          <Button variant="ghost" onClick={onRestart}>
            Restart this topic
          </Button>
        </div>
      </div>
    </Frame>
  );
}

/* ----------------------------------------------------------------
 * Small helpers
 * ---------------------------------------------------------------- */

function labelForStep(s: Step): string {
  switch (s.kind) {
    case "intro":
      return "Intro";
    case "teach":
      return s.section.heading;
    case "mini-quiz":
      return s.label;
    case "mini-feynman":
      return "Explain-back";
    case "topic-feynman":
      return "Teach it back";
    case "topic-quiz":
      return "Topic quiz";
    case "done":
      return "Done";
  }
}
