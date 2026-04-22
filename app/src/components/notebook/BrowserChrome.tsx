import type { ReactNode } from "react";

export function BrowserChrome({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="chrome">
      <div className="chrome-bar">
        <div className="dots">
          <i /> <i /> <i />
        </div>
        <div className="url">{url}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}
