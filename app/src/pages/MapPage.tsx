import { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Link } from "@tanstack/react-router";
import {
  allTopics,
  edges as kbEdges,
  unitLabel,
  getTopic,
  UNIT_LABELS,
} from "@/lib/kb-loader";
import { useLiveQuery } from "dexie-react-hooks";
import { db, type MasteryLevel } from "@/lib/db";
import { Frame, Chip, Eyebrow, MasteryBar, Button, MiniLabel } from "@/components/notebook";
import { MarkdownBlock } from "@/components/content/MarkdownBlock";

const UNIT_COLORS: Record<string, string> = {
  "00-foundations": "oklch(0.92 0.08 70)",
  "01-processes": "oklch(0.92 0.08 140)",
  "02-scheduling": "oklch(0.9 0.09 200)",
  "03-memory": "oklch(0.9 0.09 260)",
  "04-concurrency": "oklch(0.92 0.08 40)",
  "05-deadlock": "oklch(0.9 0.09 100)",
  "06-persistence": "oklch(0.9 0.09 170)",
  "07-exam-prep": "oklch(0.9 0.09 230)",
};

interface TopicNodeData extends Record<string, unknown> {
  title: string;
  unit: string;
  mastery: MasteryLevel;
  recommended: boolean;
}

function TopicNode({ data }: NodeProps<Node<TopicNodeData>>) {
  const bg = UNIT_COLORS[data.unit] ?? "var(--paper)";
  return (
    <div
      style={{
        background: data.mastery >= 4 ? "var(--hl-2)" : data.mastery > 0 ? "var(--hl)" : bg,
        border: "2px solid var(--ink)",
        borderRadius: 10,
        padding: "8px 12px",
        boxShadow: data.recommended
          ? "0 0 0 4px color-mix(in oklch, var(--pop) 40%, transparent), 3px 3px 0 rgba(0,0,0,0.12)"
          : "3px 3px 0 rgba(0,0,0,0.08)",
        minWidth: 180,
        maxWidth: 220,
        fontFamily: "var(--ff-body)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "var(--ink)", width: 6, height: 6 }} />
      <div style={{ fontFamily: "var(--ff-display)", fontSize: 20, lineHeight: 1.05, color: "var(--ink)" }}>
        {data.title}
      </div>
      <div style={{ fontFamily: "var(--ff-mono)", fontSize: 9, color: "var(--ink-3)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {UNIT_LABELS[data.unit] ?? data.unit}
      </div>
      <div style={{ marginTop: 6 }}>
        <MasteryBar level={data.mastery} />
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "var(--ink)", width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes = { topic: TopicNode };

export function MapPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const mastery = useLiveQuery(() => db.mastery.toArray()) ?? [];
  const mLookup = new Map(mastery.map((m) => [m.topicSlug, m.level]));

  // Recommend next: lowest-mastery topic whose prereqs are all ≥ 2
  const recommended = useMemo(() => {
    const topics = allTopics();
    const prereqOf = new Map<string, string[]>();
    for (const e of kbEdges().filter((e) => e.kind === "prereq")) {
      if (!prereqOf.has(e.to)) prereqOf.set(e.to, []);
      prereqOf.get(e.to)!.push(e.from);
    }
    const candidate = [...topics]
      .sort((a, b) => (mLookup.get(a.slug) ?? 0) - (mLookup.get(b.slug) ?? 0))
      .find((t) => {
        const lv = mLookup.get(t.slug) ?? 0;
        if (lv >= 4) return false;
        const pre = prereqOf.get(t.slug) ?? [];
        return pre.every((p) => (mLookup.get(p) ?? 0) >= 2);
      });
    return candidate?.slug ?? null;
  }, [mLookup]);

  const { nodes, edges } = useMemo(() => {
    const topics = allTopics();
    const e = kbEdges();

    // Simple deterministic layout — column per unit, row per topic in unit.
    const unitOrder = Object.keys(UNIT_COLORS);
    const colWidth = 260;
    const rowHeight = 110;
    const byUnit = new Map<string, typeof topics>();
    for (const t of topics) {
      if (!byUnit.has(t.unit)) byUnit.set(t.unit, []);
      byUnit.get(t.unit)!.push(t);
    }

    const nodes: Node<TopicNodeData>[] = [];
    unitOrder.forEach((unit, col) => {
      const unitTopics = byUnit.get(unit) ?? [];
      unitTopics.forEach((t, row) => {
        nodes.push({
          id: t.slug,
          type: "topic",
          data: {
            title: t.title,
            unit: t.unit,
            mastery: (mLookup.get(t.slug) ?? 0) as MasteryLevel,
            recommended: t.slug === recommended,
          },
          position: { x: col * colWidth, y: row * rowHeight },
        });
      });
    });

    const edges: Edge[] = e.map((edge, idx) => ({
      id: `e-${idx}`,
      source: edge.from,
      target: edge.to,
      animated: edge.kind === "prereq" && edge.to === recommended,
      style: {
        stroke: edge.kind === "prereq" ? "var(--ink-2)" : "var(--ink-3)",
        strokeWidth: edge.kind === "prereq" ? 1.5 : 1,
        strokeDasharray: edge.kind === "related" ? "4 4" : undefined,
      },
    }));

    return { nodes, edges };
  }, [mLookup, recommended]);

  const selectedTopic = selected ? getTopic(selected) : null;

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelected(node.id);
  }, []);

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0, 1fr) 360px", minHeight: 720 }}>
      <Frame className="overflow-hidden p-0!" style={{ minHeight: 720 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--ink-3)" gap={24} size={1} />
          <Controls position="bottom-right" showInteractive={false} />
          <MiniMap
            pannable
            zoomable
            nodeColor={(n) => UNIT_COLORS[(n.data?.unit as string) ?? ""] ?? "#fff"}
            style={{ background: "var(--paper-2)" }}
          />
        </ReactFlow>
      </Frame>

      <aside className="sticky top-4 flex flex-col gap-4 self-start">
        <Frame>
          <Eyebrow>legend</Eyebrow>
          <div className="mt-2 flex flex-col gap-2">
            {Object.entries(UNIT_LABELS).map(([u, label]) => (
              <div key={u} className="flex items-center gap-2">
                <span
                  style={{
                    width: 16, height: 16, borderRadius: 4,
                    border: "1.5px solid var(--ink)",
                    background: UNIT_COLORS[u] ?? "var(--paper)",
                  }}
                />
                <span className="serif text-[13px]">{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip tone="hl">in progress</Chip>
            <Chip tone="mint">mastered</Chip>
            <Chip tone="pop">recommended next</Chip>
          </div>
        </Frame>

        {selectedTopic ? (
          <Frame>
            <Eyebrow>{unitLabel(selectedTopic.unit)}</Eyebrow>
            <h3 className="mt-1">{selectedTopic.title}</h3>
            <div className="mt-2">
              <MasteryBar level={(mLookup.get(selectedTopic.slug) ?? 0) as MasteryLevel} />
            </div>
            {selectedTopic.hook && (
              <p className="serif mt-3 text-[13px] text-(--ink-2) italic">{selectedTopic.hook}</p>
            )}
            {selectedTopic.complexity?.worst && (
              <div className="mt-3">
                <MiniLabel>worst case</MiniLabel>
                <div className="mono text-[13px]">{selectedTopic.complexity.worst}</div>
              </div>
            )}
            {selectedTopic.sections[0] && (
              <MarkdownBlock source={selectedTopic.sections[0].body.slice(0, 280) + "…"} className="mt-3 text-[13px]" />
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/learn/$" params={{ _splat: selectedTopic.slug }} className="btn-sk pop">
                Start learning →
              </Link>
              <Link to="/algorithms/$" params={{ _splat: selectedTopic.slug }} className="btn-sk ghost">
                Full reference
              </Link>
              <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </Frame>
        ) : (
          <Frame>
            <Eyebrow>click a node</Eyebrow>
            <h3 className="mt-1">The whole course, on one canvas.</h3>
            <p className="serif mt-2 text-[13px] text-(--ink-2) italic">
              Nodes are topics. Solid lines are prerequisite edges — the thing at the tail must be understood
              before the thing at the head. Dashed lines are "also related to". Pan with drag, zoom with scroll.
            </p>
            {recommended && (
              <div className="mt-3">
                <MiniLabel>recommended next</MiniLabel>
                <div className="mt-1">
                  <Link to="/learn/$" params={{ _splat: recommended }} className="display text-[18px] underline decoration-dashed">
                    {getTopic(recommended)?.title} →
                  </Link>
                </div>
                <p className="serif mt-1 text-[12px] text-(--ink-2) italic">
                  Lowest-mastery topic whose prereqs you've at least been exposed to.
                </p>
              </div>
            )}
          </Frame>
        )}
      </aside>
    </div>
  );
}
