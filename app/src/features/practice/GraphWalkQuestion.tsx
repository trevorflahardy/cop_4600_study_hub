import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Frame, Button, Chip, Eyebrow, MiniLabel } from "@/components/notebook";
import { RotateCcw, CheckCircle2, XCircle, Undo2 } from "lucide-react";
import type { KbQuizQuestion, GraphWalkData } from "@/lib/kb-loader";

interface Props {
  question: KbQuizQuestion;
  onAnswered?: (outcome: "correct" | "incorrect" | "skipped") => void;
}

/**
 * Student-driven graph walkthrough.
 *
 * The graph is rendered statically (we don't auto-animate — the whole point is
 * that the STUDENT produces the visit order). As they click, each pick is
 * validated against the expected next step. Wrong picks are flagged with a
 * gentle miss indicator but don't advance. An "undo last" button lets them
 * back out without tanking the attempt.
 *
 * For edge-based questions (Kruskal), the student clicks edges by selecting
 * their two endpoints. This intentionally mirrors how they'd draw it on paper.
 */
export function GraphWalkQuestion({ question, onAnswered }: Props) {
  const gw = question.graphWalk as GraphWalkData;
  const { graph, expectedOrder, orderKind = "nodes", algorithm, source, tieBreak } = gw;

  const [picked, setPicked] = useState<string[]>([]);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [pendingEdgeFirst, setPendingEdgeFirst] = useState<string | null>(null);
  const [done, setDone] = useState<"correct" | "incorrect" | null>(null);

  const adjacent = useMemo(() => {
    const a: Record<string, Set<string>> = {};
    for (const n of graph.nodes) a[n.id] = new Set();
    for (const e of graph.edges) {
      a[e.from].add(e.to);
      if (!graph.directed) a[e.to].add(e.from);
    }
    return a;
  }, [graph]);

  const pickedEdgeKeys = orderKind === "edges" ? new Set(picked) : new Set<string>();
  const pickedNodeSet = orderKind === "nodes" ? new Set(picked) : new Set<string>();

  function tryPickNode(id: string) {
    if (done) return;
    // Edge mode: two clicks form an edge.
    if (orderKind === "edges") {
      if (pendingEdgeFirst === null) {
        setPendingEdgeFirst(id);
        return;
      }
      if (pendingEdgeFirst === id) {
        setPendingEdgeFirst(null);
        return;
      }
      const a = pendingEdgeFirst;
      const b = id;
      if (!adjacent[a]?.has(b)) {
        flashWrong(`${a}-${b}`);
        setPendingEdgeFirst(null);
        return;
      }
      const key1 = `${a}-${b}`;
      const key2 = `${b}-${a}`;
      const expected = expectedOrder[picked.length];
      if (expected === key1 || expected === key2) {
        const next = [...picked, expected];
        setPicked(next);
        setPendingEdgeFirst(null);
        if (next.length === expectedOrder.length) finish("correct", next);
      } else {
        flashWrong(key1);
        setPendingEdgeFirst(null);
      }
      return;
    }

    // Node mode
    const expected = expectedOrder[picked.length];
    if (id === expected) {
      const next = [...picked, id];
      setPicked(next);
      if (next.length === expectedOrder.length) finish("correct", next);
    } else {
      flashWrong(id);
    }
  }

  function flashWrong(key: string) {
    setWrongFlash(key);
    window.setTimeout(() => setWrongFlash(null), 700);
  }

  function undo() {
    if (done) return;
    if (pendingEdgeFirst !== null) {
      setPendingEdgeFirst(null);
      return;
    }
    setPicked((p) => p.slice(0, -1));
  }

  function giveUp() {
    finish("incorrect", picked);
  }

  function finish(outcome: "correct" | "incorrect", final: string[]) {
    setDone(outcome);
    onAnswered?.(outcome);
    void final; // kept for debugging / future review-history persistence
  }

  function reset() {
    setPicked([]);
    setPendingEdgeFirst(null);
    setDone(null);
    setWrongFlash(null);
  }

  const stepLabel =
    algorithm === "bfs"       ? "discovery order"
    : algorithm === "dfs-preorder"  ? "pre-order (enter) order"
    : algorithm === "dfs-postorder" ? "post-order (finish) order"
    : algorithm === "dijkstra"      ? "extract order"
    : algorithm === "prim"          ? "node-added-to-tree order"
    : algorithm === "kruskal"       ? "edge-added-to-MST order (pick two endpoints)"
    : algorithm === "topo-sort"     ? "valid topological order"
    : "visit order";

  return (
    <Frame className="p-6!">
      <Eyebrow>graph walk · {algorithm.toUpperCase()} {source ? `from ${source}` : ""}</Eyebrow>
      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h3 className="m-0">{question.prompt}</h3>
        <span className="flex-1" />
        <Chip tone="sky">{stepLabel}</Chip>
      </div>
      {tieBreak && (
        <p className="serif mt-2 text-[13px] text-(--ink-3) italic">
          Tie-break: {tieBreak}
        </p>
      )}

      <svg
        viewBox="0 0 720 440"
        width="100%"
        className="mt-4"
        style={{
          border: "2px solid var(--ink)",
          borderRadius: 12,
          background: "var(--paper-2)",
          maxHeight: 460,
          cursor: done ? "default" : "pointer",
        }}
      >
        {/* Edges */}
        {graph.edges.map((e, i) => {
          const a = graph.nodes.find((n) => n.id === e.from);
          const b = graph.nodes.find((n) => n.id === e.to);
          if (!a || !b) return null;
          const key1 = `${e.from}-${e.to}`;
          const key2 = `${e.to}-${e.from}`;
          const isPicked = pickedEdgeKeys.has(key1) || pickedEdgeKeys.has(key2);
          const isWrong = wrongFlash === key1 || wrongFlash === key2;
          return (
            <g key={i}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isWrong ? "var(--wrong)" : isPicked ? "var(--pop)" : "var(--ink-2)"}
                strokeWidth={isPicked ? 3 : 1.5}
                strokeDasharray={isPicked ? undefined : "4 3"}
                markerEnd={graph.directed ? "url(#arr)" : undefined}
              />
              {e.weight !== undefined && (
                <text
                  x={(a.x + b.x) / 2 + 6}
                  y={(a.y + b.y) / 2 - 6}
                  fontFamily="var(--ff-mono)"
                  fontSize={11}
                  fill="var(--ink-2)"
                >
                  {e.weight}
                </text>
              )}
            </g>
          );
        })}
        {graph.directed && (
          <defs>
            <marker id="arr" markerWidth="10" markerHeight="7" refX="26" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--ink-2)" />
            </marker>
          </defs>
        )}

        {/* Nodes */}
        {graph.nodes.map((n) => {
          const idx = picked.indexOf(n.id);
          const isPicked = orderKind === "nodes" && idx >= 0;
          const isPending = pendingEdgeFirst === n.id;
          const isWrong = wrongFlash?.includes(n.id);
          return (
            <g
              key={n.id}
              onClick={() => tryPickNode(n.id)}
              style={{ cursor: done ? "default" : "pointer" }}
            >
              <circle
                cx={n.x} cy={n.y}
                r={26}
                fill={
                  isWrong ? "color-mix(in oklch, var(--wrong) 40%, var(--paper))"
                  : isPicked ? "var(--hl)"
                  : isPending ? "var(--hl-2)"
                  : "var(--paper)"
                }
                stroke="var(--ink)"
                strokeWidth={2}
              />
              <text
                x={n.x} y={n.y + 5}
                textAnchor="middle"
                fontFamily="var(--ff-display)"
                fontSize={18}
                fontWeight={700}
                fill="var(--ink)"
              >
                {n.id}
              </text>
              {isPicked && orderKind === "nodes" && (
                <text
                  x={n.x + 22} y={n.y - 20}
                  textAnchor="middle"
                  fontFamily="var(--ff-mono)"
                  fontSize={11}
                  fontWeight={700}
                  fill="var(--pop-ink)"
                >
                  #{idx + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <MiniLabel>your picks:</MiniLabel>
        <code className="mono text-[13px]">
          {picked.length === 0 ? <span className="text-(--ink-3)">(none)</span> : picked.join(" → ")}
        </code>
        <span className="flex-1" />
        <MiniLabel>progress:</MiniLabel>
        <Chip tone={done === "correct" ? "mint" : done === "incorrect" ? "amber" : "soft"}>
          {picked.length} / {expectedOrder.length}
        </Chip>
      </div>

      {!done ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" onClick={undo} disabled={picked.length === 0 && pendingEdgeFirst === null}>
            <Undo2 size={14} /> undo
          </Button>
          <Button variant="ghost" onClick={reset}>
            <RotateCcw size={14} /> reset
          </Button>
          <span className="flex-1" />
          <Button variant="ghost" onClick={giveUp}>
            Give up · see answer
          </Button>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 p-4"
          style={{
            border: "1.5px solid var(--ink)",
            borderRadius: 10,
            background: done === "correct" ? "var(--hl-2)" : "color-mix(in oklch, var(--wrong) 12%, var(--paper))",
          }}
        >
          <div className="flex items-center gap-2">
            {done === "correct" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            <strong>
              {done === "correct" ? "Nailed the order." : "Expected order:"}
            </strong>
          </div>
          <div className="mono mt-2 text-[13px]">
            {expectedOrder.join(" → ")}
          </div>
          {question.explanation && (
            <div className="serif mt-2 text-[14px] text-(--ink-2) italic">
              {question.explanation}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="pop" onClick={reset}>Try again</Button>
          </div>
        </motion.div>
      )}
    </Frame>
  );
}
