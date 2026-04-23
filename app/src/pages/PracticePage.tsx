import { useParams, useNavigate } from "@tanstack/react-router";
import { getTopic, quizzesFor } from "@/lib/kb-loader";
import { QuizRunner } from "@/features/practice/QuizRunner";
import { StubPage } from "./_stub";
import { Frame, Eyebrow, MiniLabel, Chip } from "@/components/notebook";
import { useMemo } from "react";

export function PracticePage() {
  const { moduleId, lessonId } = useParams({ strict: false }) as { moduleId: string; lessonId: string };
  const slug = moduleId + "/" + lessonId;
  const topic = getTopic(slug);
  const allQs = useMemo(() => quizzesFor(slug), [slug]);
  const navigate = useNavigate();

  if (!topic) {
    return <StubPage title="Lesson not found" description={`No KB entry at "${slug}".`} />;
  }

  if (allQs.length === 0) {
    return (
      <Frame>
        <Eyebrow>practice · no questions yet</Eyebrow>
        <h2 className="mt-2">This lesson doesn't have generated quiz questions yet.</h2>
        <p className="serif mt-2 text-(--ink-2) italic">
          The KB's "Common exam questions" section was either empty or not parsed.
          Add questions to <code>kb/{slug}.md</code> and run <code>bun kb</code>.
        </p>
      </Frame>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Eyebrow>practice · {topic.unit}</Eyebrow>
        <h1 className="mt-2">{topic.title}</h1>
        <div className="mt-2 flex items-center gap-2">
          <Chip tone="sky">{allQs.length} questions</Chip>
          <MiniLabel>autosaves · come back anytime</MiniLabel>
        </div>
      </div>

      <QuizRunner
        questions={allQs}
        onComplete={() => navigate({ to: "/debrief" })}
      />
    </div>
  );
}
