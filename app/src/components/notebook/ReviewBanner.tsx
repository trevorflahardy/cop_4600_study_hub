import type { ReactNode } from "react";
import { Chip } from "./Chip";

interface ReviewBannerProps {
  source: string;
  children?: ReactNode;
  actions?: ReactNode;
}

export function ReviewBanner({ source, children, actions }: ReviewBannerProps) {
  return (
    <div className="review-banner">
      <Chip tone="sky">↺ Review · {source}</Chip>
      <div className="serif italic" style={{ flex: 1, minWidth: 240 }}>
        {children}
      </div>
      {actions}
    </div>
  );
}
