import { Button, Chip, Eyebrow, Frame, MiniLabel, ProgressBar } from "@/components/notebook";
import { Play } from "lucide-react";

type Kind = "learn" | "practice" | "review" | "check";

const KIND_STYLES: Record<Kind, { bg: string; text: string }> = {
  learn:    { bg: "var(--hl-3)", text: "var(--ink)" },
  practice: { bg: "var(--hl)",    text: "var(--ink)" },
  review:   { bg: "var(--hl-2)",  text: "var(--ink)" },
  check:    { bg: "var(--pop)",   text: "#fff" },
};

const RECIPE: { time: string; kind: Kind; title: string; desc: string; cta: string }[] = [
  { time: "00:00 →", kind: "learn",    title: "What MLFQ scheduling actually does", desc: "Plain-English walkthrough of priority boosting.",     cta: "▸ open" },
  { time: "~10 min", kind: "practice", title: "Five scheduling traces",                         desc: "Pick one. Compute turnaround & response.",          cta: "▸ solve" },
  { time: "~20 min", kind: "review",   title: "Old page-table walk questions",                   desc: "Three from Week 3 that didn't stick.",           cta: "▸ revisit" },
  { time: "~35 min", kind: "practice", title: "Mini-derivation",                                desc: "Show why this scheduler is unfair.",                  cta: "▸ pulse" },
  { time: "~42 min", kind: "check",    title: "30-second reflect",                              desc: "What felt solid. What didn't.",                   cta: "▸ check" },
];

export function TodaysAgendaView() {
  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 300px" }}>
      <Frame className="!px-9 !py-8">
        <Eyebrow>Wednesday · 45 min budgeted</Eyebrow>
        <h1 className="mt-3">Today, you'll really <span className="highlighter">get</span> MLFQ scheduling.</h1>
        <p className="serif italic mt-3 text-[var(--ink-2)] max-w-[60ch]">
          Less "read more, somehow retain it"; more "prove it to yourself five times in five ways."
        </p>

        <div className="mt-6">
          {RECIPE.map((row, i, arr) => (
            <div
              key={i}
              className="flex items-center gap-4 py-3"
              style={{ borderBottom: i < arr.length - 1 ? "1px dashed var(--rule)" : "none" }}
            >
              <span className="mono text-[12px] text-[var(--ink-3)] w-16">{row.time}</span>
              <span
                className="px-2 py-[2px] rounded mono text-[10px] uppercase tracking-wider font-semibold"
                style={{
                  border: "1.5px solid var(--ink)",
                  background: KIND_STYLES[row.kind].bg,
                  color: KIND_STYLES[row.kind].text,
                }}
              >
                {row.kind}
              </span>
              <div className="flex-1">
                <h4 className="mb-1">{row.title}</h4>
                <div className="text-[13px] text-[var(--ink-2)]">{row.desc}</div>
              </div>
              <Button>{row.cta}</Button>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3 items-center">
          <Button variant="pop" size="big"><Play size={18} /> Start at step 1</Button>
          <Button variant="ghost">Shorten to 20 min</Button>
          <Button variant="ghost">Lengthen to 90 min</Button>
        </div>
      </Frame>

      <div className="flex flex-col gap-4">
        <Frame padded>
          <h3>On the review queue</h3>
          <MiniLabel>topics coming back, ranked by how shaky</MiniLabel>
          <div className="mt-3 flex flex-col gap-2">
            {[
              { t: "page-table walks",      f: "mod 03 · seen 3× · hit 50%",   m: 2 },
              { t: "context switching",     f: "mod 01 · seen 2× · hit 100%",  m: 4 },
              { t: "scheduling metrics",    f: "mod 02 · seen 4× · hit 75%",   m: 3 },
              { t: "deadlock recovery",     f: "mod 05 · seen 1× · hit 0%",    m: 1 },
            ].map((row, i) => (
              <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: "1px dashed var(--rule)" }}>
                <div>
                  <div className="display text-lg leading-none">{row.t}</div>
                  <div className="mini-label">{row.f}</div>
                </div>
                <Chip tone={row.m >= 4 ? "mint" : row.m >= 3 ? "hl" : "amber"}>m {row.m}/5</Chip>
              </div>
            ))}
          </div>
        </Frame>

        <Frame>
          <h3>Overall progress</h3>
          <MiniLabel>covered in the course</MiniLabel>
          <div className="mt-3">
            <ProgressBar value={0.48} />
            <div className="mini-label mt-1">48% covered</div>
          </div>
          <div className="mt-4">
            <MiniLabel>mastered (passing spaced review)</MiniLabel>
            <div className="mt-1">
              <ProgressBar value={0.23} color="var(--hl)" />
              <div className="mini-label mt-1">23% mastered</div>
            </div>
          </div>
        </Frame>
      </div>
    </div>
  );
}
