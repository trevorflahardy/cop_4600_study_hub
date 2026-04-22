/**
 * Thin Ollama client for the study hub.
 *
 * - No SDK; just fetch → localhost:11434 by default.
 * - Streams chat completions so the Feynman workbench and tutor chat
 *   feel responsive.
 * - Every call wraps errors so the UI can fall back to rubric-only.
 */

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OllamaChatOptions {
  endpoint: string;
  model: string;
  messages: OllamaMessage[];
  onToken?: (token: string) => void;
  signal?: AbortSignal;
}

export interface OllamaAvailability {
  ok: boolean;
  models?: string[];
  error?: string;
}

function normalizeEndpoint(ep: string): string {
  return ep.replace(/\/$/, "");
}

export async function checkAvailability(endpoint: string): Promise<OllamaAvailability> {
  try {
    const res = await fetch(normalizeEndpoint(endpoint) + "/api/tags", {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { ok: false, error: "HTTP " + res.status };
    const json: { models?: { name: string }[] } = await res.json();
    return { ok: true, models: (json.models ?? []).map((m) => m.name) };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function streamChat(options: OllamaChatOptions): Promise<string> {
  const { endpoint, model, messages, onToken, signal } = options;
  const body = {
    model,
    messages,
    stream: true,
    options: {
      temperature: 0.4,
    },
  };

  const res = await fetch(normalizeEndpoint(endpoint) + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error("Ollama returned HTTP " + res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let assembled = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed: { message?: { content?: string }; done?: boolean } = JSON.parse(line);
        const token = parsed.message?.content;
        if (token) {
          assembled += token;
          onToken?.(token);
        }
      } catch {
        // streaming, skip malformed lines
      }
    }
  }

  return assembled;
}
