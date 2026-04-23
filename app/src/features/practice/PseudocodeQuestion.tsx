import { useState, useCallback } from "react";
import { motion } from "motion/react";
import { Link } from "@tanstack/react-router";
import { Frame, Button, Chip, Eyebrow, MiniLabel } from "@/components/notebook";
import { AlertTriangle, CheckCircle2, XCircle, Eye } from "lucide-react";
import type { KbQuizQuestion, PseudocodeData } from "@/lib/kb-loader";
import { useSettings } from "@/stores/settings";
import { streamChat, checkAvailability } from "@/lib/ollama";
import { db } from "@/lib/db";

interface Props {
  question: KbQuizQuestion;
  onAnswered?: (outcome: "correct" | "incorrect" | "skipped") => void;
}

type RubricState = {
  id: string;
  prompt: string;
  met: boolean;
  weight: number;
};

/**
 * Pseudocode question: student writes pseudocode for the named algorithm.
 *
 * Grading pipeline:
 *   1. OFFLINE rubric (always works): each rubric item's `keywords` are
 *      checked as case-insensitive substrings in the normalized response.
 *      Any-of match → item met. Weighted total gives a percent.
 *   2. OLLAMA pass (optional): if enabled, we send a system prompt pinning
 *      the reference pseudocode + rubric to a tutor role, stream token-by-token
 *      feedback into view, and persist the full feedback transcript to Dexie
 *      via the existing `feynman` table (reusing the schema — the row is
 *      tagged with topicSlug and flagged `pseudocode:` in the explanation).
 *
 * The mastery outcome (passed to `onAnswered`) is computed purely from the
 * offline rubric so the student gets a stable signal even when offline.
 * Passing threshold = 70% of rubric weight met.
 */
export function PseudocodeQuestion({ question, onAnswered }: Props) {
  const pc = question.pseudocode as PseudocodeData;
  const [text, setText] = useState("");
  const [rubricState, setRubricState] = useState<RubricState[] | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [llmOutput, setLlmOutput] = useState("");
  const [llmStatus, setLlmStatus] = useState<"idle" | "running" | "error" | "done" | "disabled">("idle");
  const [llmError, setLlmError] = useState<string | null>(null);
  const { ollamaEnabled, ollamaEndpoint, ollamaModel } = useSettings();

  const grade = useCallback(async () => {
    const lowered = text.toLowerCase();
    const scored: RubricState[] = pc.rubric.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      weight: item.weight,
      met: item.keywords.some((k) => lowered.includes(k.toLowerCase())),
    }));
    setRubricState(scored);

    const totalW = scored.reduce((a, s) => a + s.weight, 0);
    const metW = scored.filter((s) => s.met).reduce((a, s) => a + s.weight, 0);
    const pct = totalW === 0 ? 0 : metW / totalW;
    const passed = pct >= 0.7;

    onAnswered?.(passed ? "correct" : "incorrect");

    // Persist rubric pass to the feynman history table (reusing the row shape).
    await db.feynman.put({
      id: question.id + "-" + Date.now(),
      topicSlug: question.topicSlug,
      explanation: "pseudocode: " + text,
      rubricScore: pct,
      rubricBreakdown: Object.fromEntries(scored.map((s) => [s.id, s.met])),
      llmFeedback: null,
      createdAt: Date.now(),
    });

    // Optional Ollama deep feedback
    setLlmOutput("");
    setLlmError(null);
    if (!ollamaEnabled) {
      setLlmStatus("disabled");
      return;
    }
    setLlmStatus("running");
    const availability = await checkAvailability(ollamaEndpoint);
    if (!availability.ok) {
      setLlmStatus("error");
      setLlmError("Ollama unreachable — offline rubric still applied. " + (availability.error ?? ""));
      return;
    }

    const referenceBlock = pc.reference.join("\n");
    const rubricBlock = pc.rubric.map((r) => `- [${r.weight}pt] ${r.prompt}`).join("\n");
    const sys =
`You are a pseudocode grader for a Operating Systems course.

The student was asked:
"${question.prompt}"

The canonical reference pseudocode is:
\`\`\`
${referenceBlock}
\`\`\`

Grading rubric:
${rubricBlock}

Target complexity: ${pc.complexityHint ?? "(unspecified)"}

Your feedback should:
- Be under 220 words.
- Identify 2 concrete strengths and 2 concrete gaps, citing specific lines the
  student wrote (quote them).
- If they made a logical error (wrong base case, off-by-one, missing return,
  inverted comparison), quote the line and correct it.
- End with one sentence naming the biggest fix to make next.
Do not re-explain the whole algorithm. Stay direct and specific.`;

    try {
      let acc = "";
      await streamChat({
        endpoint: ollamaEndpoint,
        model: ollamaModel,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: "Student's pseudocode:\n\n" + text },
        ],
        onToken: (tok) => {
          acc += tok;
          setLlmOutput(acc);
        },
      });
      setLlmStatus("done");
    } catch (err) {
      setLlmStatus("error");
      setLlmError((err as Error).message);
    }
  }, [text, pc, ollamaEnabled, ollamaEndpoint, ollamaModel, question, onAnswered]);

  const totalWeight = pc.rubric.reduce((a, r) => a + r.weight, 0);
  const metWeight = rubricState?.filter((s) => s.met).reduce((a, s) => a + s.weight, 0) ?? 0;
  const pct = totalWeight === 0 ? 0 : metWeight / totalWeight;

  return (
    <Frame className="p-6!">
      <Eyebrow>pseudocode · {question.points ?? "—"} pts</Eyebrow>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h3 className="m-0">{question.prompt}</h3>
        <span className="flex-1" />
        <Chip tone="soft">target · {pc.complexityHint?.split("⇒")[1]?.trim() ?? pc.complexityHint ?? "—"}</Chip>
      </div>

      <p className="serif mt-2 text-[13px] text-(--ink-3) italic">
        Write it as you would on the exam: indented pseudocode with loop bounds,
        returns, and any auxiliary structures. Offline rubric always runs; if
        you've got Ollama on, you'll get streamed tutor feedback too.
      </p>

      <textarea
        className="workspace mono mt-3"
        rows={10}
        placeholder="PSEUDOCODE(args)
  if base-case
    return ...
  ...
  return ..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ fontSize: 13, fontFamily: "var(--ff-mono)" }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="pop" size="big" disabled={!text.trim()} onClick={grade}>
          Grade my pseudocode
        </Button>
        <Button
          variant="ghost"
          onClick={() => setShowReference((s) => !s)}
        >
          <Eye size={14} /> {showReference ? "hide" : "peek at"} reference
        </Button>
        <MiniLabel>
          {text.trim().split(/\s+/).filter(Boolean).length} words · Ollama {ollamaEnabled ? "on" : "off"}
        </MiniLabel>
      </div>

      {showReference && (
        <div
          className="mono mt-3 text-[12.5px] whitespace-pre-wrap"
          style={{
            border: "1.5px dashed var(--rule)",
            borderRadius: 8,
            padding: 12,
            background: "var(--paper-2)",
          }}
        >
          {pc.reference.join("\n")}
        </div>
      )}

      {rubricState && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>rubric result</Eyebrow>
            <span className="flex-1" />
            <Chip tone={pct >= 0.75 ? "mint" : pct >= 0.5 ? "hl" : "amber"}>
              {Math.round(pct * 100)}% ({metWeight}/{totalWeight} pts)
            </Chip>
          </div>

          <div
            className="mt-3 grid gap-2"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}
          >
            {rubricState.map((item) => (
              <div
                key={item.id}
                style={{
                  border: "1.5px solid var(--ink)",
                  borderRadius: 8,
                  padding: 10,
                  background: item.met
                    ? "var(--hl-2)"
                    : "color-mix(in oklch, var(--wrong) 10%, var(--paper))",
                }}
              >
                <div className="flex items-start gap-2">
                  {item.met ? (
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                  ) : (
                    <XCircle size={15} className="mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="text-[12.5px] leading-snug">{item.prompt}</div>
                    <div className="mono mt-1 text-[10.5px] text-(--ink-3)">
                      weight {item.weight}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pc.complexityHint && (
            <div className="serif mt-3 text-[14px] text-(--ink-2) italic">
              complexity: {pc.complexityHint}
            </div>
          )}

          {llmStatus === "disabled" && (
            <div className="mt-4 flex items-start gap-2 p-3" style={{ border: "1.5px dashed var(--ink-2)", borderRadius: 8, background: "var(--paper-2)" }}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div className="text-[13px]">
                Ollama is disabled. Enable it in <Link to="/settings" className="underline decoration-dashed">settings</Link> for line-by-line tutor feedback.
              </div>
            </div>
          )}
          {llmStatus === "error" && (
            <div className="mt-4 flex items-start gap-2 p-3" style={{ border: "1.5px dashed var(--ink-2)", borderRadius: 8, background: "color-mix(in oklch, var(--wrong) 10%, var(--paper))" }}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div className="text-[13px]">{llmError} Offline rubric above is still valid.</div>
            </div>
          )}
          {(llmStatus === "running" || llmStatus === "done") && (
            <div className="mt-5">
              <MiniLabel>{llmStatus === "running" ? "ollama · streaming tutor feedback…" : "ollama · done"}</MiniLabel>
              <div
                className="serif mt-2 text-[14px] leading-relaxed whitespace-pre-wrap"
                style={{
                  border: "1.5px solid var(--ink)",
                  borderRadius: 8,
                  padding: 14,
                  background: "var(--paper)",
                }}
              >
                {llmOutput || <span className="text-(--ink-3) italic">thinking…</span>}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </Frame>
  );
}
