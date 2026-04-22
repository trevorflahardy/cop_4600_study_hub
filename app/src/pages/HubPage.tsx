import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Timer, ArrowRight } from "lucide-react";
import { TabsCanvas, Frame, Eyebrow, Highlighter, Chip, MiniLabel } from "@/components/notebook";
import { StudySessionView } from "@/features/study-session/StudySessionView";
import { TodaysAgendaView } from "@/features/agenda/TodaysAgendaView";
import { SyllabusView } from "@/features/syllabus/SyllabusView";
import { quizzesFromBank } from "@/lib/kb-loader";

const TABS = [
  { id: "session",  num: "01", label: "Study session" },
  { id: "final",    num: "02", label: "Final exam prep" },
  { id: "agenda",   num: "03", label: "Today's agenda" },
  { id: "syllabus", num: "04", label: "Syllabus · journey" },
];

export function HubPage() {
  const [active, setActive] = useState("session");

  return (
    <TabsCanvas tabs={TABS} active={active} onChange={setActive}>
      {active === "session" && <StudySessionView />}
      {active === "final" && <FinalExamTeaser />}
      {active === "agenda" && <TodaysAgendaView />}
      {active === "syllabus" && <SyllabusView />}
    </TabsCanvas>
  );
}

/**
 * Hub-tab entry-point for the final exam prep flow. This isn't the full page
 * (that lives at `/final`); it's a teaser / quick-launch that shows how the
 * final-exam bank is structured and links straight into the four drill modes.
 */
function FinalExamTeaser() {
  const bank = quizzesFromBank();
  const counts = {
    graph: bank.filter((q) => q.kind === "graph-walk").length,
    pseudo: bank.filter((q) => q.kind === "pseudocode").length,
    runtime: bank.filter((q) => q.kind === "runtime").length,
    mcq: bank.filter((q) => q.kind === "mcq").length,
  };

  return (
    <div className="flex flex-col gap-6">
      <Frame variant="wobble" shadow="card" className="!p-8">
        <Eyebrow>final exam · prep mode</Eyebrow>
        <h1 className="mt-3">
          Dry-run the final in the <Highlighter>exact shape</Highlighter> of your past exams.
        </h1>
        <p className="mt-3 serif italic text-[var(--ink-2)] max-w-[62ch]">
          Practice problems covering the full OS curriculum: scheduling, memory management,
          process/thread synchronization, file systems, and more. Each topic has interactive
          traces and pseudocode analysis.
        </p>
        <div className="mt-4 flex gap-3 flex-wrap">
          <Link to="/final" search={{ mode: "simulator" }} className="btn-sk pop big">
            <Timer size={18} /> Start simulator
          </Link>
          <Link to="/final" className="btn-sk ghost">
            Pick a focused drill →
          </Link>
        </div>
      </Frame>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {counts.graph > 0 && <TeaserTile kicker="TRACES"     title="Scheduler & deadlock traces"    count={counts.graph}   href="graph"   />}
        {counts.pseudo > 0 && <TeaserTile kicker="PSEUDOCODE"  title="Write it out · Ollama grades"    count={counts.pseudo}  href="pseudo"  />}
        {counts.runtime > 0 && <TeaserTile kicker="COMPLEXITY"  title="Best / avg / worst / space"      count={counts.runtime} href="runtime" />}
        <TeaserTile kicker="MCQ"         title="Exam-style traps & gotchas"      count={counts.mcq}     href="mcq"     />
      </div>

      <Frame variant="soft">
        <Eyebrow>what's in the final (predicted)</Eyebrow>
        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          <div>
            <MiniLabel>part 1 · 16 MCQ · 40 pts</MiniLabel>
            <p className="serif text-[14px] mt-2">
              Cumulative: CPU scheduling, memory management & paging,
              synchronization, deadlock, and file systems.
            </p>
          </div>
          <div>
            <MiniLabel>part 2 · long-form · ~60 pts</MiniLabel>
            <p className="serif text-[14px] mt-2">
              Trace a scheduler over a mixed workload, analyze a page replacement strategy, solve a deadlock
              scenario, and tackle one integrative problem spanning multiple OS topics.
            </p>
          </div>
        </div>
      </Frame>
    </div>
  );
}

function TeaserTile({ kicker, title, count, href }: {
  kicker: string;
  title: string;
  count: number;
  href: "graph" | "pseudo" | "runtime" | "mcq";
}) {
  return (
    <Link
      to="/final"
      search={{ mode: href }}
      style={{
        display: "block",
        border: "1.5px solid var(--ink)",
        borderRadius: 10,
        padding: 16,
        background: "var(--paper)",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div className="flex items-center gap-2">
        <MiniLabel>{kicker}</MiniLabel>
        <span className="flex-1" />
        <Chip tone="soft">{count}</Chip>
      </div>
      <h4 className="mt-2">{title}</h4>
      <div className="mt-3 flex justify-end text-[13px] mono">
        start <ArrowRight size={14} />
      </div>
    </Link>
  );
}
