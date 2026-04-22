import { useSettings } from "@/stores/settings";
import { Button, Chip, Frame, MiniLabel, Eyebrow } from "@/components/notebook";
import { useState, useRef } from "react";
import { exportBackup, importBackup, downloadBundle, type BackupBundle } from "@/lib/backup";

export function SettingsPage() {
  const s = useSettings();
  const [endpoint, setEndpoint] = useState(s.ollamaEndpoint);
  const [model, setModel] = useState(s.ollamaModel);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function testOllama() {
    setTestResult("pinging…");
    try {
      const res = await fetch(`${endpoint.replace(/\/$/, "")}/api/tags`, { method: "GET" });
      if (!res.ok) throw new Error(res.statusText);
      const json = await res.json();
      const models = (json.models ?? []).map((m: { name: string }) => m.name).join(", ");
      setTestResult(`reachable · models: ${models || "(none installed)"}`);
    } catch (e) {
      setTestResult(`unreachable · ${(e as Error).message}`);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Frame>
        <div className="eyebrow">theme</div>
        <h2 className="mt-2">How do you want the paper to look?</h2>
        <div className="flex gap-2 mt-3">
          {(["light", "dark", "system"] as const).map((t) => (
            <Button
              key={t}
              variant={s.theme === t ? "primary" : "default"}
              onClick={() => s.setTheme(t)}
            >
              {t}
            </Button>
          ))}
        </div>
      </Frame>

      <Frame>
        <div className="eyebrow">typography</div>
        <h2 className="mt-2">Which typeface should we use?</h2>
        <p className="serif italic mt-2 text-[var(--ink-2)]">
          <b>Notebook</b> keeps the hand-lettered look (Caveat, Nunito, Fraunces, JetBrains Mono).
          <br />
          <b>Apple</b> switches everything to the system stack — SF Pro Display, SF Pro Text, New York, and SF Mono on Apple devices.
        </p>
        <div className="flex gap-2 mt-3">
          {(["notebook", "apple"] as const).map((f) => (
            <Button
              key={f}
              variant={s.fontTheme === f ? "primary" : "default"}
              onClick={() => s.setFontTheme(f)}
            >
              {f}
            </Button>
          ))}
        </div>
      </Frame>

      <Frame>
        <div className="eyebrow">local LLM · ollama</div>
        <h2 className="mt-2">Optional: give the Feynman workbench a brain.</h2>
        <p className="serif italic mt-2 text-[var(--ink-2)]">
          The rubric grader always works offline. Enabling Ollama adds streamed-in deep feedback,
          per-concept tutor chat, and free-form hints.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <Chip tone={s.ollamaEnabled ? "pop" : "soft"}>{s.ollamaEnabled ? "enabled" : "disabled"}</Chip>
          <Button onClick={() => s.setOllama({ ollamaEnabled: !s.ollamaEnabled })}>
            {s.ollamaEnabled ? "Disable" : "Enable"}
          </Button>
        </div>

        <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <label className="flex flex-col gap-1">
            <MiniLabel>endpoint</MiniLabel>
            <input
              className="ask-box field"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              onBlur={() => s.setOllama({ ollamaEndpoint: endpoint })}
              style={{ minHeight: 0 }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <MiniLabel>model</MiniLabel>
            <input
              className="ask-box field"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              onBlur={() => s.setOllama({ ollamaModel: model })}
              style={{ minHeight: 0 }}
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={testOllama}>Ping endpoint</Button>
          {testResult && <span className="mono text-[12px] text-[var(--ink-2)]">{testResult}</span>}
        </div>
      </Frame>

      <Frame>
        <Eyebrow>backup · local JSON</Eyebrow>
        <h2 className="mt-2">Export / import your progress.</h2>
        <p className="serif italic mt-2 text-[var(--ink-2)] text-[14px]">
          Export as JSON for safekeeping. Import to restore on another machine — it replaces all local state.
        </p>
        <BackupControls />
      </Frame>

      <Frame>
        <Eyebrow>danger zone</Eyebrow>
        <h2 className="mt-2">Wipe all local progress</h2>
        <p className="serif italic mt-2 text-[var(--ink-2)]">
          Clears mastery, SRS, sessions, Feynman entries, and flags. Settings are kept.
        </p>
        <Button
          className="mt-3"
          onClick={async () => {
            if (!confirm("Really wipe all progress? Cannot be undone.")) return;
            await s.resetProgress();
            alert("Progress cleared.");
          }}
        >
          Reset everything
        </Button>
      </Frame>
    </div>
  );
}

function BackupControls() {
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function doExport() {
    const bundle = await exportBackup();
    downloadBundle(bundle);
    setMsg("Exported " + bundle.createdAt);
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const bundle = JSON.parse(text) as BackupBundle;
      if (!confirm("Importing will replace all local progress. Continue?")) return;
      await importBackup(bundle);
      setMsg("Imported " + file.name);
    } catch (err) {
      setMsg("Import failed: " + (err as Error).message);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="mt-3 flex items-center gap-3 flex-wrap">
      <Button onClick={doExport}>Download backup.json</Button>
      <label className="btn-sk ghost cursor-pointer">
        <input type="file" accept="application/json" ref={inputRef} onChange={doImport} className="hidden" />
        Restore from file…
      </label>
      {msg && <MiniLabel>{msg}</MiniLabel>}
    </div>
  );
}
