import styles from './ThemeToggle.module.css';
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import { useAppStore } from "../store/useAppStore";

export default function ThemeToggle({ showLabel = false, className = "" }) {
  const themeMode = useAppStore((state) => state.themeMode);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const isDark = themeMode === "dark";

  if (showLabel) {
    return (
      <label
        className={`flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700 transition-colors dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200 ${className}`}
      >
        <span className={styles.container}>
          {isDark ? (
            <DarkModeOutlinedIcon style={{ fontSize: 18, color: "#f59e0b" }} />
          ) : (
            <LightModeOutlinedIcon style={{ fontSize: 18, color: "#4b5563" }} />
          )}
          <span>{isDark ? "Dark mode" : "Light mode"}</span>
        </span>
        <span className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition-colors dark:bg-slate-600">
          <input
            type="checkbox"
            checked={isDark}
            onChange={toggleTheme}
            className="peer sr-only"
            aria-label="Toggle theme"
          />
          <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </span>
      </label>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-500 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-slate-700"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <LightModeOutlinedIcon style={{ fontSize: 20, color: "#f59e0b" }} />
      ) : (
        <DarkModeOutlinedIcon style={{ fontSize: 20, color: "#4b5563" }} />
      )}
    </button>
  );
}
