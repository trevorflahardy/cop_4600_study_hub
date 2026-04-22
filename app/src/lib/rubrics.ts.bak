import { rubricFor, getTopic, type KbRubric } from "@/lib/kb-loader";

export interface RubricScore {
  items: { id: string; prompt: string; weight: number; met: boolean }[];
  pct: number;
  strengths: string[];
  gaps: string[];
}

/**
 * Rubric-based Feynman grader — works without Ollama.
 * Not a language model; applies loose keyword heuristics against the KB entry
 * to decide whether each rubric item appears to be met.
 */
export function gradeWithRubric(topicSlug: string, explanation: string): RubricScore | null {
  const rubric = rubricFor(topicSlug);
  const topic = getTopic(topicSlug);
  if (!rubric || !topic) return null;

  const lowered = explanation.toLowerCase();
  const words = lowered.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const titleWords = topic.title.toLowerCase().split(/\s+/);
  const defSection = topic.sections.find((s) => /definition/i.test(s.heading));
  const defWords = (defSection?.body ?? "").toLowerCase().match(/[a-z]{4,}/g) ?? [];
  const defKeywords = new Set(defWords.filter((w) => !STOP_WORDS.has(w)));
  const matchingDefKeywords = [...defKeywords].filter((w) => lowered.includes(w));

  const items: RubricScore["items"] = rubric.items.map((it) => {
    const met = checkItem(it, lowered, wordCount, titleWords, matchingDefKeywords, topic);
    return { ...it, met };
  });

  const totalWeight = items.reduce((a, i) => a + i.weight, 0);
  const metWeight = items.filter((i) => i.met).reduce((a, i) => a + i.weight, 0);
  const pct = totalWeight === 0 ? 0 : metWeight / totalWeight;

  const strengths: string[] = [];
  const gaps: string[] = [];

  if (matchingDefKeywords.length >= 3) strengths.push(`Hit ${matchingDefKeywords.length} key terms from the formal definition.`);
  if (wordCount >= 80) strengths.push("Long enough explanation to demonstrate genuine understanding.");
  if (wordCount < 40) gaps.push(`Explanation is short (${wordCount} words) — try doubling down on the mechanism.`);
  if (!items.find((i) => i.id === "example")?.met) gaps.push("Missing a concrete example or trace.");
  if (!items.find((i) => i.id === "mechanism")?.met) gaps.push("Mechanism / how-it-works is absent.");
  if (!items.find((i) => i.id === "complexity")?.met && topic.complexity) {
    gaps.push("Didn't state the time/space complexity.");
  }

  return { items, pct, strengths, gaps };
}

function checkItem(
  item: KbRubric["items"][number],
  lowered: string,
  wordCount: number,
  titleWords: string[],
  defMatches: string[],
  topic: ReturnType<typeof getTopic>
): boolean {
  switch (item.id) {
    case "def":
      // Did they reference the concept by name and at least a few def keywords?
      return titleWords.some((w) => w.length >= 4 && lowered.includes(w.toLowerCase())) && defMatches.length >= 2;
    case "example":
      return /example|for instance|suppose|consider|e\.g\.|[\d]+|array|list|graph|tree|input|sequence/.test(lowered);
    case "mechanism":
      return wordCount >= 40 && /(because|since|therefore|so that|causes|results in|leads to|which means|how it works|works by|iterate|recurse|compare|swap|merge|traverse)/.test(lowered);
    case "edge":
      return /(worst case|edge case|fail|doesn't work|breaks|pitfall|gotcha|be careful|note that|only if|requires|assumes|when not|drawback|limitation)/.test(lowered);
    case "complexity":
      return /(o\s*\(|θ|omega|\\theta|\\omega|log\s*n|n\s*log\s*n|n\^2|n²|linear|logarithmic|polynomial|exponential|time complex|space complex)/.test(lowered) ||
        !!(topic?.complexity?.worst && lowered.includes(topic.complexity.worst.toLowerCase().split(" ")[0]));
    case "connection":
      return /(related to|similar to|unlike|like|compare|versus|as opposed|builds on|relies on|depends on|generalizes|special case|variant)/.test(lowered);
    default:
      return false;
  }
}

const STOP_WORDS = new Set([
  "the", "and", "that", "this", "with", "from", "will", "have", "been",
  "into", "over", "some", "more", "than", "when", "each", "such", "also",
  "only", "does", "where", "them", "then", "most", "these", "which", "before",
  "because", "other", "within", "under", "step", "case", "value", "here",
  "about", "number", "element", "order", "first", "last",
]);
