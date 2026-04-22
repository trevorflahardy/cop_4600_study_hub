import { Link } from "@tanstack/react-router";
import { Map, Layers, CreditCard, BookOpen, Target, Settings as SettingsIcon, Zap, Flame, Wand2, GraduationCap } from "lucide-react";
import clsx from "clsx";
import { Button } from "../notebook/Button";
import { useSettings } from "@/stores/settings";

const NAV: { to: string; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { to: "/", label: "Hub", icon: BookOpen },
  { to: "/map", label: "Map", icon: Map },
  { to: "/viz", label: "Viz", icon: Wand2 },
  { to: "/flashcards", label: "Cards", icon: CreditCard },
  { to: "/quiz", label: "Quiz", icon: Zap },
  { to: "/feynman", label: "Feynman", icon: Layers },
  { to: "/traps", label: "Traps", icon: Flame },
  { to: "/mastery", label: "Mastery", icon: Target },
  { to: "/final", label: "Final", icon: GraduationCap },
];

export function AppTop() {
  const { theme, setTheme } = useSettings();
  return (
    <header className="app-top">
      <div className="crumb">
        <b>COP 4600</b>
        <span className="sep">›</span>
        <span>Operating Systems · Study Hub</span>
      </div>

      <div className="spacer" />

      <nav className="row" style={{ gap: 4, flexWrap: "wrap" }}>
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="btn-sk ghost"
            style={{ padding: "6px 12px", fontSize: 13 }}
            activeProps={{ className: "btn-sk primary" }}
            activeOptions={{ exact: to === "/" }}
          >
            <Icon size={14} />
            {label}
          </Link>
        ))}
      </nav>

      <Button
        variant="ghost"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
        className={clsx("ml-2")}
        style={{ padding: "6px 10px" }}
      >
        {theme === "dark" ? "☀" : "☾"}
      </Button>
      <Link to="/settings" className="btn-sk ghost" style={{ padding: "6px 10px" }}>
        <SettingsIcon size={14} />
      </Link>
    </header>
  );
}
