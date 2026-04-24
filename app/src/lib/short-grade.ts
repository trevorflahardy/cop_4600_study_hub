import type { KbQuizQuestion } from "@/lib/kb-loader";
import { getTopic } from "@/lib/kb-loader";
import { streamChat, checkAvailability } from "@/lib/ollama";

/**
 * Shared short-answer grading utilities used by QuizRunner and
 * ExamQuestionsQuiz. Keeping the prompt shape and verdict parsing in one
 * place so both surfaces grade consistently.
 */

export type ShortVerdict = "correct" | "partial" | "incorrect";

/**
 * Build the reference material we hand to Ollama (and display to the
 * student as the Ollama-off fallback). Pulls the topic's Definition,
 * Key ideas, Mechanism, Gotchas, and When-to-use sections verbatim from
 * the KB so the grader sees the same context a human grader would.
 */
export function buildShortReference(question: KbQuizQuestion): string {
  const topic = getTopic(question.topicSlug);
  if (!topic) return question.explanation ?? "";
  const keep = topic.sections.filter((s) =>
    /definition|key ideas|mechanism|gotcha|when to use/i.test(s.heading),
  );
  const parts: string[] = [];
  parts.push("Topic: " + topic.title);
  for (const s of keep) {
    parts.push("## " + s.heading + "\n" + s.body);
  }
  if (question.explanation && !/^see the .+ kb entry\.?$/i.test(question.explanation)) {
    parts.push("Question-level note: " + question.explanation);
  }
  return parts.join("\n\n").slice(0, 3500);
}

export function parseVerdict(raw: string): ShortVerdict {
  const m = raw.match(/VERDICT\s*:\s*(correct|partial|incorrect)/i);
  if (m) return m[1].toLowerCase() as ShortVerdict;
  const lower = raw.toLowerCase();
  if (/\b(correct|right|well done|accurate)\b/.test(lower) && !/\bnot (correct|right)\b/.test(lower)) {
    return "correct";
  }
  if (/\b(partial|partly|mostly|close)\b/.test(lower)) return "partial";
  return "incorrect";
}

export interface GradeShortArgs {
  question: KbQuizQuestion;
  studentAnswer: string;
  endpoint: string;
  model: string;
  onToken: (tok: string, accumulated: string) => void;
}

/**
 * Grades a short-answer response via Ollama. Callers are responsible for
 * checking Ollama is enabled before invoking this, and for handling the
 * unreachable / error fallback. Returns the full feedback text plus the
 * parsed verdict.
 */
export async function gradeShortAnswer(
  args: GradeShortArgs,
): Promise<{ feedback: string; verdict: ShortVerdict }> {
  const reference = buildShortReference(args.question);
  const sys =
`You are grading a student's free-response answer on a COP 4600 Operating Systems exam.

Question:
${args.question.prompt}

Reference material (authoritative — the student's answer should align with this):
${reference}

Grading rules:
- Focus on conceptual correctness, not prose polish.
- Partial credit ("partial") is appropriate when the student gets the core idea but misses a key detail or edge case.
- "correct" means the answer would earn full or near-full credit on an exam.
- "incorrect" means the core idea is wrong or missing.

Your response MUST be under 140 words and MUST follow this shape exactly:

VERDICT: correct|partial|incorrect

Strengths: one or two short bullets citing what the student got right (quote if helpful).
Gaps: one or two short bullets naming the concrete missing concepts.
Best fix: one sentence describing the single most important correction.

Do not restate the question. Do not write more than 140 words.`;

  let acc = "";
  await streamChat({
    endpoint: args.endpoint,
    model: args.model,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: "Student answer:\n" + args.studentAnswer },
    ],
    onToken: (tok) => {
      acc += tok;
      args.onToken(tok, acc);
    },
  });
  return { feedback: acc, verdict: parseVerdict(acc) };
}

export { checkAvailability };
