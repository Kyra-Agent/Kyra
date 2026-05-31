import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  theme: "dark" | "light";
  onToggle: () => void;
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const light = theme === "light";

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={onToggle}
      aria-label={light ? "Switch to dark mode" : "Switch to light mode"}
      title={light ? "Dark mode" : "Light mode"}
    >
      {light ? <Moon size={16} /> : <Sun size={16} />}
      <span>{light ? "Dark" : "Light"}</span>
    </button>
  );
}
