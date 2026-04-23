import { useParams, Link } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import {
  getTopic,
  unitLabel,
  prereqsFor,
  dependentsOf,
  tracesFor,
  type KbSection,
} from "@/lib/kb-loader";
import { ExamQuestionsQuiz } from "@/features/practice/ExamQuestionsQuiz";
import { Frame, Chip, Eyebrow, KeyIdea, MasteryBar, Button, MiniLabel } from "@/components/notebook";
import { MarkdownBlock } from "@/components/content/MarkdownBlock";
import { Pseudocode } from "@/components/content/Pseudocode";
import { TracePlayer } from "@/components/content/TracePlayer";
import { ComplexityCard } from "@/components/content/ComplexityCard";
import { StubPage } from "./_stub";
import { db, type MasteryLevel } from "@/lib/db";
import { AlertTriangle } from "lucide-react";
import { vizFor } from "@/components/viz";
import { TutorDrawer } from "@/components/chrome/TutorDrawer";
import { useState } from "react";
import { MessageSquare } from "lucide-react";

const CANONICAL_ORDER = [
  /^definition$/i,
  /^when/i,
  /^pseudocode$/i,
  /^hand-trace|example/i,
  /^complexity/i,
  /^correctness|invariant/i,
  /^common exam questions|exam questions/i,
  /^gotcha|trap/i,
  /^notation/i,
  /^source/i,
];

function orderSections(sections: KbSection[]): KbSection[] {
  const buckets: KbSection[][] = CANONICAL_ORDER.map(() => []);
  const rest: KbSection[] = [];
  for (const s of sections) {
    const idx = CANONICAL_ORDER.findIndex((re) => re.test(s.heading));
    if (idx >= 0) buckets[idx].push(s);
    else rest.push(s);
  }
  return [...buckets.flat(), ...rest];
}

export function AlgorithmPage() {
  const params = useParams({ strict: false }) as { _splat?: string };
  const slug = params._splat ?? "";
  const topic = getTopic(slug);

  const mastery = useLiveQuery(() => db.mastery.get(slug));
  const [tutorOpen, setTutorOpen] = useState(false);

  if (!topic) {
    return (
      <StubPage
        title="Topic not found"
        description={`No KB entry at "${slug}". Check the slug or run bun kb.`}
        eyebrow="404 · algorithm"
      />
    );
  }

  const prereqs = prereqsFor(slug);
  const dependents = dependentsOf(slug);
  const traces = tracesFor(slug);
  const complexity = topic.complexity;
  const level = (mastery?.level ?? 0) as MasteryLevel;
  const viz = vizFor(slug);

  const ordered = orderSections(topic.sections);
  const def = ordered.find((s) => /^definition$/i.test(s.heading));
  const pseudoSection = ordered.find((s) => /pseudocode/i.test(s.heading));
  const traceSection = ordered.find((s) => /hand-trace|example/i.test(s.heading));

  const otherSections = ordered.filter(
    (s) => s !== def && s !== pseudoSection && s !== traceSection
  );

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0, 1fr) 320px" }}>
      <div className="flex min-w-0 flex-col gap-6">
        <Frame
          variant="dashed"
          className="px-4! py-3!"
          style={{ background: "var(--paper-2)" }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <Eyebrow>reference view · everything at once</Eyebrow>
            <span className="flex-1" />
            <Link to="/learn/$" params={{ _splat: slug }} className="btn-sk pop">
              Switch to step-by-step →
            </Link>
          </div>
        </Frame>

        <Frame className="p-8!">
          <Eyebrow>{unitLabel(topic.unit)} · {topic.handle}</Eyebrow>
          <h1 className="mt-2">{topic.title}</h1>
          {topic.hook && (
            <p className="serif mt-3 max-w-[70ch] text-[17px] text-(--ink-2) italic">
              {topic.hook}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Chip tone="sky">{topic.unit}</Chip>
            <MasteryBar level={level} />
            {topic.warnings.map((w, i) => (
              <Chip key={i} tone="amber">
                <AlertTriangle size={12} /> {w.slice(0, 46)}…
              </Chip>
            ))}
          </div>

          {complexity && (
            <div className="mt-5">
              <ComplexityCard complexity={complexity} />
            </div>
          )}
        </Frame>

        {def && (
          <Frame>
            <Eyebrow>definition</Eyebrow>
            <MarkdownBlock source={def.body} className="mt-2" />
          </Frame>
        )}

        {viz && (
          <Frame>
            <Eyebrow>crown-jewel visualization</Eyebrow>
            <h3 className="mt-1">{viz.title}</h3>
            <p className="serif mt-1 text-[14px] text-(--ink-2) italic">{viz.description}</p>
            <div className="mt-4">{viz.render()}</div>
          </Frame>
        )}

        {pseudoSection && topic.pseudocodes.length > 0 && (
          <Frame>
            <Eyebrow>pseudocode</Eyebrow>
            <div className="mt-2">
              <Pseudocode blocks={topic.pseudocodes} />
            </div>
          </Frame>
        )}

        {traceSection && (
          <Frame>
            <Eyebrow>hand-trace</Eyebrow>
            <MarkdownBlock source={traceSection.body} className="mt-2" />
            {traces.length > 0 && (
              <div className="mt-4">
                <KeyIdea title="Interactive trace player">
                  Step through the hand-trace below. Each row of the table is one discrete step.
                </KeyIdea>
                <TracePlayer table={traces[0]} />
              </div>
            )}
          </Frame>
        )}

        {otherSections.map((s) =>
          /common exam questions|exam questions/i.test(s.heading) ? (
            <ExamQuestionsQuiz
              key={s.heading}
              topicSlug={slug}
              topicTitle={topic.title}
            />
          ) : (
            <Frame key={s.heading}>
              <Eyebrow>{s.heading}</Eyebrow>
              <MarkdownBlock source={s.body} className="mt-2" />
            </Frame>
          )
        )}

        <div className="flex flex-wrap gap-3">
          <Link to="/" className="btn-sk">← Hub</Link>
          <Link to="/map" className="btn-sk ghost">See on the map</Link>
          <Link to="/module/$moduleId" params={{ moduleId: topic.unit }} className="btn-sk ghost">
            {unitLabel(topic.unit)} module
          </Link>
          <Link to="/feynman" search={{ topic: slug } as never} className="btn-sk primary">
            Explain this back →
          </Link>
          <Button onClick={() => setTutorOpen(true)}>
            <MessageSquare size={14} /> Ask the tutor
          </Button>
        </div>
        <TutorDrawer topicSlug={slug} open={tutorOpen} onClose={() => setTutorOpen(false)} />
      </div>

      <aside className="sticky top-4 flex flex-col gap-4 self-start">
        <Frame>
          <Eyebrow>prereqs</Eyebrow>
          {prereqs.length === 0 ? (
            <MiniLabel>none — foundation topic</MiniLabel>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {prereqs.map((p) => {
                const pt = getTopic(p);
                return (
                  <li key={p}>
                    <Link to="/learn/$" params={{ _splat: p }} className="underline decoration-dashed">
                      {pt?.title ?? p}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Frame>

        <Frame>
          <Eyebrow>feeds into</Eyebrow>
          {dependents.length === 0 ? (
            <MiniLabel>nothing downstream yet</MiniLabel>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {dependents.map((d) => {
                const dt = getTopic(d);
                return (
                  <li key={d}>
                    <Link to="/learn/$" params={{ _splat: d }} className="underline decoration-dashed">
                      {dt?.title ?? d}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Frame>

        <Frame>
          <Eyebrow>actions</Eyebrow>
          <div className="mt-2 flex flex-col gap-2">
            <Button
              onClick={async () => {
                const current = await db.mastery.get(slug);
                const newLevel = Math.min(5, (current?.level ?? 0) + 1) as MasteryLevel;
                await db.mastery.put({
                  topicSlug: slug,
                  level: newLevel,
                  correctStreak: (current?.correctStreak ?? 0) + 1,
                  lastReviewed: Date.now(),
                  nextReview: null,
                  updatedAt: Date.now(),
                });
              }}
            >
              Bump mastery +1
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await db.flagged.put({ topicSlug: slug, reason: "manual park", createdAt: Date.now() });
                alert("Flagged for re-visit.");
              }}
            >
              Park this · revisit later
            </Button>
          </div>
        </Frame>

        {topic.sources.length > 0 && (
          <Frame>
            <Eyebrow>sources</Eyebrow>
            <ul className="mono mt-2 flex flex-col gap-1 text-[11px] text-(--ink-2)">
              {topic.sources.map((s, i) => <li key={i}>· {s}</li>)}
            </ul>
          </Frame>
        )}
      </aside>
    </div>
  );
}
