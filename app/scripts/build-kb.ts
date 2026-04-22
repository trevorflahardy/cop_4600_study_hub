#!/usr/bin/env bun
/*
 * KB ingest pipeline — parses ../kb/**\/*.md into structured JSON bundles.
 *
 * Output (relative to app/src/data/):
 *   kb.json           every topic with title, sections, pseudocode, links, body
 *   graph.json        concept-graph edges (prereq/related)
 *   flashcards.json   7 card types per topic (where derivable)
 *   quizzes.json      MCQ + short-answer bank
 *   rubrics.json      Feynman rubric per topic
 *   traces.json       parsed hand-trace tables
 *
 * Run manually: bun scripts/build-kb.ts
 * Auto-runs via predev / prebuild hooks.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, relative, sep, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = fileURLToPath(new URL(".", import.meta.url));
const APP_ROOT = join(scriptDir, "..");
const KB_ROOT = join(APP_ROOT, "..", "kb");
const DATA_DIR = join(APP_ROOT, "src", "data");

interface Section {
  heading: string;
  slug: string;
  body: string;
}

interface Pseudocode {
  title: string | null;
  lines: string[];
  language?: string;
}

interface TraceTable {
  id: string;
  caption?: string;
  headers: string[];
  rows: string[][];
}

interface Complexity {
  best?: string;
  avg?: string;
  worst?: string;
  space?: string;
  stable?: boolean;
  inPlace?: boolean;
  notes?: string;
}

interface Topic {
  slug: string;
  unit: string;
  file: string;
  title: string;
  handle: string;
  hook: string | null;
  sections: Section[];
  pseudocodes: Pseudocode[];
  traceIds: string[];
  relatedSlugs: string[];
  complexity: Complexity | null;
  warnings: string[];
  body: string;
  examQuestions: string[];
  gotchas: string[];
  sources: string[];
}

interface GraphEdge {
  from: string;
  to: string;
  kind: "prereq" | "related" | "contradicts";
}

interface Flashcard {
  id: string;
  topicSlug: string;
  cardType:
    | "term2def"
    | "def2term"
    | "concept2example"
    | "concept2consequence"
    | "code2name"
    | "complexity"
    | "feynman";
  front: string;
  back: string;
  tags: string[];
}

interface QuizQuestion {
  id: string;
  topicSlug: string;
  kind: "mcq" | "short" | "scenario";
  prompt: string;
  choices?: { text: string; correct: boolean; why?: string }[];
  answer?: string;
  explanation?: string;
  difficulty: "gentle" | "firm" | "tricky";
  source: "kb" | "traps" | "practice";
}

interface Rubric {
  topicSlug: string;
  items: { id: string; prompt: string; weight: number }[];
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    if (name.isDirectory()) walk(full, acc);
    else if (name.isFile() && name.name.endsWith(".md")) acc.push(full);
  }
  return acc;
}

function ensure(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function slugFor(file: string): string {
  return relative(KB_ROOT, file).replace(/\.md$/, "").split(sep).join("/");
}

function headingSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function stripEm(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

function firstSentence(md: string): string {
  const clean = md.replace(/```[\s\S]*?```/g, "").replace(/\n{2,}/g, "\n").trim();
  const m = clean.match(/^(.*?[.!?])(?:\s|$)/s);
  return (m ? m[1] : clean.split("\n")[0] ?? "").trim();
}

function stripMd(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*?/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function splitSections(md: string): { title: string; sections: Section[] } {
  const lines = md.split("\n");
  const titleLine = lines.find((l) => /^#\s+/.test(l)) ?? "";
  const title = titleLine.replace(/^#\s+/, "").trim();
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      if (current) sections.push(current);
      const heading = h2[1].trim();
      current = { heading, slug: headingSlug(heading), body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current) sections.push(current);
  for (const s of sections) s.body = s.body.trim();
  return { title, sections };
}

function extractCodeBlocks(md: string): { language: string; content: string }[] {
  const out: { language: string; content: string }[] = [];
  const re = /```(\w+)?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md))) out.push({ language: m[1] ?? "", content: m[2].trimEnd() });
  return out;
}

function extractPseudocodes(sections: Section[]): Pseudocode[] {
  const pcSection = sections.find((s) => /pseudocode/i.test(s.heading));
  if (!pcSection) return [];
  const blocks = extractCodeBlocks(pcSection.body);
  return blocks.map((b, i) => ({
    title: i === 0 ? "main" : `variant-${i}`,
    lines: b.content.split("\n"),
    language: b.language || undefined,
  }));
}

function extractTraceTables(sections: Section[], slug: string): TraceTable[] {
  const traceSection = sections.find((s) => /hand-trace|example|trace/i.test(s.heading));
  if (!traceSection) return [];
  const out: TraceTable[] = [];
  const lines = traceSection.body.split("\n");
  let headers: string[] | null = null;
  let rows: string[][] = [];
  let tableIdx = 0;

  const flush = () => {
    if (headers && rows.length > 0) {
      out.push({ id: slug + "::table-" + tableIdx++, headers, rows });
    }
    headers = null;
    rows = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("|") && t.endsWith("|")) {
      const cells = t.slice(1, -1).split("|").map((c) => c.trim());
      if (headers === null) {
        headers = cells;
      } else if (cells.every((c) => /^[:\-\s]+$/.test(c))) {
        continue;
      } else {
        rows.push(cells);
      }
    } else if (t === "" && headers !== null) {
      flush();
    }
  }
  flush();
  return out;
}

function parseComplexity(sections: Section[]): Complexity | null {
  const cs = sections.find((s) => /complexity/i.test(s.heading));
  if (!cs) return null;
  const out: Complexity = {};
  const body = cs.body;

  const grab = (label: RegExp): string | undefined => {
    const m = body.match(new RegExp("\\*\\*" + label.source + "[^*]*\\*\\*[:\\s]*([^\\n]+)", "i"));
    if (m) return stripEm(m[1]).replace(/^[—\-–:\s]+/, "").trim();
    return undefined;
  };

  out.best = grab(/Best/);
  out.avg = grab(/Average/);
  out.worst = grab(/Worst/);
  out.space = grab(/Space/);

  if (/in[- ]place/i.test(body)) out.inPlace = !/not in[- ]place/i.test(body);
  if (/\bstable\b/i.test(body)) out.stable = !/not stable|unstable/i.test(body);
  return Object.keys(out).length ? out : null;
}

function extractRelatedSlugs(body: string, sourceFile: string, validSlugs: Set<string>): string[] {
  const out = new Set<string>();
  const re = /\]\(([^)]+\.md)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const target = m[1];
    const absTarget = join(dirname(sourceFile), target);
    const slug = slugFor(absTarget);
    if (validSlugs.has(slug)) out.add(slug);
  }
  return [...out];
}

function deriveHook(sections: Section[], title: string): string | null {
  const when = sections.find((s) => /when to use|when/i.test(s.heading));
  const def = sections.find((s) => /definition/i.test(s.heading));
  const source = (when?.body || def?.body || "").trim();
  if (!source) return null;
  const first = firstSentence(stripMd(source));
  return first || "Understand " + title + ".";
}

function deriveHandle(title: string): string {
  return title.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
}

function deriveWarnings(body: string, slug: string): string[] {
  const w: string[] = [];
  if (/inferred from CLRS|⚠|:warning:/i.test(body)) {
    w.push("Some content inferred from CLRS — verify against lecture slides.");
  }
  if (slug.endsWith("lcs") || slug.endsWith("matrix-chain-multiplication") || slug.endsWith("rod-cutting")) {
    w.push("Lecture coverage is light per MEMORY.md.");
  }
  if (slug.endsWith("hash-tables")) w.push("Open-addressing pseudocode may be absent from slides.");
  if (slug.endsWith("red-black-trees")) w.push("RB-DELETE-FIXUP is not covered in lectures.");
  if (slug.endsWith("strongly-connected-components")) w.push("Kosaraju pseudocode is inferred.");
  return w;
}

function extractBullets(section: Section | undefined): string[] {
  if (!section) return [];
  return section.body
    .split("\n")
    .filter((l) => /^\s*[-*]\s+/.test(l))
    .map((l) => stripMd(l.replace(/^\s*[-*]\s+/, "")))
    .map((s) => s.trim())
    .filter(Boolean);
}

function cardsFor(t: Topic): Flashcard[] {
  const out: Flashcard[] = [];
  const def = t.sections.find((s) => /definition/i.test(s.heading));
  const defText = def ? firstSentence(stripMd(def.body)) : "";

  if (defText) {
    out.push({
      id: t.slug + "::term2def",
      topicSlug: t.slug,
      cardType: "term2def",
      front: t.title,
      back: defText,
      tags: [t.unit, "definition"],
    });
    out.push({
      id: t.slug + "::def2term",
      topicSlug: t.slug,
      cardType: "def2term",
      front: "Which concept is this describing?\n\n\"" + defText + "\"",
      back: t.title,
      tags: [t.unit, "definition"],
    });
  }

  if (t.complexity) {
    const parts: string[] = [];
    if (t.complexity.best) parts.push("Best: " + t.complexity.best);
    if (t.complexity.avg) parts.push("Avg: " + t.complexity.avg);
    if (t.complexity.worst) parts.push("Worst: " + t.complexity.worst);
    if (t.complexity.space) parts.push("Space: " + t.complexity.space);
    if (parts.length) {
      out.push({
        id: t.slug + "::complexity",
        topicSlug: t.slug,
        cardType: "complexity",
        front: "What's the time/space complexity of " + t.title + "?",
        back: parts.join(" · "),
        tags: [t.unit, "complexity"],
      });
    }
  }

  if (t.pseudocodes.length > 0) {
    const pc = t.pseudocodes[0];
    const preview = pc.lines.slice(0, Math.min(8, pc.lines.length)).join("\n");
    out.push({
      id: t.slug + "::code2name",
      topicSlug: t.slug,
      cardType: "code2name",
      front: "What algorithm is this?\n\n```\n" + preview + "\n```",
      back: t.title,
      tags: [t.unit, "pseudocode"],
    });
  }

  if (t.gotchas.length > 0) {
    const first = t.gotchas[0];
    out.push({
      id: t.slug + "::concept2consequence",
      topicSlug: t.slug,
      cardType: "concept2consequence",
      front: "In " + t.title + ": what's the consequence of this gotcha?\n\n\"" + first + "\"",
      back: "Review the gotcha section of " + t.title + ".",
      tags: [t.unit, "gotcha"],
    });
  }

  out.push({
    id: t.slug + "::feynman",
    topicSlug: t.slug,
    cardType: "feynman",
    front: "Explain " + t.title + " as if to a smart high-schooler — what problem does it solve and why does it work?",
    back: "Self-rated. Check yourself against the KB entry for " + t.title + ".",
    tags: [t.unit, "feynman"],
  });

  return out;
}

function quizzesFor(t: Topic): QuizQuestion[] {
  const out: QuizQuestion[] = [];
  t.examQuestions.forEach((q, i) => {
    out.push({
      id: t.slug + "::q-" + i,
      topicSlug: t.slug,
      kind: "short",
      prompt: q,
      difficulty: "firm",
      source: "kb",
      explanation: "See the " + t.title + " KB entry.",
    });
  });

  if (t.complexity?.worst) {
    const wrong = ["O(n log n)", "O(n)", "O(n²)", "O(1)", "O(log n)"].filter(
      (c) => !t.complexity!.worst!.includes(c.replace(/[O()]/g, ""))
    );
    const choices = [
      { text: t.complexity.worst, correct: true, why: "Matches the worst-case analysis in the KB." },
      ...wrong.slice(0, 3).map((w) => ({
        text: w,
        correct: false,
        why: "Doesn't match the worst-case bound derived in " + t.title + ".",
      })),
    ].sort(() => Math.random() - 0.5);
    out.push({
      id: t.slug + "::mcq-complexity",
      topicSlug: t.slug,
      kind: "mcq",
      prompt: "What is the worst-case time complexity of " + t.title + "?",
      choices,
      difficulty: "gentle",
      source: "kb",
      explanation: t.complexity.worst,
    });
  }
  return out;
}

function rubricFor(t: Topic): Rubric {
  const items: Rubric["items"] = [
    { id: "def", prompt: "Stated the core definition of " + t.title, weight: 1 },
    { id: "example", prompt: "Gave a concrete example or worked through a trace", weight: 1 },
    { id: "mechanism", prompt: "Explained the mechanism (why/how it works)", weight: 1 },
    { id: "edge", prompt: "Named at least one edge case, gotcha, or when NOT to use it", weight: 1 },
  ];
  if (t.complexity) items.push({ id: "complexity", prompt: "Stated the time/space complexity", weight: 1 });
  if (t.relatedSlugs.length > 0) items.push({ id: "connection", prompt: "Connected to at least one related concept", weight: 1 });
  return { topicSlug: t.slug, items };
}

/**
 * Prerequisite edges are authored in `kb/prereqs.json` as a topics dictionary
 * keyed by slug, each entry carrying `prereqs: string[]`. We flatten that into
 * [from, to] pairs the graph builder already understands. If the file is
 * missing or malformed, we log a warning and fall through with zero edges.
 */
function loadPrereqsFromJson(): [string, string][] {
  const path = join(KB_ROOT, "prereqs.json");
  if (!existsSync(path)) {
    console.warn("[build-kb]  ⚠ kb/prereqs.json not found — graph will have 0 edges");
    return [];
  }
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as {
      topics: Record<string, { prereqs?: string[] }>;
    };
    const pairs: [string, string][] = [];
    for (const [to, entry] of Object.entries(raw.topics ?? {})) {
      for (const from of entry.prereqs ?? []) {
        pairs.push([from, to]);
      }
    }
    return pairs;
  } catch (err) {
    console.warn("[build-kb]  ⚠ could not parse kb/prereqs.json: " + (err as Error).message);
    return [];
  }
}

const PREREQUISITES: [string, string][] = loadPrereqsFromJson();

function main() {
  ensure(DATA_DIR);
  if (!existsSync(KB_ROOT)) {
    console.error("[build-kb] kb/ not found at " + KB_ROOT);
    throw new Error("kb/ missing");
  }

  const files = walk(KB_ROOT)
    .filter((f) => !f.endsWith("MEMORY.md") && !f.endsWith("INVENTORY.md"))
    .sort();
  console.log("[build-kb] parsing " + files.length + " markdown files…");

  const slugSet = new Set(files.map(slugFor));
  const topics: Topic[] = [];
  const allTraces: TraceTable[] = [];
  let completenessOk = true;

  for (const file of files) {
    const slug = slugFor(file);
    const body = readFileSync(file, "utf8");
    const { title, sections } = splitSections(body);
    if (!title) {
      console.warn("[build-kb] " + slug + " has no H1 title");
      continue;
    }
    const unit = slug.split("/")[0];
    const pseudocodes = extractPseudocodes(sections);
    const traces = extractTraceTables(sections, slug);
    allTraces.push(...traces);
    const complexity = parseComplexity(sections);
    const relatedSlugs = extractRelatedSlugs(body, file, slugSet);
    const warnings = deriveWarnings(body, slug);
    const hook = deriveHook(sections, title);
    const handle = deriveHandle(title);

    const topic: Topic = {
      slug,
      unit,
      file: relative(APP_ROOT, file),
      title,
      handle,
      hook,
      sections,
      pseudocodes,
      traceIds: traces.map((t) => t.id),
      relatedSlugs,
      complexity,
      warnings,
      body,
      examQuestions: extractBullets(sections.find((s) => /exam questions/i.test(s.heading))),
      gotchas: extractBullets(sections.find((s) => /gotcha|trap/i.test(s.heading))),
      sources: extractBullets(sections.find((s) => /source/i.test(s.heading))),
    };

    // Exam-prep files are study guides, not algorithm entries — don't require Definition.
    const isExamPrep = unit === "07-exam-prep";
    const ok = [
      !!title,
      isExamPrep || !!hook,
      isExamPrep || sections.length >= 3,
      isExamPrep || sections.some((s) => /definition/i.test(s.heading)),
    ];
    if (!ok.every(Boolean)) {
      completenessOk = false;
      console.warn("[build-kb]  ⚠ " + slug + " — incomplete sections");
    }

    topics.push(topic);
  }

  const validSlugs = new Set(topics.map((t) => t.slug));
  const edges: GraphEdge[] = [];
  for (const [from, to] of PREREQUISITES) {
    if (!validSlugs.has(from)) {
      console.warn("[build-kb]  ⚠ prereq " + from + " → " + to + " missing source");
      continue;
    }
    if (!validSlugs.has(to)) {
      console.warn("[build-kb]  ⚠ prereq " + from + " → " + to + " missing target");
      continue;
    }
    edges.push({ from, to, kind: "prereq" });
  }
  for (const t of topics) {
    for (const r of t.relatedSlugs) {
      if (r === t.slug) continue;
      const already = edges.find((e) => (e.from === t.slug && e.to === r) || (e.from === r && e.to === t.slug));
      if (already) continue;
      edges.push({ from: t.slug, to: r, kind: "related" });
    }
  }

  const flashcards: Flashcard[] = [];
  const quizzes: QuizQuestion[] = [];
  const rubrics: Rubric[] = [];
  for (const t of topics) {
    flashcards.push(...cardsFor(t));
    quizzes.push(...quizzesFor(t));
    rubrics.push(rubricFor(t));
  }

  const kbOut = {
    builtAt: new Date().toISOString(),
    topics: topics.map((t) => ({
      slug: t.slug,
      unit: t.unit,
      file: t.file,
      title: t.title,
      handle: t.handle,
      hook: t.hook,
      sections: t.sections,
      pseudocodes: t.pseudocodes,
      traceIds: t.traceIds,
      relatedSlugs: t.relatedSlugs,
      complexity: t.complexity,
      warnings: t.warnings,
      body: t.body,
      examQuestions: t.examQuestions,
      gotchas: t.gotchas,
      sources: t.sources,
    })),
  };

  writeFileSync(join(DATA_DIR, "kb.json"), JSON.stringify(kbOut, null, 2));
  writeFileSync(join(DATA_DIR, "graph.json"), JSON.stringify(edges, null, 2));
  writeFileSync(join(DATA_DIR, "flashcards.json"), JSON.stringify(flashcards, null, 2));
  writeFileSync(join(DATA_DIR, "quizzes.json"), JSON.stringify(quizzes, null, 2));
  writeFileSync(join(DATA_DIR, "rubrics.json"), JSON.stringify(rubrics, null, 2));
  writeFileSync(join(DATA_DIR, "traces.json"), JSON.stringify(allTraces, null, 2));

  console.log("[build-kb] ✓ " + topics.length + " topics");
  console.log("[build-kb] ✓ " + edges.length + " edges (" + edges.filter((e) => e.kind === "prereq").length + " prereq)");
  console.log("[build-kb] ✓ " + flashcards.length + " flashcards");
  console.log("[build-kb] ✓ " + quizzes.length + " quiz questions");
  console.log("[build-kb] ✓ " + rubrics.length + " rubrics");
  console.log("[build-kb] ✓ " + allTraces.length + " trace tables");

  if (!completenessOk) {
    console.warn("[build-kb] completeness contract: some topics are missing required sections");
  }
}

main();
