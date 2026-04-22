import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button, Chip, Eyebrow, MiniLabel } from "@/components/notebook";
import { X, Send, AlertTriangle } from "lucide-react";
import { streamChat, checkAvailability, type OllamaMessage } from "@/lib/ollama";
import { useSettings } from "@/stores/settings";
import { getTopic } from "@/lib/kb-loader";

interface TutorDrawerProps {
  topicSlug: string;
  open: boolean;
  onClose: () => void;
}

export function TutorDrawer({ topicSlug, open, onClose }: TutorDrawerProps) {
  const topic = getTopic(topicSlug);
  const { ollamaEnabled, ollamaEndpoint, ollamaModel } = useSettings();
  const [messages, setMessages] = useState<OllamaMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<"unknown" | "ok" | "down">("unknown");

  useEffect(() => {
    if (!open) return;
    setMessages([]);
    setInput("");
    setError(null);
    if (!ollamaEnabled) {
      setAvailability("down");
      return;
    }
    checkAvailability(ollamaEndpoint).then((a) => setAvailability(a.ok ? "ok" : "down"));
  }, [open, ollamaEnabled, ollamaEndpoint]);

  const send = useCallback(async () => {
    if (!input.trim() || !topic || streaming) return;
    if (!ollamaEnabled) {
      setError("Ollama is disabled. Enable it in Settings to chat.");
      return;
    }

    const userMsg: OllamaMessage = { role: "user", content: input };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);
    setError(null);

    const kbSummary = topic.sections.slice(0, 3).map((s) => `### ${s.heading}\n${s.body}`).join("\n\n").slice(0, 4000);
    const sys: string =
`You are an expert algorithms tutor having a short conversation about one topic: "${topic.title}".

Ground rules:
- Be direct and specific. Under 180 words per reply.
- Cite the student's question back when useful.
- Use \`$...$\` for inline math and \`$$...$$\` for block math.
- Prefer concrete examples over abstract definitions.

KB excerpt for ${topic.title}:
${kbSummary}`;

    try {
      let acc = "";
      const assistantIdx = nextMessages.length;
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      await streamChat({
        endpoint: ollamaEndpoint,
        model: ollamaModel,
        messages: [{ role: "system", content: sys }, ...nextMessages],
        onToken: (tok) => {
          acc += tok;
          setMessages((m) => m.map((msg, i) => (i === assistantIdx ? { ...msg, content: acc } : msg)));
        },
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStreaming(false);
    }
  }, [input, topic, messages, ollamaEnabled, ollamaEndpoint, ollamaModel, streaming]);

  if (!topic) return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, background: "var(--ink)",
              zIndex: 50,
            }}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 240 }}
            style={{
              position: "fixed", top: 0, right: 0, bottom: 0,
              width: "min(460px, 96vw)",
              background: "var(--paper)",
              borderLeft: "2px solid var(--ink)",
              boxShadow: "-8px 0 0 rgba(0,0,0,0.08)",
              zIndex: 51,
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1.5px dashed var(--rule)", display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                <Eyebrow>tutor · {topic.title}</Eyebrow>
                <div className="display text-xl mt-1">Ask anything about this concept.</div>
              </div>
              <span className="flex-1" />
              <Button variant="ghost" onClick={onClose} aria-label="Close"><X size={14} /></Button>
            </div>

            <div style={{ padding: "12px 20px" }}>
              {availability === "ok" ? (
                <Chip tone="mint">ollama · {ollamaModel}</Chip>
              ) : (
                <Chip tone="amber">
                  <AlertTriangle size={12} />{" "}
                  {ollamaEnabled ? "ollama unreachable" : "ollama off · enable in settings"}
                </Chip>
              )}
            </div>

            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: "0 20px 20px",
                display: "flex", flexDirection: "column", gap: 10,
              }}
            >
              {messages.length === 0 && (
                <div className="serif italic text-[var(--ink-3)] text-[14px] mt-3">
                  Try: "Why does the worst case happen?" — or — "Give me a trickier example."
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "90%",
                    background: m.role === "user" ? "var(--hl)" : "var(--paper-2)",
                    border: "1.5px solid var(--ink)",
                    borderRadius: 10,
                    padding: "8px 12px",
                    fontFamily: m.role === "user" ? "var(--ff-body)" : "var(--ff-serif)",
                    fontSize: 14,
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                  }}
                >
                  {m.content || (streaming ? <span className="italic text-[var(--ink-3)]">…</span> : "")}
                </div>
              ))}
              {error && (
                <div className="mono text-[12px] text-[var(--wrong)]">error: {error}</div>
              )}
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1.5px dashed var(--rule)" }}>
              <div className="flex gap-2 items-end">
                <textarea
                  className="workspace"
                  rows={2}
                  placeholder={availability === "ok" ? "ask…" : "ollama required to chat"}
                  disabled={availability !== "ok"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  style={{ minHeight: 60, flex: 1 }}
                />
                <Button variant="pop" onClick={send} disabled={streaming || availability !== "ok" || !input.trim()}>
                  <Send size={16} />
                </Button>
              </div>
              <MiniLabel>enter sends · shift+enter adds a line</MiniLabel>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
