import { useState } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Link,
  ScrollRestoration,
  useNavigate,
} from "@tanstack/react-router";
import { AppTop } from "./components/chrome/AppTop";
import { ShortcutsHelp } from "./components/chrome/ShortcutsHelp";
import { useGlobalShortcuts } from "./lib/keyboard";
import { useSettings } from "./stores/settings";

import { HubPage } from "./pages/HubPage";
import { MapPage } from "./pages/MapPage";
import { FlashcardsPage } from "./pages/FlashcardsPage";
import { FeynmanPage } from "./pages/FeynmanPage";
import { QuizPage } from "./pages/QuizPage";
import { TrapsPage } from "./pages/TrapsPage";
import { MasteryPage } from "./pages/MasteryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ModulePage } from "./pages/ModulePage";
import { LecturePage } from "./pages/LecturePage";
import { PracticePage } from "./pages/PracticePage";
import { ReviewPage } from "./pages/ReviewPage";
import { DebriefPage } from "./pages/DebriefPage";
import { AlgorithmPage } from "./pages/AlgorithmPage";
import { VizPage } from "./pages/VizPage";
import { LearnPage } from "./pages/LearnPage";
import { ChapterQuizPage } from "./pages/ChapterQuizPage";
import { FinalExamPage } from "./pages/FinalExamPage";

function Shell() {
  const [helpOpen, setHelpOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useSettings();

  useGlobalShortcuts([
    { keys: "h", label: "Home", action: () => navigate({ to: "/" }) },
    { keys: "m", label: "Map", action: () => navigate({ to: "/map" }) },
    { keys: "l", label: "Learn next", action: () => navigate({ to: "/map" }) },
    { keys: "v", label: "Viz", action: () => navigate({ to: "/viz" }) },
    { keys: "c", label: "Cards", action: () => navigate({ to: "/flashcards" }) },
    { keys: "q", label: "Quiz", action: () => navigate({ to: "/quiz" }) },
    { keys: "f", label: "Feynman", action: () => navigate({ to: "/feynman" }) },
    { keys: "t", label: "Traps", action: () => navigate({ to: "/traps" }) },
    { keys: "r", label: "Review", action: () => navigate({ to: "/review" }) },
    { keys: "g", label: "Mastery", action: () => navigate({ to: "/mastery" }) },
    { keys: "e", label: "Final exam prep", action: () => navigate({ to: "/final" }) },
    { keys: "s", label: "Settings", action: () => navigate({ to: "/settings" }) },
    { keys: "?", label: "Help", action: () => setHelpOpen((o) => !o) },
    { keys: "d", label: "Theme", action: () => setTheme(theme === "dark" ? "light" : "dark") },
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppTop />
      <main className="flex-1 px-6 py-8 max-w-[1400px] w-full mx-auto">
        <Outlet />
      </main>
      <footer className="px-6 py-4 mono text-[11px] text-[var(--ink-3)] text-center border-t border-dashed border-[var(--rule)] flex items-center justify-center gap-3">
        <span>COP 4600 · Spring 2026 · Local-only · press <button onClick={() => setHelpOpen(true)} className="underline decoration-dashed">?</button> for shortcuts</span>
      </footer>
      <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ScrollRestoration />
    </div>
  );
}

function NotFound() {
  return (
    <div className="canvas">
      <div className="eyebrow">404 · off the map</div>
      <h1>That page doesn't exist yet.</h1>
      <p className="mt-3">Either it's still in the build backlog or you typed an unfamiliar slug.</p>
      <Link to="/" className="btn-sk primary mt-6 inline-flex">← Back to the hub</Link>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: Shell,
  notFoundComponent: NotFound,
});

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HubPage });
const mapRoute = createRoute({ getParentRoute: () => rootRoute, path: "/map", component: MapPage });
const flashcardsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/flashcards", component: FlashcardsPage });
const feynmanRoute = createRoute({ getParentRoute: () => rootRoute, path: "/feynman", component: FeynmanPage });
const quizRoute = createRoute({ getParentRoute: () => rootRoute, path: "/quiz", component: QuizPage });
const trapsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/traps", component: TrapsPage });
const masteryRoute = createRoute({ getParentRoute: () => rootRoute, path: "/mastery", component: MasteryPage });
const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/settings", component: SettingsPage });

const reviewRoute = createRoute({ getParentRoute: () => rootRoute, path: "/review", component: ReviewPage });
const debriefRoute = createRoute({ getParentRoute: () => rootRoute, path: "/debrief", component: DebriefPage });

const moduleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/module/$moduleId",
  component: ModulePage,
});

const lectureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/module/$moduleId/lesson/$lessonId",
  component: LecturePage,
});

const practiceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/module/$moduleId/lesson/$lessonId/practice",
  component: PracticePage,
});

const algorithmRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/algorithms/$",
  component: AlgorithmPage,
});

const learnRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/learn/$",
  component: LearnPage,
});

const chapterQuizRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/module/$moduleId/quiz",
  component: ChapterQuizPage,
});

const vizRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/viz",
  component: VizPage,
});

const finalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/final",
  component: FinalExamPage,
  validateSearch: (search: Record<string, unknown>) => {
    const mode = search.mode;
    if (typeof mode === "string" && ["hub", "graph", "pseudo", "runtime", "simulator", "mcq"].includes(mode)) {
      return { mode: mode as "hub" | "graph" | "pseudo" | "runtime" | "simulator" | "mcq" };
    }
    return {};
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  mapRoute,
  flashcardsRoute,
  feynmanRoute,
  quizRoute,
  trapsRoute,
  masteryRoute,
  settingsRoute,
  reviewRoute,
  debriefRoute,
  moduleRoute,
  lectureRoute,
  practiceRoute,
  algorithmRoute,
  learnRoute,
  chapterQuizRoute,
  vizRoute,
  finalRoute,
]);

const basepath = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export const router = createRouter({ routeTree, defaultPreload: "intent", basepath });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
