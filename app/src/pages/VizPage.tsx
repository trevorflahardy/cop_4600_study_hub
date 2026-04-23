import { Link } from "@tanstack/react-router";
import { VIZ_CATALOG } from "@/components/viz";
import { Frame, Chip, Eyebrow, Highlighter } from "@/components/notebook";
import { getTopic, unitLabel } from "@/lib/kb-loader";

export function VizPage() {
  if (VIZ_CATALOG.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Frame className="p-8!">
          <Eyebrow>visualization gallery · coming soon</Eyebrow>
          <h1 className="mt-2">Interactive OS diagrams <Highlighter>coming in Phase 2.3</Highlighter>.</h1>
          <p className="serif mt-3 max-w-[66ch] text-(--ink-2) italic">
            We are building interactive visualizations for process scheduling, memory management, and synchronization.
            Check back soon.
          </p>
        </Frame>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Frame className="p-8!">
        <Eyebrow>visualization gallery · {VIZ_CATALOG.length} viz</Eyebrow>
        <h1 className="mt-2">Every crown-jewel <Highlighter>viz</Highlighter>, in one place.</h1>
        <p className="serif mt-3 max-w-[66ch] text-(--ink-2) italic">
          Each OS topic has a dedicated interactive diagram you can poke at. This page
          is the index. Click through to the topic's full entry — the viz is embedded there plus
          you get the pseudocode, trace, and related topics.
        </p>
      </Frame>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {VIZ_CATALOG.map((v) => (
          <Frame key={v.id} className="p-5!">
            <Eyebrow>{v.id}</Eyebrow>
            <h3 className="mt-1 leading-tight">{v.title}</h3>
            <p className="serif mt-2 text-[13px] text-(--ink-2) italic">{v.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {v.topics.slice(0, 3).map((slug) => {
                const t = getTopic(slug);
                if (!t) return null;
                return (
                  <Link key={slug} to="/learn/$" params={{ _splat: slug }} className="no-underline">
                    <Chip tone="sky">{t.title}</Chip>
                  </Link>
                );
              })}
              {v.topics.length > 3 && <Chip tone="soft">+{v.topics.length - 3} more</Chip>}
            </div>
            {v.topics[0] && (
              <Link
                to="/learn/$"
                params={{ _splat: v.topics[0] }}
                className="btn-sk primary mt-4 inline-flex"
                style={{ padding: "6px 14px", fontSize: 13 }}
              >
                open →
              </Link>
            )}
          </Frame>
        ))}
      </div>

      <Frame className="p-5!">
        <Eyebrow>by unit</Eyebrow>
        <div className="mt-2 flex flex-col gap-1">
          {[...new Set(VIZ_CATALOG.flatMap((v) => v.topics.map((s) => s.split("/")[0])))].sort().map((u) => (
            <div key={u} className="text-[13px]">
              <strong className="display mr-2 text-lg">{unitLabel(u)}</strong>
              {VIZ_CATALOG.filter((v) => v.topics.some((s) => s.startsWith(u + "/"))).map((v) => (
                <Chip key={v.id} tone="soft">{v.title}</Chip>
              ))}
            </div>
          ))}
        </div>
      </Frame>
    </div>
  );
}
