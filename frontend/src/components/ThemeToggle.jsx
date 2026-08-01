import { useDispatch, useSelector } from "react-redux";
import { toggleTheme } from "../features/ui/uiSlice";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";

export default function ThemeToggle() {
  const dispatch = useDispatch();
  const themeMode = useSelector((state) => state.ui.themeMode);
  const isDark = themeMode === "dark";

  return (
    <button
      onClick={() => dispatch(toggleTheme())}
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
