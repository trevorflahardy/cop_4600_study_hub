import type { ReactNode } from "react";

export function KeyIdea({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="key-idea">
      <b>{title}</b>
      {children}
    </div>
  );
}
