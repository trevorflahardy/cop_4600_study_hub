import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Frame,
  Chip,
  Eyebrow,
  MiniLabel,
  Button,
  PipRow,
  type PipState,
} from "@/components/notebook";
import { quizzesFor, type KbQuizQuestion } from "@/lib/kb-loader";
import { recordAnswer } from "@/lib/mastery";
import { Sparkles, ArrowRight, RotateCcw, Play, Heart } from "lucide-react";
import clsx from "clsx";

/**
 * ExamQuestionsQuiz — a forgiving, launchable mini-quiz designed for the
 * "Common exam questions" section of a topic.
 *
 * Tone: iterative learning. Correct = sparkly visual reward. Wrong = gentle
 * "no problem, we'll come back to it" — never a red alarm. Mastery only
 * increments on correct; wrong answers don't penalize (skips the harsher
 * confident-wrong bucket that QuizRunner uses).
 */
export function ExamQuestionsQuiz({
  topicSlug,
  topicTitle,
  variant = "full",
}: {
  topicSlug: string;
  topicTitle?: string;
  variant?: "full" | "compact";
}) {
  const questions = useMemo(() => quizzesFor(topicSlug), [topicSlug]);

  const [mode, setMode] = useState<"idle" | "running" | "done">("idle");
  const [order, setOrder] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [shortText, setShortText] = useState("");
  const [results, setResults] = useState<("win" | "park")[]>([]);

  const launch = () => {
    const shuffled = [...Array(questions.length).keys()].sort(() => Math.random() - 0.5);
    setOrder(shuffled);
    setCursor(0);
    setPicked(null);
    setRevealed(false);
    setShortText("");
    setResults([]);
    setMode("running");
  };

  const currentQ = mode === "running" ? questions[order[cursor]] : null;

  const submit = useCallback(async () => {
    if (!currentQ) return;
    if (currentQ.kind === "mcq" && picked !== null && currentQ.choices) {
      const isRight = currentQ.choices[picked].correct;
      setRevealed(true);
      if (isRight) {
        // Gentle mastery bump on wins only. No penalty for misses —
        // the whole point is iterative learning, not a graded test.
        await recordAnswer(currentQ.topicSlug, "correct");
      }
    } else {
      setRevealed(true);
    }
  }, [currentQ, picked]);

  const advance = useCallback(
    (result: "win" | "park") => {
      const next = [...results, result];
      setResults(next);
      setPicked(null);
      setRevealed(false);
      setShortText("");
      if (cursor + 1 >= order.length) {
        setMode("done");
        return;
      }
      setCursor(cursor + 1);
    },
    [cursor, order.length, results]
  );

  /* ---------- Empty state ---------- */

  if (questions.length === 0) {
    return (
      <Frame variant="dashed" className="p-6!">
        <Eyebrow>common exam questions</Eyebrow>
        <p className="serif mt-2 text-[14px] text-(--ink-2) italic">
          No questions authored for this topic yet. Add them under "Common exam questions"
          in the KB markdown, then run <code>bun kb</code>.
        </p>
      </Frame>
    );
  }

  /* ---------- Idle launcher ---------- */

  if (mode === "idle") {
    return (
      <Frame
        className={clsx("relative overflow-hidden p-6!", variant === "compact" && "p-5!")}
        style={{ background: "var(--paper-2)" }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(400px 200px at 90% -20%, color-mix(in oklch, var(--pop) 18%, transparent), transparent)",
            pointerEvents: "none",
          }}
        />
        <div className="relative">
          <Eyebrow>common exam questions · mini-quiz</Eyebrow>
          <h3 className="mt-2">
            {questions.length} question{questions.length > 1 ? "s" : ""} loaded
            {topicTitle ? ` for ${topicTitle}` : ""}.
          </h3>
          <p className="serif mt-2 max-w-[60ch] text-[14px] text-(--ink-2) italic">
            Low-stakes. Right answers light up — wrong ones just get banked so we can come
            back to them. This is about <em>iterating</em>, not being graded.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Chip tone="sky">{questions.filter((q) => q.kind === "mcq").length} multiple choice</Chip>
            {questions.filter((q) => q.kind !== "mcq").length > 0 && (
              <Chip tone="soft">
                {questions.filter((q) => q.kind !== "mcq").length} short-answer
              </Chip>
            )}
            <Chip tone="amber">shuffled each run</Chip>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="pop" size="big" onClick={launch}>
              <Play size={16} /> Throw me in
            </Button>
            <MiniLabel>no penalty for wrong · mastery only moves on correct</MiniLabel>
          </div>
        </div>
      </Frame>
    );
  }

  /* ---------- Done summary ---------- */

  if (mode === "done") {
    const wins = results.filter((r) => r === "win").length;
    const parks = results.filter((r) => r === "park").length;

    return (
      <Frame className="p-6!">
        <Eyebrow>mini-quiz · wrapped</Eyebrow>
        <h3 className="mt-2">
          {wins} clicked. {parks > 0 ? `${parks} to come back to.` : "Nothing to re-queue."}
        </h3>
        <p className="serif mt-2 max-w-[60ch] text-[14px] text-(--ink-2) italic">
          {wins === order.length
            ? "Clean sweep. Read the rest of the topic, then take the full quiz at the end of the stepper."
            : wins > order.length / 2
            ? "Solid. Re-shuffle later to lock in the ones you parked."
            : "You found the sharp edges. Re-read the section above and try again — that's the loop."}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="pop" onClick={launch}>
            <RotateCcw size={16} /> Re-shuffle & go again
          </Button>
          <Button variant="ghost" onClick={() => setMode("idle")}>
            Close
          </Button>
        </div>
      </Frame>
    );
  }

  /* ---------- Running ---------- */

  if (!currentQ) return null;

  const pips: PipState[] = order.map((_, i) =>
    i < results.length ? (results[i] === "win" ? "done" : "review") : i === cursor ? "now" : "pending"
  );

  const isRight =
    revealed &&
    currentQ.kind === "mcq" &&
    currentQ.choices &&
    picked !== null &&
    currentQ.choices[picked].correct;

  return (
    <Frame className="p-6!">
      <div className="flex flex-wrap items-center gap-3">
        <Eyebrow>
          mini-quiz · {cursor + 1} of {order.length}
        </Eyebrow>
        <span className="flex-1" />
        <PipRow states={pips} />
        <Chip tone={currentQ.kind === "mcq" ? "sky" : "soft"}>
          {currentQ.kind.toUpperCase()}
        </Chip>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={cursor}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          <h3 className="mt-3 leading-snug">{currentQ.prompt}</h3>

          {currentQ.kind === "mcq" && currentQ.choices && (
            <div className="m3-choices mt-5">
              {currentQ.choices.map((c, idx) => {
                const letter = String.fromCharCode(65 + idx);
                const isPicked = picked === idx;
                const cls = clsx(
                  "m3-ch",
                  isPicked && "picked",
                  revealed && isPicked && (c.correct ? "right" : "wrong"),
                  revealed && !isPicked && c.correct && "right"
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

          {currentQ.kind !== "mcq" && (
            <textarea
              className="workspace mt-4"
              rows={5}
              placeholder="your answer · free-form"
              value={shortText}
              onChange={(e) => setShortText(e.target.value)}
              disabled={revealed}
            />
          )}

          {!revealed ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                variant="pop"
                onClick={submit}
                disabled={
                  (currentQ.kind === "mcq" && picked === null) ||
                  (currentQ.kind !== "mcq" && shortText.trim().length < 3)
                }
              >
                Submit
              </Button>
              <Button variant="ghost" onClick={() => advance("park")}>
                Skip · bank it
              </Button>
              <MiniLabel>
                <Heart size={10} className="mr-1 inline" /> no penalty · iterate freely
              </MiniLabel>
            </div>
          ) : currentQ.kind === "mcq" ? (
            isRight ? (
              <CorrectReward
                why={
                  currentQ.choices![picked!].why ||
                  currentQ.explanation ||
                  "That's the one."
                }
                onNext={() => advance("win")}
                isLast={cursor + 1 >= order.length}
              />
            ) : (
              <GentleMiss
                pickedWhy={currentQ.choices![picked!].why}
                correctText={currentQ.choices!.find((c) => c.correct)?.text ?? ""}
                explanation={currentQ.explanation}
                onNext={() => advance("park")}
                isLast={cursor + 1 >= order.length}
              />
            )
          ) : (
            <SelfRateShort
              expected={currentQ.answer ?? currentQ.explanation ?? "See the KB entry."}
              onWin={() => advance("win")}
              onPark={() => advance("park")}
              isLast={cursor + 1 >= order.length}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </Frame>
  );
}

/* ---------- Sub-components ---------- */

function CorrectReward({
  why,
  onNext,
  isLast,
}: {
  why: string;
  onNext: () => void;
  isLast: boolean;
}) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="relative mt-5 overflow-hidden p-4"
      style={{
        border: "2px solid var(--ink)",
        borderRadius: 10,
        background: "var(--hl-2)",
      }}
    >
      {/* Sparkle burst */}
      <div aria-hidden style={{ position: "absolute", top: 8, right: 8, opacity: 0.6 }}>
        <motion.div
          initial={{ rotate: 0, scale: 0 }}
          animate={{ rotate: 360, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <Sparkles size={22} />
        </motion.div>
      </div>

      <div className="flex items-center gap-2">
        <h4 className="display text-[18px]">Locked in.</h4>
        <Chip tone="mint">+1 mastery nudge</Chip>
      </div>
      <p className="serif mt-2 text-[14px]">
        <strong>Why:</strong> {why}
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="pop" onClick={onNext}>
          {isLast ? "Wrap up →" : "Next question"} <ArrowRight size={14} />
        </Button>
      </div>
    </motion.div>
  );
}

function GentleMiss({
  pickedWhy,
  correctText,
  explanation,
  onNext,
  isLast,
}: {
  pickedWhy?: string;
  correctText: string;
  explanation?: string;
  onNext: () => void;
  isLast: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-5 p-4"
      style={{
        border: "1.5px dashed var(--ink-2)",
        borderRadius: 10,
        background: "var(--paper-2)",
      }}
    >
      <div className="flex items-center gap-2">
        <Heart size={18} />
        <h4 className="display text-[18px]">No problem — we'll come back to this one.</h4>
      </div>
      <p className="serif mt-1 text-[13px] text-(--ink-2) italic">
        That answer feels right when you first read it — it's exactly the kind of thing the
        exam builds a question around. Here's what's actually going on:
      </p>
      <div className="mt-3">
        <MiniLabel>correct</MiniLabel>
        <div className="serif mt-1 text-[14px]">{correctText}</div>
      </div>
      {pickedWhy && (
        <div className="mt-3">
          <MiniLabel>where that trap comes from</MiniLabel>
          <p className="serif mt-1 text-[13px]">{pickedWhy}</p>
        </div>
      )}
      {explanation && (
        <div className="mt-3">
          <MiniLabel>big picture</MiniLabel>
          <p className="serif mt-1 text-[13px]">{explanation}</p>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="pop" onClick={onNext}>
          {isLast ? "Wrap up →" : "Next question"} <ArrowRight size={14} />
        </Button>
      </div>
    </motion.div>
  );
}

function SelfRateShort({
  expected,
  onWin,
  onPark,
  isLast,
}: {
  expected: string;
  onWin: () => void;
  onPark: () => void;
  isLast: boolean;
}) {
  return (
    <div
      className="mt-5 p-4"
      style={{
        border: "1.5px solid var(--ink)",
        borderRadius: 10,
        background: "var(--paper-2)",
      }}
    >
      <MiniLabel>what to check for</MiniLabel>
      <p className="serif mt-1 text-[14px]">{expected}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="pop" onClick={onWin}>
          I hit the key points · {isLast ? "wrap up" : "next"}
        </Button>
        <Button variant="ghost" onClick={onPark}>
          Needs work · bank it
        </Button>
      </div>
    </div>
  );
}
