import type { ReactNode } from "react";
import { Frame, Chip } from "@/components/notebook";

export function StubPage({ title, description, eyebrow, children }: {
  title: string;
  description: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <Frame className="p-10!">
      <div className="eyebrow">{eyebrow ?? "scaffold"}</div>
      <h1 className="mt-2">{title}</h1>
      <p className="serif mt-3 max-w-[64ch] text-(--ink-2) italic">{description}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Chip tone="amber">phase 0 stub</Chip>
        <Chip tone="sky">wired, not yet built</Chip>
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </Frame>
  );
}
