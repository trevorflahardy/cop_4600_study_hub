import type { ReactNode } from "react";
import clsx from "clsx";

export interface Tab {
  id: string;
  num: string;
  label: string;
}

interface TabsCanvasProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  children: ReactNode;
  minHeight?: number;
}

export function TabsCanvas({ tabs, active, onChange, children, minHeight = 600 }: TabsCanvasProps) {
  return (
    <div>
      <div className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === active}
            className={clsx("tab", tab.id === active && "active")}
            onClick={() => onChange(tab.id)}
          >
            <span className="num">{tab.num}</span>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="canvas" style={{ minHeight }}>
        {children}
      </div>
    </div>
  );
}
