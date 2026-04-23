import { useState, useMemo } from "react";
import { Frame, Button, Chip, Eyebrow, MiniLabel, PipRow, type PipState } from "@/components/notebook";
import type { KbQuizQuestion } from "@/lib/kb-loader";
import { recordAnswer } from "@/lib/mastery";
import clsx from "clsx";

interface QuizRunnerProps {
  questions: KbQuizQuestion[];
  onComplete?: (stats: { correct: number; incorrect: number }) => void;
  banner?: React.ReactNode;
}

/**
 * Reusable quiz runner. Powers both /practice and /review.
 * MCQ questions auto-grade; short-answer self-rated.
 */
export function QuizRunner({ questions, onComplete, banner }: QuizRunnerProps) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<("right" | "wrong" | "skipped")[]>([]);
  const [confidence, setConfidence] = useState(50);
  const q = questions[i];

  const pips: PipState[] = useMemo(() => {
    return questions.map((_, idx) => {
      if (idx < results.length) return results[idx] === "right" ? "done" : results[idx] === "wrong" ? "wrong" : "review";
      if (idx === i) return "now";
      return "pending";
    });
  }, [questions, results, i]);

  if (!q) {
    return (
      <Frame>
        <h3>No questions in this set.</h3>
        <MiniLabel>try choosing a different topic or module</MiniLabel>
      </Frame>
    );
  }

  const submit = async () => {
    if (q.kind === "mcq" && picked !== null && q.choices) {
      const isRight = q.choices[picked].correct;
      setRevealed(true);
      const outcome: "correct" | "confident-wrong" | "incorrect" =
        isRight ? "correct" : confidence > 70 ? "confident-wrong" : "incorrect";
      await recordAnswer(q.topicSlug, outcome);
    } else {
      setRevealed(true);
    }
  };

  const advance = (result: "right" | "wrong" | "skipped") => {
    const next = [...results, result];
    setResults(next);
    setPicked(null);
    setRevealed(false);
    setConfidence(50);
    if (i + 1 >= questions.length) {
      const correct = next.filter((r) => r === "right").length;
      const incorrect = next.filter((r) => r === "wrong").length;
      onComplete?.({ correct, incorrect });
      return;
    }
    setI(i + 1);
  };

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
          <textarea
            className="workspace mt-4"
            placeholder="your answer · free-form"
            rows={5}
            disabled={revealed}
          />
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
            <Button variant="pop" size="big" onClick={submit} disabled={q.kind === "mcq" && picked === null}>
              Submit answer
            </Button>
            <Button variant="ghost" onClick={() => advance("skipped")}>Skip · mark as hard</Button>
          </div>
        ) : (
          <div className="feedback-card mt-6" style={{
            background: q.kind === "mcq" && q.choices && picked !== null && q.choices[picked].correct
              ? "var(--hl-2)" : "color-mix(in oklch, var(--wrong) 14%, var(--paper))",
          }}>
            <h4>
              {q.kind === "mcq" && q.choices && picked !== null && q.choices[picked].correct
                ? "✓ Right — nicely done."
                : "✗ Not quite."}
            </h4>
            <div className="why mt-1">
              {q.kind === "mcq" && q.choices && picked !== null ? (
                <>
                  <p><strong>Why:</strong> {q.choices[picked].why || q.explanation}</p>
                  <ul className="mt-2 list-disc pl-5 text-[13px]">
                    {q.choices.filter((_, idx) => idx !== picked && !q.choices![idx].correct).slice(0, 2).map((c, idx) => (
                      <li key={idx}><strong>{c.text}:</strong> {c.why}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>{q.explanation}</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="pop" onClick={() => advance(q.kind === "mcq" && q.choices && picked !== null && q.choices[picked].correct ? "right" : "wrong")}>
                Next →
              </Button>
              <Button variant="ghost" onClick={() => advance("skipped")}>Add to flashcards</Button>
            </div>
          </div>
        )}
      </Frame>
    </div>
  );
}
