import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Link,
  ScrollRestoration,
} from "@tanstack/react-router";
import { AppTop } from "./components/chrome/AppTop";

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
  return (
    <div className="flex min-h-screen flex-col">
      <AppTop />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8">
        <Outlet />
      </main>
      <footer className="mono flex items-center justify-center gap-3 border-t border-dashed border-(--rule) px-6 py-4 text-center text-[11px] text-(--ink-3)">
        <span>COP 4600 · Spring 2026 · Local-only</span>
      </footer>
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
