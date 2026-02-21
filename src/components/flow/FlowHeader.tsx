import { useEffect, useState } from "react";
import type { FlowUser } from "@/types/flow";

interface FlowHeaderProps {
  user: FlowUser;
  onSignOut: () => void;
}

export function FlowHeader({ user, onSignOut }: FlowHeaderProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const initial = user.name[0]?.toUpperCase() || "?";

  return (
    <header className="bg-card border-b border-border px-5 h-[52px] flex items-center justify-between flex-shrink-0 z-10 shadow-[0_1px_0_hsl(var(--border))]">
      <h1 className="font-serif text-[22px] font-extralight tracking-[-1px] italic">
        Fl<span className="text-primary not-italic">o</span>w
      </h1>

      <div className="flex items-center gap-2">
        <span className="bg-flow-accent-light text-primary text-[11px] font-medium px-3 py-1 rounded-full border border-primary/20">
          📍 Harvard Invitational 2025
        </span>
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
