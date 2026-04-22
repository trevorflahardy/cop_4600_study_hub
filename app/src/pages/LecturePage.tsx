import { useParams, Link } from "@tanstack/react-router";
import { getTopic, unitLabel } from "@/lib/kb-loader";
import { StubPage } from "./_stub";
import { Frame, Chip, Eyebrow, KeyIdea, MiniLabel } from "@/components/notebook";
import { MarkdownBlock } from "@/components/content/MarkdownBlock";
import { ComplexityCard } from "@/components/content/ComplexityCard";
import { Pseudocode } from "@/components/content/Pseudocode";
import { useState, type ChangeEvent } from "react";

/** M&Q V2 — mini-lecture view. One concept, one "stage", notes aside. */
export function LecturePage() {
  const { moduleId, lessonId } = useParams({ strict: false }) as { moduleId: string; lessonId: string };
  // lessonId is a slug fragment; we resolve the topic by combining.
  const slug = moduleId + "/" + lessonId;
  const topic = getTopic(slug);
  const [note, setNote] = useState("");

  if (!topic) {
    return (
      <StubPage
        title="Lesson not found"
        description={`No KB entry at "${slug}".`}
        eyebrow="404 · lesson"
      />
    );
  }

  const definition = topic.sections.find((s) => /^definition/i.test(s.heading));
  const keyIdeas = topic.sections.filter((s) => /correctness|invariant|key idea|property/i.test(s.heading));

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "1.7fr 1fr" }}>
      <div className="flex flex-col gap-6 min-w-0">
        <div>
          <Eyebrow>lesson · {unitLabel(moduleId)} · ~12 min</Eyebrow>
          <h1 className="mt-2">{topic.title}</h1>
          {topic.hook && <p className="serif italic text-[var(--ink-2)] mt-2">{topic.hook}</p>}
        </div>

        <div className="stage">
          <div className="mono text-[10px] uppercase tracking-wider text-[var(--ink-3)]">▶ animated derivation</div>
          <div className="display text-4xl mt-3">{topic.title}</div>
          <p className="serif italic mt-3 max-w-[56ch]">
            {definition
              ? definition.body.replace(/```[\s\S]*?```/g, "").split(/\.\s+/)[0] + "."
              : "Play to walk through the concept step-by-step. (Visualization in Phase 4.)"}
          </p>
          <div className="absolute top-3 right-3">
            <Chip tone="pop">stage placeholder</Chip>
          </div>
        </div>

        {topic.complexity && <ComplexityCard complexity={topic.complexity} />}

        {definition && (
          <Frame>
            <Eyebrow>the whole story, in prose</Eyebrow>
            <MarkdownBlock source={definition.body} className="mt-2" />
          </Frame>
        )}

        {topic.pseudocodes.length > 0 && (
          <Frame>
            <Eyebrow>pseudocode</Eyebrow>
            <div className="mt-2"><Pseudocode blocks={topic.pseudocodes} /></div>
          </Frame>
        )}

        {keyIdeas.map((s) => (
          <Frame key={s.heading}>
            <Eyebrow>{s.heading}</Eyebrow>
            <MarkdownBlock source={s.body} className="mt-2" />
          </Frame>
        ))}

        <div className="flex gap-3 items-center flex-wrap">
          <Link
            to="/module/$moduleId/lesson/$lessonId/practice"
            params={{ moduleId, lessonId }}
            className="btn-sk pop big"
          >
            Practice set · 5 problems →
          </Link>
          <Link to="/algorithms/$" params={{ _splat: slug }} className="btn-sk ghost">
            Open full entry
          </Link>
        </div>
      </div>

      <aside className="flex flex-col gap-3 sticky top-4 self-start">
        <div>
          <h3>Notes</h3>
          <MiniLabel>auto-captured key points · click to jump</MiniLabel>
        </div>

        {keyIdeas.slice(0, 3).map((s, i) => (
          <div key={i} className="note auto">
            <span className="time">auto · {i === 0 ? "0:45" : i === 1 ? "3:20" : "7:10"}</span>
            <p className="mt-1">{(s.body.replace(/```[\s\S]*?```/g, "").split(/\n/)[0] || "").slice(0, 140)}…</p>
          </div>
        ))}

        <div className={"note " + (note.trim() ? "user" : "")}>
          <span className="time">yours · unsaved</span>
          <textarea
            className="w-full mt-1 serif text-[14px]"
            style={{ background: "transparent", outline: "none", border: "none", resize: "vertical", minHeight: 60 }}
            placeholder="your own notes here…"
            value={note}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
          />
        </div>

        <div className="ask-box">
          <h4>Ask about this</h4>
          <div className="field">
            Paused — type a question. (Ollama-backed tutor chat ships in Phase 5.)
          </div>
        </div>
      </aside>
    </div>
  );
}
