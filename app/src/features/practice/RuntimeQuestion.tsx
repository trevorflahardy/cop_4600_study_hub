import { useState } from "react";
import { motion } from "motion/react";
import { Frame, Button, Chip, Eyebrow, MiniLabel } from "@/components/notebook";
import { CheckCircle2, XCircle } from "lucide-react";
import type { KbQuizQuestion, RuntimeData } from "@/lib/kb-loader";

interface Props {
  question: KbQuizQuestion;
  onAnswered?: (outcome: "correct" | "incorrect" | "skipped") => void;
}

/**
 * Runtime/complexity drill.
 *
 * The student fills four slots (typically best / avg / worst / space). Each
 * answer is normalized (strip spaces, case, Θ/theta/O/o/omega treated
 * interchangeably — the student's intent is what matters, not exact glyphs)
 * and compared against the canonical answer and its `accepts` equivalents.
 *
 * Grading:
 *   - Pass = all slots correct.
 *   - Partial credit is shown per-slot so the student sees exactly what they
 *     got right.
 *   - Mastery `correct` only fires on a full pass.
 */
export function RuntimeQuestion({ question, onAnswered }: Props) {
  const rt = question.runtime as RuntimeData;
  const [values, setValues] = useState<Record<string, string>>({});
  const [graded, setGraded] = useState<Record<string, boolean> | null>(null);

  function grade() {
    const result: Record<string, boolean> = {};
    for (const slot of rt.slots) {
      const user = normalize(values[slot.id] ?? "");
      const canonical = [slot.answer, ...(slot.accepts ?? [])].map(normalize);
      result[slot.id] = canonical.some((c) => c === user);
    }
    setGraded(result);
    const allRight = Object.values(result).every(Boolean);
    onAnswered?.(allRight ? "correct" : "incorrect");
  }

  function reset() {
    setValues({});
    setGraded(null);
  }

  const slotsCorrect = graded ? Object.values(graded).filter(Boolean).length : 0;

  return (
    <Frame className="p-6!">
      <Eyebrow>runtime drill · {question.points ?? "—"} pts</Eyebrow>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h3 className="m-0">{question.prompt}</h3>
        <span className="flex-1" />
        {graded && (
          <Chip tone={slotsCorrect === rt.slots.length ? "mint" : slotsCorrect > 0 ? "hl" : "amber"}>
            {slotsCorrect} / {rt.slots.length} correct
          </Chip>
        )}
      </div>
      <p className="serif mt-2 text-[13px] text-(--ink-3) italic">
        Enter each bound in asymptotic notation (e.g. <code className="mono">Θ(n log n)</code>,
        <code className="mono"> O(1)</code>, <code className="mono">Θ(V+E)</code>). I'm flexible
        on glyphs — <code className="mono">theta</code>, <code className="mono">O</code>, and spaces all work.
      </p>

      <div
        className="mt-4 grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
      >
        {rt.slots.map((slot) => {
          const status = graded?.[slot.id];
          return (
            <div
              key={slot.id}
              style={{
                border: "1.5px solid var(--ink)",
                borderRadius: 10,
                padding: 12,
                background:
                  status === true ? "var(--hl-2)"
                  : status === false ? "color-mix(in oklch, var(--wrong) 10%, var(--paper))"
                  : "var(--paper)",
              }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <MiniLabel>{slot.label}</MiniLabel>
                {status === true && <CheckCircle2 size={14} />}
                {status === false && <XCircle size={14} />}
              </div>
              <input
                className="mono mt-1 w-full"
                placeholder="Θ(...)"
                value={values[slot.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [slot.id]: e.target.value }))}
                disabled={!!graded}
                style={{
                  fontFamily: "var(--ff-mono)",
                  fontSize: 14,
                  background: "transparent",
                  border: "1px solid var(--rule)",
                  borderRadius: 6,
                  padding: "6px 8px",
                }}
              />
              {status === false && (
                <div className="mono mt-2 text-[11.5px] text-(--ink-2)">
                  answer: {slot.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!graded ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="pop" size="big" onClick={grade}>
            Check answers
          </Button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          {rt.whyNote && (
            <div
              className="serif mt-4 p-3 text-[14px] italic"
              style={{
                background: "var(--paper-2)",
                border: "1.5px dashed var(--rule)",
                borderRadius: 8,
                color: "var(--ink-2)",
              }}
            >
              {rt.whyNote}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="pop" onClick={reset}>Try again</Button>
          </div>
        </motion.div>
      )}
    </Frame>
  );
}

/**
 * Normalize a complexity string so that "Θ(n log n)", "theta(n log n)",
 * "THETA(N LOG N)", and "theta(nlogn)" compare equal. Also strips the "O(..)"
 * wrapper since students often just write "n log n".
 */
function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/θ/g, "theta")
    .replace(/ω/g, "omega")
    .replace(/θ/g, "theta")
    .replace(/\\theta/g, "theta")
    .replace(/\\omega/g, "omega")
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/·/g, "*")
    .replace(/–/g, "-")
    .replace(/^theta\((.*)\)$/, "$1")
    .replace(/^o\((.*)\)$/, "$1")
    .replace(/^omega\((.*)\)$/, "$1")
    .replace(/^big-o\((.*)\)$/, "$1");
}
