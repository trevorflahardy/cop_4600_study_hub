import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { useSettings } from "./stores/settings";

import "./styles/globals.css";

function Root() {
  const hydrate = useSettings((s) => s.hydrate);
  const hydrated = useSettings((s) => s.hydrated);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated) {
    return (
      <div style={{ padding: 80, textAlign: "center", fontFamily: "var(--ff-display)", fontSize: 40 }}>
        opening the notebook…
      </div>
    );
  }
  return <RouterProvider router={router} />;
}

const el = document.getElementById("root")!;
ReactDOM.createRoot(el).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
