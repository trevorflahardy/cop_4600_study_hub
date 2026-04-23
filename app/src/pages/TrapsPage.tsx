import { useMemo, useState } from "react";
import { getTopic } from "@/lib/kb-loader";
import {
  Frame,
  Chip,
  Eyebrow,
  Highlighter,
  MiniLabel,
  Button,
  PipRow,
  type PipState,
} from "@/components/notebook";
import { MarkdownBlock } from "@/components/content/MarkdownBlock";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, HeartCrack, Sparkles, ArrowRight, RotateCcw } from "lucide-react";
import { Link } from "@tanstack/react-router";

/* ----------------------------------------------------------------
 * Parsing — pull the Trap / Reality / Example / Why-it-matters
 * fields out of each "### N. Title" block in common-exam-traps.md.
 * ---------------------------------------------------------------- */

type TrapCard = {
  title: string;
  category: string;
  // Short form of the misconception, pulled from the **Trap**: line.
  claim: string;
  // Full "Reality" block (may contain multi-line markdown).
  reality: string;
  example: string | null;
  whyItMatters: string | null;
  // Everything else in the body we don't explicitly parse — shown as extra notes.
  extra: string;
};

function parseField(body: string, label: string): { value: string; stripped: string } {
  // Matches **Label**: ... until the next **SomethingElse**: or the next blank line block.
  const re = new RegExp(
    `\\*\\*${label}\\*\\*:?\\s*([\\s\\S]*?)(?=\\n\\s*\\*\\*[A-Z][^*]+\\*\\*:?|$)`,
    "i"
  );
  const m = body.match(re);
  if (!m) return { value: "", stripped: body };
  const value = m[1].trim();
  const stripped = body.replace(m[0], "").trim();
  return { value, stripped };
}

function parseTraps(body: string): TrapCard[] {
  const lines = body.split("\n");
  const cards: TrapCard[] = [];
  let currentCategory = "General";
  let currentTitle: string | null = null;
  let currentBody: string[] = [];

  const flush = () => {
    if (!currentTitle) return;
    const raw = currentBody.join("\n").trim();
    if (!raw) return;
    const t = parseField(raw, "Trap");
    const r = parseField(t.stripped, "Reality");
    const e = parseField(r.stripped, "Example");
    const w = parseField(e.stripped, "Why it matters");
    cards.push({
      title: currentTitle,
      category: currentCategory,
      claim: t.value || currentTitle,
      reality: r.value || "",
      example: e.value || null,
      whyItMatters: w.value || null,
      extra: w.stripped,
    });
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = line.match(/^###\s+(?:\d+\.\s*)?(.+)$/);
    if (h2) {
      flush();
      currentCategory = h2[1].trim();
      currentTitle = null;
      currentBody = [];
    } else if (h3) {
      flush();
      currentTitle = h3[1].trim();
      currentBody = [];
    } else if (currentTitle !== null) {
      currentBody.push(line);
    }
  }
  flush();
  return cards.filter((c) => c.reality.length > 0 || c.claim.length > 0);
}

/* ----------------------------------------------------------------
 * Page
 * ---------------------------------------------------------------- */

type Verdict = "push-back" | "agree" | "not-sure";

export function TrapsPage() {
  const topic = getTopic("07-exam-prep/common-exam-traps");
  const traps = useMemo(() => (topic ? parseTraps(topic.body) : []), [topic?.slug]);

  const categories = useMemo(() => [...new Set(traps.map((t) => t.category))], [traps]);

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const pool = useMemo(() => {
    if (categoryFilter === "all") return traps;
    return traps.filter((t) => t.category === categoryFilter);
  }, [traps, categoryFilter]);

  const [order, setOrder] = useState<number[]>(() =>
    Array.from({ length: traps.length }, (_, i) => i).sort(() => Math.random() - 0.5)
  );
  const [cursor, setCursor] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [wins, setWins] = useState(0);
  const [missed, setMissed] = useState(0);
  const [parked, setParked] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!topic) {
    return (
      <Frame>
        <h2>No exam-traps entry found.</h2>
        <MiniLabel>expected at kb/07-exam-prep/common-exam-traps.md</MiniLabel>
      </Frame>
    );
  }

  if (traps.length === 0) {
    return (
      <Frame>
        <Eyebrow>traps · empty</Eyebrow>
        <h2 className="mt-2">No traps parsed.</h2>
        <p className="serif mt-2 text-(--ink-2) italic">
          Expected <code>**Trap**: …</code> / <code>**Reality**: …</code> pairs under each
          <code> ### N. Title</code>.
        </p>
      </Frame>
    );
  }

  // Reset order & stats when filter changes
  const filteredOrder = order.filter((idx) => pool.some((c) => traps.indexOf(c) === idx));
  const currentIdx = filteredOrder[cursor] ?? -1;
  const current = traps[currentIdx];
  const total = filteredOrder.length;

  const pips: PipState[] = Array.from({ length: total }, (_, i) =>
    i < cursor ? "done" : i === cursor ? "now" : "pending"
  );

  const pick = (v: Verdict) => {
    setVerdict(v);
    if (v === "push-back") setWins((w) => w + 1);
    else if (v === "agree") setMissed((m) => m + 1);
    else setParked((p) => p + 1);
  };

  const advance = () => {
    if (cursor + 1 >= total) {
      setFinished(true);
      return;
    }
    setCursor((c) => c + 1);
    setVerdict(null);
  };

  const restart = () => {
    setOrder(Array.from({ length: traps.length }, (_, i) => i).sort(() => Math.random() - 0.5));
    setCursor(0);
    setVerdict(null);
    setWins(0);
    setMissed(0);
    setParked(0);
    setFinished(false);
  };

  if (finished) {
    return (
      <div className="flex flex-col gap-6">
        <Frame className="p-8!">
          <Eyebrow>traps · session complete</Eyebrow>
          <h1 className="mt-2">
            You sparred with <Highlighter color="amber">{total}</Highlighter> misconceptions.
          </h1>
          <p className="serif mt-3 max-w-[66ch] text-(--ink-2) italic">
            Pushing back on a false claim is the skill. The traps you agreed with are the
            ones to re-visit — not because you failed, but because the misconception felt
            plausible, which is exactly when the exam will catch you.
          </p>

          <div className="stats-grid mt-5">
            <div className="stat" style={{ background: "var(--hl-2)" }}>
              <div className="n">{wins}</div>
              <div className="label">pushed back · correct</div>
            </div>
            <div className="stat" style={{ background: "color-mix(in oklch, var(--wrong) 8%, var(--paper))" }}>
              <div className="n">{missed}</div>
              <div className="label">agreed with a trap · revisit</div>
            </div>
            <div className="stat">
              <div className="n">{parked}</div>
              <div className="label">parked · not sure</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="pop" size="big" onClick={restart}>
              <RotateCcw size={16} /> Shuffle & go again
            </Button>
            <Link to="/review" className="btn-sk ghost">
              Back to review queue
            </Link>
            <Link to="/map" className="btn-sk ghost">
              Open the map
            </Link>
          </div>
        </Frame>
      </div>
    );
  }

  if (!current) {
    return (
      <Frame>
        <h2>No traps matched this filter.</h2>
        <Button onClick={() => setCategoryFilter("all")}>Reset filter</Button>
      </Frame>
    );
  }

  const revealed = verdict !== null;
  const wasRight = verdict === "push-back";

  return (
    <div className="flex flex-col gap-6">
      <Frame className="p-8!">
        <Eyebrow>spar with misconceptions · {total} traps loaded</Eyebrow>
        <h1 className="mt-2">
          Catch the <Highlighter color="amber">gotcha</Highlighter> before it catches you.
        </h1>
        <p className="serif mt-3 max-w-[66ch] text-(--ink-2) italic">
          Each card is a plausible-sounding claim a classmate might make. Your job is to
          decide whether to push back. No penalty for being wrong — the misses just get
          logged so you can come back to them.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setCategoryFilter("all");
              setCursor(0);
              setVerdict(null);
            }}
            className={categoryFilter === "all" ? "btn-sk primary" : "btn-sk ghost"}
            style={{ padding: "4px 12px", fontSize: 13 }}
          >
            all ({traps.length})
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => {
                setCategoryFilter(c);
                setCursor(0);
                setVerdict(null);
              }}
              className={categoryFilter === c ? "btn-sk primary" : "btn-sk ghost"}
              style={{ padding: "4px 12px", fontSize: 13 }}
            >
              {c} ({traps.filter((t) => t.category === c).length})
            </button>
          ))}
        </div>
      </Frame>

      <div className="flex flex-wrap items-center gap-4">
        <MiniLabel>
          trap {cursor + 1} of {total}
        </MiniLabel>
        <PipRow states={pips.slice(0, Math.min(pips.length, 32))} />
        <span className="flex-1" />
        <Chip tone="mint">wins {wins}</Chip>
        <Chip tone="amber">revisit {missed}</Chip>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          <Frame className="p-8!">
            <div className="flex flex-wrap items-center gap-3">
              <Eyebrow>{current.category}</Eyebrow>
              <span className="flex-1" />
              <MiniLabel>#{currentIdx + 1} · {current.title}</MiniLabel>
            </div>

            <div
              className="mt-4 p-4"
              style={{
                borderLeft: "4px solid var(--ink)",
                background: "var(--paper-2)",
                borderRadius: "0 8px 8px 0",
              }}
            >
              <MiniLabel>imagine a classmate says:</MiniLabel>
              <p className="serif mt-1 text-[17px] italic">&ldquo;{current.claim}&rdquo;</p>
            </div>

            {!revealed ? (
              <>
                <MiniLabel className="mt-5 block">what do you do?</MiniLabel>
                <div className="mt-2 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                  <VerdictButton
                    tone="push-back"
                    onClick={() => pick("push-back")}
                    label="I'd push back"
                    helper="That claim is wrong or misleading."
                  />
                  <VerdictButton
                    tone="agree"
                    onClick={() => pick("agree")}
                    label="I'd agree"
                    helper="Sounds right to me."
                  />
                  <VerdictButton
                    tone="not-sure"
                    onClick={() => pick("not-sure")}
                    label="Not sure"
                    helper="Bank it and show me the reality."
                  />
                </div>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6"
              >
                <VerdictBanner verdict={verdict!} wasRight={wasRight} />

                <div className="mt-5">
                  <Eyebrow>the reality</Eyebrow>
                  <MarkdownBlock source={current.reality} className="mt-1" />
                </div>

                {current.example && (
                  <div className="mt-4">
                    <Eyebrow>worked example</Eyebrow>
                    <MarkdownBlock source={current.example} className="mt-1" />
                  </div>
                )}

                {current.whyItMatters && (
                  <div
                    className="mt-4 p-4"
                    style={{
                      border: "1.5px dashed var(--ink-2)",
                      borderRadius: 8,
                      background: "var(--paper-2)",
                    }}
                  >
                    <MiniLabel>why it matters</MiniLabel>
                    <p className="serif mt-1 text-[14px] italic">{current.whyItMatters}</p>
                  </div>
                )}

                {current.extra && current.extra.length > 40 && (
                  <details className="mt-4">
                    <summary className="mini-label cursor-pointer">
                      more context
                    </summary>
                    <MarkdownBlock source={current.extra} className="mt-2" />
                  </details>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <Button variant="pop" size="big" onClick={advance}>
                    {cursor + 1 >= total ? "Wrap up →" : "Next trap"} <ArrowRight size={16} />
                  </Button>
                  <Button variant="ghost" onClick={() => setFinished(true)}>
                    Stop here · see summary
                  </Button>
                </div>
              </motion.div>
            )}
          </Frame>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------------------------------------------
 * Small sub-views
 * ---------------------------------------------------------------- */

function VerdictButton({
  tone,
  onClick,
  label,
  helper,
}: {
  tone: Verdict;
  onClick: () => void;
  label: string;
  helper: string;
}) {
  const bg =
    tone === "push-back"
      ? "var(--paper)"
      : tone === "agree"
      ? "var(--paper)"
      : "var(--paper-2)";
  return (
    <button
      onClick={onClick}
      className="p-4 text-left transition-colors hover:bg-(--hl)"
      style={{
        border: "2px solid var(--ink)",
        borderRadius: 10,
        background: bg,
        cursor: "pointer",
      }}
    >
      <div className="display text-[18px] leading-none">{label}</div>
      <div className="serif mt-1 text-[13px] text-(--ink-2) italic">{helper}</div>
    </button>
  );
}

function VerdictBanner({ verdict, wasRight }: { verdict: Verdict; wasRight: boolean }) {
  if (wasRight) {
    return (
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        className="flex items-center gap-3 p-4"
        style={{
          border: "2px solid var(--ink)",
          borderRadius: 10,
          background: "var(--hl-2)",
        }}
      >
        <Sparkles size={20} />
        <div>
          <div className="display text-[18px] leading-none">Nice — push-back was right.</div>
          <div className="serif mt-1 text-[13px] text-(--ink-2) italic">
            The claim misses the nuance spelled out below.
          </div>
        </div>
        <span className="flex-1" />
        <CheckCircle2 size={22} />
      </motion.div>
    );
  }

  if (verdict === "agree") {
    return (
      <div
        className="flex items-center gap-3 p-4"
        style={{
          border: "2px solid var(--ink)",
          borderRadius: 10,
          background: "color-mix(in oklch, var(--wrong) 12%, var(--paper))",
        }}
      >
        <HeartCrack size={20} />
        <div>
          <div className="display text-[18px] leading-none">No problem — we'll come back to this one.</div>
          <div className="serif mt-1 text-[13px] text-(--ink-2) italic">
            The claim feels plausible, which is exactly why it traps half the class. Read the
            reality below and re-shuffle later.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 p-4"
      style={{
        border: "1.5px dashed var(--ink-2)",
        borderRadius: 10,
        background: "var(--paper-2)",
      }}
    >
      <div>
        <div className="display text-[18px] leading-none">Fair — bank it.</div>
        <div className="serif mt-1 text-[13px] text-(--ink-2) italic">
          Here's what's actually going on.
        </div>
      </div>
    </div>
  );
}
