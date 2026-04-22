import clsx from "clsx";
import type { ReactNode } from "react";

interface StatCardProps {
  n: ReactNode;
  label: string;
  foot?: ReactNode;
  tone?: "default" | "accent" | "mint";
}

export function StatCard({ n, label, foot, tone = "default" }: StatCardProps) {
  return (
    <div className={clsx("stat-card", tone !== "default" && tone)}>
      <div className="n">{n}</div>
      <div className="l">{label}</div>
      {foot ? <div className="foot">{foot}</div> : null}
    </div>
  );
}
