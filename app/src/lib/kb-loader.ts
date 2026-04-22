import kbRaw from "@/data/kb.json";
import graphRaw from "@/data/graph.json";
import flashcardsRaw from "@/data/flashcards.json";
import quizzesRaw from "@/data/quizzes.json";
import rubricsRaw from "@/data/rubrics.json";
import tracesRaw from "@/data/traces.json";

export interface KbSection {
  heading: string;
  slug: string;
  body: string;
}

export interface KbPseudocode {
  title: string | null;
  lines: string[];
  language?: string;
}

export interface KbComplexity {
  best?: string;
  avg?: string;
  worst?: string;
  space?: string;
  stable?: boolean;
  inPlace?: boolean;
  notes?: string;
}

export interface KbTopic {
  slug: string;
  unit: string;
  file: string;
  title: string;
  handle: string;
  hook: string | null;
  sections: KbSection[];
  pseudocodes: KbPseudocode[];
  traceIds: string[];
  relatedSlugs: string[];
  complexity: KbComplexity | null;
  warnings: string[];
  body: string;
  examQuestions: string[];
  gotchas: string[];
  sources: string[];
}

export interface KbBundle {
  builtAt: string;
  topics: KbTopic[];
}

export interface KbGraphEdge {
  from: string;
  to: string;
  kind: "prereq" | "related" | "contradicts";
}

export interface KbFlashcard {
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

export interface KbQuizChoice {
  text: string;
  correct: boolean;
  why?: string;
}

/**
 * A lightweight graph used by graph-walk questions — keeps nodes, edges,
 * whether edges are directed, and optional weights. Rendered by
 * GraphWalkQuestion. Mirrors the shape used by GraphSandbox but intentionally
 * standalone so question banks can ship their own graphs.
 */
export interface QuestionGraph {
  nodes: { id: string; x: number; y: number }[];
  edges: { from: string; to: string; weight?: number }[];
  directed?: boolean;
}

export type GraphWalkAlgorithm =
  | "bfs"
  | "dfs-preorder"
  | "dfs-postorder"
  | "dijkstra"
  | "prim"
  | "kruskal"
  | "topo-sort";

export interface GraphWalkData {
  graph: QuestionGraph;
  algorithm: GraphWalkAlgorithm;
  source?: string;             // BFS/DFS/Dijkstra/Prim start node
  expectedOrder: string[];     // canonical visit/extract/add-edge order
  tieBreak?: string;           // human-readable tie-break rule
  /** For Kruskal, expectedOrder is edges as "A-B", "C-D", etc. */
  orderKind?: "nodes" | "edges";
}

export interface PseudocodeData {
  /** Canonical CLRS-style reference pseudocode the student should produce. */
  reference: string[];
  /** Short rubric items — keywords or concepts that must appear. */
  rubric: {
    id: string;
    prompt: string;
    keywords: string[];      // any-of match, case-insensitive substring
    weight: number;
  }[];
  /** Target complexity — shown post-grade. */
  complexityHint?: string;
}

export interface RuntimeData {
  /** Each slot the student has to fill. */
  slots: {
    id: "best" | "avg" | "worst" | "space" | "pre" | "post";
    label: string;
    /** Canonical answer — normalized for match (ignores spaces, case, \\theta vs Θ). */
    answer: string;
    /** Equivalent forms that should be accepted. */
    accepts?: string[];
  }[];
  /** One-liner that appears after grading. */
  whyNote?: string;
}

export interface KbQuizQuestion {
  id: string;
  topicSlug: string;
  kind: "mcq" | "short" | "scenario" | "graph-walk" | "pseudocode" | "runtime";
  prompt: string;
  choices?: KbQuizChoice[];
  answer?: string;
  explanation?: string;
  difficulty: "gentle" | "firm" | "tricky";
  source: "kb" | "traps" | "practice" | "final-bank";
  // Extensions for the new kinds. Only one is populated per question.
  graphWalk?: GraphWalkData;
  pseudocode?: PseudocodeData;
  runtime?: RuntimeData;
  /** Exam weight in points — used by the simulator. */
  points?: number;
}

export interface KbRubric {
  topicSlug: string;
  items: { id: string; prompt: string; weight: number }[];
}

export interface KbTraceTable {
  id: string;
  caption?: string;
  headers: string[];
  rows: string[][];
}

import { FINAL_EXAM_BANK } from "@/data/final-exam-bank";

const kb = kbRaw as unknown as KbBundle;
const graph = graphRaw as unknown as KbGraphEdge[];
const flashcards = flashcardsRaw as unknown as KbFlashcard[];
const generatedQuizzes = quizzesRaw as unknown as KbQuizQuestion[];
// Merge auto-generated KB questions with hand-authored final-exam bank
// (graph walks, pseudocode prompts, runtime drills, extra MCQ). The bank is a
// TypeScript module so we get type-checking on its rich payloads without
// threading them through the KB markdown compiler. `bun kb` does NOT overwrite
// it.
const quizzes: KbQuizQuestion[] = [...generatedQuizzes, ...FINAL_EXAM_BANK];
const rubrics = rubricsRaw as unknown as KbRubric[];
const traces = tracesRaw as unknown as KbTraceTable[];

export function allTopics(): KbTopic[] {
  return kb.topics;
}

export function getTopic(slug: string): KbTopic | undefined {
  return kb.topics.find((t) => t.slug === slug);
}

export function topicsInUnit(unit: string): KbTopic[] {
  return kb.topics.filter((t) => t.unit === unit);
}

export function allUnits(): string[] {
  const seen = new Set<string>();
  for (const t of kb.topics) seen.add(t.unit);
  return [...seen].sort();
}

export function edges(): KbGraphEdge[] {
  return graph;
}

export function prereqsFor(slug: string): string[] {
  return graph.filter((e) => e.to === slug && e.kind === "prereq").map((e) => e.from);
}

export function dependentsOf(slug: string): string[] {
  return graph.filter((e) => e.from === slug && e.kind === "prereq").map((e) => e.to);
}

export function relatedOf(slug: string): string[] {
  return graph
    .filter((e) => (e.from === slug || e.to === slug) && e.kind !== "prereq")
    .map((e) => (e.from === slug ? e.to : e.from));
}

export function getSection(slug: string, matcher: RegExp): KbSection | undefined {
  const t = getTopic(slug);
  return t?.sections.find((s) => matcher.test(s.heading));
}

export function allFlashcards(): KbFlashcard[] {
  return flashcards;
}

export function flashcardsFor(slug: string): KbFlashcard[] {
  return flashcards.filter((f) => f.topicSlug === slug);
}

export function allQuizzes(): KbQuizQuestion[] {
  return quizzes;
}

export function quizzesFor(slug: string): KbQuizQuestion[] {
  return quizzes.filter((q) => q.topicSlug === slug);
}

export function quizzesOfKind(kind: KbQuizQuestion["kind"]): KbQuizQuestion[] {
  return quizzes.filter((q) => q.kind === kind);
}

export function quizzesFromBank(): KbQuizQuestion[] {
  return quizzes.filter((q) => q.source === "final-bank");
}

export function rubricFor(slug: string): KbRubric | undefined {
  return rubrics.find((r) => r.topicSlug === slug);
}

export function allTraces(): KbTraceTable[] {
  return traces;
}

export function tracesFor(slug: string): KbTraceTable[] {
  return traces.filter((t) => t.id.startsWith(slug + "::"));
}

export const UNIT_LABELS: Record<string, string> = {
  "00-foundations": "Foundations",
  "01-processes": "Processes",
  "02-scheduling": "CPU Scheduling",
  "03-memory": "Memory & Paging",
  "04-concurrency": "Concurrency",
  "05-deadlock": "Deadlock",
  "06-persistence": "Persistence",
  "07-exam-prep": "Exam Prep",
};

export function unitLabel(unit: string): string {
  return UNIT_LABELS[unit] ?? unit;
}
