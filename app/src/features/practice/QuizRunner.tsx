import { useState, useMemo, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Frame, Button, Chip, Eyebrow, MiniLabel, PipRow, type PipState } from "@/components/notebook";
import type { KbQuizQuestion } from "@/lib/kb-loader";
import { getTopic } from "@/lib/kb-loader";
import { recordAnswer } from "@/lib/mastery";
import { useSettings } from "@/stores/settings";
import { streamChat, checkAvailability } from "@/lib/ollama";
import clsx from "clsx";

interface QuizRunnerProps {
  questions: KbQuizQuestion[];
  onComplete?: (stats: { correct: number; incorrect: number }) => void;
  banner?: React.ReactNode;
}

type ShortGradeState =
  | { phase: "idle" }
  | { phase: "running"; output: string }
  | { phase: "done"; output: string; verdict: "correct" | "partial" | "incorrect" }
  | { phase: "unavailable"; reason: string }
  | { phase: "error"; message: string };

/**
 * Reusable quiz runner. Powers both /practice and /review.
 *
 * MCQ questions auto-grade on submit.
 *
 * Short-answer questions: when Ollama is enabled, the student's response is
 * graded against the topic's Definition + Key ideas + Gotchas and the
 * question's explanation. The LLM emits a structured `VERDICT:` line which
 * maps directly to mastery (`correct`/`incorrect`) — no self-rating. When
 * Ollama is off or unreachable, the runner falls back to explicit "I got it
 * right" / "I got it wrong" buttons.
 */
export function QuizRunner({ questions, onComplete, banner }: QuizRunnerProps) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<("right" | "wrong" | "skipped")[]>([]);
  const [confidence, setConfidence] = useState(50);
  const [shortText, setShortText] = useState("");
  const [shortGrade, setShortGrade] = useState<ShortGradeState>({ phase: "idle" });
  const q = questions[i];
  const { ollamaEnabled, ollamaEndpoint, ollamaModel } = useSettings();

  const pips: PipState[] = useMemo(() => {
    return questions.map((_, idx) => {
      if (idx < results.length) return results[idx] === "right" ? "done" : results[idx] === "wrong" ? "wrong" : "review";
      if (idx === i) return "now";
      return "pending";
    });
  }, [questions, results, i]);

  const buildShortReference = useCallback((question: KbQuizQuestion): string => {
    const topic = getTopic(question.topicSlug);
    if (!topic) return question.explanation ?? "";
    const keep = topic.sections.filter((s) => /definition|key ideas|mechanism|gotcha|when to use/i.test(s.heading));
    const parts: string[] = [];
    parts.push("Topic: " + topic.title);
    for (const s of keep) {
      parts.push("## " + s.heading + "\n" + s.body);
    }
    if (question.explanation && !/^see the .+ kb entry\.?$/i.test(question.explanation)) {
      parts.push("Question-level note: " + question.explanation);
    }
    return parts.join("\n\n").slice(0, 3500);
  }, []);

  const parseVerdict = (raw: string): "correct" | "partial" | "incorrect" => {
    const m = raw.match(/VERDICT\s*:\s*(correct|partial|incorrect)/i);
    if (m) return m[1].toLowerCase() as "correct" | "partial" | "incorrect";
    // Heuristic fallback if the model forgot the header.
    const lower = raw.toLowerCase();
    if (/\b(correct|right|well done|accurate)\b/.test(lower) && !/\bnot (correct|right)\b/.test(lower)) return "correct";
    if (/\b(partial|partly|mostly|close)\b/.test(lower)) return "partial";
    return "incorrect";
  };

  const submit = async () => {
    if (q.kind === "mcq" && picked !== null && q.choices) {
      const isRight = q.choices[picked].correct;
      setRevealed(true);
      const outcome: "correct" | "confident-wrong" | "incorrect" =
        isRight ? "correct" : confidence > 70 ? "confident-wrong" : "incorrect";
      await recordAnswer(q.topicSlug, outcome);
      return;
    }

    if (q.kind === "short") {
      setRevealed(true);
      if (!shortText.trim()) return;

      if (!ollamaEnabled) {
        setShortGrade({ phase: "unavailable", reason: "Ollama is disabled in settings." });
        return;
      }

      const availability = await checkAvailability(ollamaEndpoint);
      if (!availability.ok) {
        setShortGrade({
          phase: "unavailable",
          reason: "Ollama unreachable at " + ollamaEndpoint + " — " + (availability.error ?? "no response"),
        });
        return;
      }

      const reference = buildShortReference(q);
      const sys =
`You are grading a student's free-response answer on a COP 4600 Operating Systems exam.

Question:
${q.prompt}

Reference material (authoritative — the student's answer should align with this):
${reference}

Grading rules:
- Focus on conceptual correctness, not prose polish.
- Partial credit ("partial") is appropriate when the student gets the core idea but misses a key detail or edge case.
- "correct" means the answer would earn full or near-full credit on an exam.
- "incorrect" means the core idea is wrong or missing.

Your response MUST be under 140 words and MUST follow this shape exactly:

VERDICT: correct|partial|incorrect

Strengths: one or two short bullets citing what the student got right (quote if helpful).
Gaps: one or two short bullets naming the concrete missing concepts.
Best fix: one sentence describing the single most important correction.

Do not restate the question. Do not write more than 140 words.`;

      setShortGrade({ phase: "running", output: "" });
      try {
        let acc = "";
        await streamChat({
          endpoint: ollamaEndpoint,
          model: ollamaModel,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: "Student answer:\n" + shortText },
          ],
          onToken: (tok) => {
            acc += tok;
            setShortGrade({ phase: "running", output: acc });
          },
        });
        const verdict = parseVerdict(acc);
        setShortGrade({ phase: "done", output: acc, verdict });
        await recordAnswer(
          q.topicSlug,
          verdict === "correct" ? "correct" : verdict === "partial" ? "incorrect" : "incorrect",
        );
      } catch (err) {
        setShortGrade({ phase: "error", message: (err as Error).message });
      }
      return;
    }

    // Other question kinds (scenario/graph-walk/etc.) — keep the simple reveal flow.
    setRevealed(true);
  };

  const advance = (result: "right" | "wrong" | "skipped") => {
    const next = [...results, result];
    setResults(next);
    setPicked(null);
    setRevealed(false);
    setConfidence(50);
    setShortText("");
    setShortGrade({ phase: "idle" });
    if (i + 1 >= questions.length) {
      const correct = next.filter((r) => r === "right").length;
      const incorrect = next.filter((r) => r === "wrong").length;
      onComplete?.({ correct, incorrect });
      return;
    }
    setI(i + 1);
  };

  if (!q) {
    return (
      <Frame>
        <h3>No questions in this set.</h3>
        <MiniLabel>try choosing a different topic or module</MiniLabel>
      </Frame>
    );
  }

  const mcqRight = q.kind === "mcq" && q.choices && picked !== null && q.choices[picked].correct;

  const shortVerdictLabel =
    shortGrade.phase === "done"
      ? shortGrade.verdict === "correct"
        ? "✓ Correct"
        : shortGrade.verdict === "partial"
        ? "~ Partial credit"
        : "✗ Incorrect"
      : null;

  const shortVerdictResult: "right" | "wrong" =
    shortGrade.phase === "done" && shortGrade.verdict === "correct" ? "right" : "wrong";

  return (
    <div className="flex flex-col gap-6">
      {banner}

      <div className="flex flex-wrap items-center gap-4">
        <MiniLabel>question {i + 1} of {questions.length} · {q.difficulty}</MiniLabel>
        <PipRow states={pips} />
        <span className="flex-1" />
        <Chip tone={q.kind === "mcq" ? "sky" : "soft"}>{q.kind.toUpperCase()}</Chip>
      </div>

      <Frame className="p-8!">
        <Eyebrow>{q.topicSlug}</Eyebrow>
        <h2 className="mt-2">{q.prompt}</h2>

        {q.kind === "mcq" && q.choices && (
          <div className="m3-choices mt-6">
            {q.choices.map((c, idx) => {
              const letter = String.fromCharCode(65 + idx);
              const isPicked = picked === idx;
              const cls = clsx("m3-ch", isPicked && "picked", revealed && isPicked && (c.correct ? "right" : "wrong"));
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

        {q.kind === "short" && (
          <>
            <textarea
              className="workspace mt-4"
              placeholder="your answer · free-form"
              rows={5}
              disabled={revealed}
              value={shortText}
              onChange={(e) => setShortText(e.target.value)}
            />
            <MiniLabel>
              {shortText.trim().split(/\s+/).filter(Boolean).length} words · Ollama {ollamaEnabled ? "on" : "off"}
            </MiniLabel>
          </>
        )}

        <div className="mt-5">
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

        {!revealed ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              variant="pop"
              size="big"
              onClick={submit}
              disabled={(q.kind === "mcq" && picked === null) || (q.kind === "short" && !shortText.trim())}
            >
              Submit answer
            </Button>
            <Button variant="ghost" onClick={() => advance("skipped")}>Skip · mark as hard</Button>
          </div>
        ) : (
          <div className="feedback-card mt-6" style={{
            background: mcqRight ? "var(--hl-2)" : "color-mix(in oklch, var(--wrong) 14%, var(--paper))",
          }}>
            {q.kind === "mcq" && (
              <>
                <h4>{mcqRight ? "✓ Right — nicely done." : "✗ Not quite."}</h4>
                <div className="why mt-1">
                  {q.choices && picked !== null && (
                    <>
                      <p><strong>Why:</strong> {q.choices[picked].why || q.explanation}</p>
                      <ul className="mt-2 list-disc pl-5 text-[13px]">
                        {q.choices.filter((_, idx) => idx !== picked && !q.choices![idx].correct).slice(0, 2).map((c, idx) => (
                          <li key={idx}><strong>{c.text}:</strong> {c.why}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="pop" onClick={() => advance(mcqRight ? "right" : "wrong")}>
                    Next →
                  </Button>
                </div>
              </>
            )}

            {q.kind === "short" && (
              <>
                <div className="flex flex-wrap items-baseline gap-3">
                  <h4 className="m-0">
                    {shortVerdictLabel ??
                      (shortGrade.phase === "running"
                        ? "grading…"
                        : shortGrade.phase === "unavailable"
                        ? "Ollama off — self-grade below"
                        : shortGrade.phase === "error"
                        ? "grader errored — self-grade below"
                        : "")}
                  </h4>
                  <span className="flex-1" />
                  {shortGrade.phase === "running" && <MiniLabel>ollama · streaming…</MiniLabel>}
                  {shortGrade.phase === "done" && <MiniLabel>ollama · {ollamaModel}</MiniLabel>}
                </div>

                {(shortGrade.phase === "running" || shortGrade.phase === "done") && (
                  <div
                    className="serif mt-3 text-[14px] leading-relaxed whitespace-pre-wrap"
                    style={{
                      border: "1.5px solid var(--ink)",
                      borderRadius: 8,
                      padding: 14,
                      background: "var(--paper)",
                    }}
                  >
                    {shortGrade.output || <span className="text-(--ink-3) italic">thinking…</span>}
                  </div>
                )}

                {shortGrade.phase === "unavailable" && (
                  <div className="mt-3 text-[13px]">
                    <p className="m-0">{shortGrade.reason}</p>
                    <p className="mt-2 m-0">
                      Turn it on in <Link to="/settings" className="underline decoration-dashed">settings</Link> for
                      real grading, or self-grade below.
                    </p>
                  </div>
                )}

                {shortGrade.phase === "error" && (
                  <p className="mt-3 text-[13px]">Ollama error: {shortGrade.message}. Self-grade below.</p>
                )}

                {/* Reference / explanation when we have one worth showing */}
                {q.explanation && !/^see the .+ kb entry\.?$/i.test(q.explanation) && (
                  <p className="mt-3 text-[13px]"><strong>Reference:</strong> {q.explanation}</p>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  {shortGrade.phase === "done" ? (
                    <Button variant="pop" onClick={() => advance(shortVerdictResult)}>
                      Next →
                    </Button>
                  ) : shortGrade.phase === "running" ? (
                    <Button variant="pop" disabled>Grading…</Button>
                  ) : (
                    <>
                      <Button
                        variant="pop"
                        onClick={async () => {
                          await recordAnswer(q.topicSlug, "correct");
                          advance("right");
                        }}
                      >
                        I got it right
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          await recordAnswer(q.topicSlug, confidence > 70 ? "confident-wrong" : "incorrect");
                          advance("wrong");
                        }}
                      >
                        I got it wrong
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {q.kind !== "mcq" && q.kind !== "short" && (
              <>
                <h4>Review</h4>
                <div className="why mt-1"><p>{q.explanation}</p></div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button variant="pop" onClick={() => advance("right")}>I got it right</Button>
                  <Button variant="ghost" onClick={() => advance("wrong")}>I got it wrong</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Frame>
    </div>
  );
}
