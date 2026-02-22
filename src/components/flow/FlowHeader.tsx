import { useEffect, useState, useContext } from "react";
import { useTabroom } from "@/contexts/TabroomContext";

interface FlowHeaderProps {
  onSignOut: () => void;
}

export function FlowHeader({ onSignOut }: FlowHeaderProps) {
  let ctx: ReturnType<typeof useTabroom> | null = null;
  try { ctx = useTabroom(); } catch { /* provider not ready */ }
  const user = ctx?.user;
  const selectedTournament = ctx?.selectedTournament ?? null;
  const tournaments = ctx?.tournaments ?? [];
  const selectTournament = ctx?.selectTournament;
  const [time, setTime] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const initial = user?.name?.[0]?.toUpperCase() || "?";
  const tournName = selectedTournament?.name || "No Tournament Selected";

  if (!user) return null;

  return (
    <header className="bg-card border-b border-border px-5 h-[52px] flex items-center justify-between flex-shrink-0 z-10 shadow-[0_1px_0_hsl(var(--border))]">
      <h1 className="font-serif text-[22px] font-extralight tracking-[-1px] italic">
        Fl<span className="text-primary not-italic">o</span>w
      </h1>

      <div className="flex items-center gap-2 relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="bg-flow-accent-light text-primary text-[11px] font-medium px-3 py-1 rounded-full border border-primary/20 cursor-pointer hover:bg-primary/20 transition-colors"
        >
          📍 {tournName}
        </button>
        {showPicker && tournaments.length > 1 && (
          <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-lg shadow-lg z-50 min-w-[200px] py-1">
            {tournaments.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  selectTournament?.(t);
                  setShowPicker(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-flow-surface2 transition-colors ${
                  selectedTournament?.id === t.id ? "text-primary font-medium" : "text-foreground"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-primary font-medium">
          <div className="w-[7px] h-[7px] bg-primary rounded-full animate-pulse-dot" />
          Live
        </div>
        <span className="text-xs text-muted-foreground">{time}</span>
        <button
          onClick={onSignOut}
          className="flex items-center gap-2 bg-flow-surface2 border border-border rounded-full py-1.5 px-3 pl-1.5 text-[11px] cursor-pointer transition-colors hover:border-primary"
        >
          <div className="w-[22px] h-[22px] rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold flex-shrink-0">
            {initial}
          </div>
          <span>{user.name.split(" ")[0]}</span>
        </button>
      </div>
    </header>
  );
}
