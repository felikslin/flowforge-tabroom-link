import { useState, useEffect, useRef, useCallback } from "react";
import { useTabroom } from "@/contexts/TabroomContext";
import { useToast } from "@/hooks/use-toast";
import type { TabId } from "@/types/flow";

interface MyRoundsTabProps {
  onTabChange: (tab: TabId) => void;
}

type TimerState = "idle" | "running" | "paused";

const WARNINGS = [
  { at: 4 * 60, label: "4 min remaining" },
  { at: 3 * 60, label: "3 min remaining" },
  { at: 2 * 60, label: "2 min remaining" },
  { at: 1 * 60, label: "1 min remaining" },
  { at: 0, label: "⏰ Time's up!" },
];

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function MyRoundsTab({ onTabChange }: MyRoundsTabProps) {
  const { myRounds, myRecord, pairings, coinFlip, selectedTournament, loading, errors, refreshMyRounds } = useTabroom();
  const { toast } = useToast();

  const hasRoundData = myRounds.length > 0;

  // Coin flip timer state
  const [timerDuration, setTimerDuration] = useState(5 * 60);
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [firedWarnings, setFiredWarnings] = useState<Set<number>>(new Set());
  const [manualMode, setManualMode] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<AudioContext | null>(null);

  // When coin flip data arrives, auto-configure the timer
  useEffect(() => {
    if (!coinFlip?.available) return;
    if (coinFlip.countdown_seconds && coinFlip.countdown_seconds > 0) {
      setTimerDuration(coinFlip.countdown_seconds);
      setTimeLeft(coinFlip.countdown_seconds);
      if (coinFlip.status === "active" && timerState === "idle") {
        startTimerInternal(coinFlip.countdown_seconds);
      }
    } else if (coinFlip.duration_minutes) {
      const secs = coinFlip.duration_minutes * 60;
      setTimerDuration(secs);
      setTimeLeft(secs);
    }
    if (coinFlip.status === "active") {
      toast({
        title: "🪙 Digital Coin Flip Active!",
        description: coinFlip.caller
          ? `${coinFlip.caller} is calling the flip.`
          : "A coin flip is in progress for this round.",
      });
    }
    if (coinFlip.assigned_side) {
      toast({
        title: `🪙 Side Assigned: ${coinFlip.assigned_side}`,
        description: `You have been assigned the ${coinFlip.assigned_side} side.`,
      });
    }
  }, [coinFlip]);

  const playBeep = useCallback((frequency = 660, duration = 200) => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = frequency;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + duration / 1000);
    } catch {
      // Audio not available
    }
  }, []);

  useEffect(() => {
    if (timerState !== "running") return;
    for (const w of WARNINGS) {
      if (timeLeft === w.at && !firedWarnings.has(w.at)) {
        setFiredWarnings((prev) => new Set(prev).add(w.at));
        const isUrgent = w.at <= 60;
        const isTimeUp = w.at === 0;
        toast({
          title: isTimeUp ? "⏰ Coin Flip Time's Up!" : `🪙 Coin Flip: ${w.label}`,
          description: isTimeUp
            ? "Submit your side selection now."
            : `${formatTime(w.at)} left to complete your coin flip.`,
          variant: isUrgent ? "destructive" : "default",
        });
        playBeep(isTimeUp ? 880 : isUrgent ? 770 : 660, isTimeUp ? 500 : 200);
        if (Notification.permission === "granted") {
          new Notification(isTimeUp ? "⏰ Coin Flip Time's Up!" : `🪙 ${w.label}`, {
            body: isTimeUp ? "Submit your side selection now." : `${formatTime(w.at)} remaining.`,
          });
        }
      }
    }
    if (timeLeft === timerDuration && !firedWarnings.has(timerDuration) && timerDuration > 0) {
      setFiredWarnings((prev) => new Set(prev).add(timerDuration));
      toast({
        title: "🪙 Coin Flip Timer Started",
        description: `${formatTime(timerDuration)} to complete the coin flip.`,
      });
      playBeep(550, 300);
    }
  }, [timeLeft, timerState, firedWarnings, toast, playBeep, timerDuration]);

  useEffect(() => {
    if (timerState === "running") {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 0) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setTimerState("idle");
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerState]);

  const startTimerInternal = (duration?: number) => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    const dur = duration || timerDuration;
    setTimeLeft(dur);
    setFiredWarnings(new Set());
    setTimerState("running");
  };

  const startTimer = () => startTimerInternal();
  const pauseTimer = () => setTimerState("paused");
  const resumeTimer = () => setTimerState("running");
  const resetTimer = () => {
    setTimerState("idle");
    setTimeLeft(timerDuration);
    setFiredWarnings(new Set());
  };

  const progress = timerDuration > 0 ? ((timerDuration - timeLeft) / timerDuration) * 100 : 0;
  const isUrgent = timeLeft <= 60 && timerState === "running";
  const showCoinFlip = coinFlip?.available || manualMode;
  const isCompleted = coinFlip?.status === "completed";

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        My Rounds
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        {selectedTournament?.name || "No tournament selected"}
        {hasRoundData && ` · ${myRecord.wins}–${myRecord.losses}`}
      </p>

      {/* Coin Flip Section */}
      {showCoinFlip && !isCompleted && (
        <div className={`flow-card mb-4 transition-colors ${isUrgent ? "border-destructive" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🪙</span>
              <span className="flow-label">
                {coinFlip?.available ? "Digital Coin Flip" : "Coin Flip Timer"}
              </span>
              {coinFlip?.available && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                  coinFlip.status === "active"
                    ? "bg-flow-gold-light text-flow-gold"
                    : "bg-flow-accent-light text-primary"
                }`}>
                  {coinFlip.status === "active" ? "LIVE" : coinFlip.status?.toUpperCase() || "DETECTED"}
                </span>
              )}
            </div>
            {timerState === "idle" && !coinFlip?.available && (
              <select
                value={timerDuration}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTimerDuration(v);
                  setTimeLeft(v);
                }}
                className="bg-flow-surface2 border border-border rounded-md px-2 py-1 text-[11px] outline-none"
              >
                <option value={300}>5 min</option>
                <option value={240}>4 min</option>
                <option value={180}>3 min</option>
                <option value={120}>2 min</option>
                <option value={60}>1 min</option>
              </select>
            )}
          </div>

          {coinFlip?.available && (
            <div className="flex flex-wrap gap-2 mb-2.5">
              {coinFlip.caller && (
                <span className="text-[10px] bg-flow-surface2 px-2 py-0.5 rounded-full">
                  Caller: {coinFlip.caller}
                </span>
              )}
              {coinFlip.assigned_side && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  coinFlip.assigned_side === "AFF"
                    ? "bg-flow-accent-light text-primary"
                    : "bg-flow-gold-light text-flow-gold"
                }`}>
                  Your side: {coinFlip.assigned_side}
                </span>
              )}
              {coinFlip.deadline && (
                <span className="text-[10px] bg-flow-surface2 px-2 py-0.5 rounded-full">
                  Deadline: {coinFlip.deadline}
                </span>
              )}
            </div>
          )}

          <div className="w-full h-1.5 rounded-full bg-flow-surface2 mb-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                isUrgent ? "bg-destructive" : "bg-primary"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span
              className={`text-[28px] font-mono font-medium tracking-tight ${
                isUrgent ? "text-destructive animate-pulse-dot" : "text-foreground"
              }`}
            >
              {formatTime(timeLeft)}
            </span>
            <div className="flex gap-1.5">
              {timerState === "idle" && (
                <button onClick={startTimer} className="px-3 py-1.5 rounded-md text-[11px] cursor-pointer bg-primary text-primary-foreground border-none font-medium">
                  ▶ Start
                </button>
              )}
              {timerState === "running" && (
                <button onClick={pauseTimer} className="px-3 py-1.5 rounded-md text-[11px] cursor-pointer bg-flow-gold text-primary-foreground border-none font-medium">
                  ⏸ Pause
                </button>
              )}
              {timerState === "paused" && (
                <button onClick={resumeTimer} className="px-3 py-1.5 rounded-md text-[11px] cursor-pointer bg-primary text-primary-foreground border-none font-medium">
                  ▶ Resume
                </button>
              )}
              {timerState !== "idle" && (
                <button onClick={resetTimer} className="px-3 py-1.5 rounded-md text-[11px] cursor-pointer bg-flow-surface2 text-muted-foreground border border-border font-medium">
                  ↻ Reset
                </button>
              )}
            </div>
          </div>

          {firedWarnings.size > 0 && (
            <div className="mt-3 border-t border-border pt-2.5">
              <div className="flow-label mb-1.5">Alerts Fired</div>
              <div className="flex flex-wrap gap-1.5">
                {WARNINGS.filter((w) => firedWarnings.has(w.at)).map((w) => (
                  <span key={w.at} className={`text-[10px] px-2 py-0.5 rounded-full ${
                    w.at === 0
                      ? "bg-destructive/20 text-destructive"
                      : w.at <= 60
                      ? "bg-flow-warn-light text-flow-warn"
                      : "bg-flow-accent-light text-primary"
                  }`}>
                    {w.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isCompleted && coinFlip?.assigned_side && (
        <div className="flow-card mb-4 border-primary">
          <div className="flex items-center gap-2">
            <span className="text-base">🪙</span>
            <span className="flow-label">Coin Flip Complete</span>
            <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
              coinFlip.assigned_side === "AFF"
                ? "bg-flow-accent-light text-primary"
                : "bg-flow-gold-light text-flow-gold"
            }`}>
              You are {coinFlip.assigned_side}
            </span>
          </div>
        </div>
      )}

      {!coinFlip?.available && !manualMode && (
        <button
          onClick={() => setManualMode(true)}
          className="mb-4 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-none"
        >
          🪙 Start a manual coin flip timer
        </button>
      )}

      {!selectedTournament && (
        <div className="text-center py-8 text-muted-foreground text-xs">
          Select a tournament from the{" "}
          <button onClick={() => onTabChange("entries")} className="text-primary underline bg-transparent border-none cursor-pointer text-xs">
            Entries tab
          </button>{" "}first.
        </div>
      )}

      {(loading.rounds || loading.pairings) && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Loading rounds…
        </div>
      )}

      {errors.rounds && (
        <div className="rounded-lg px-3 py-2.5 text-xs mb-3.5"
          style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
          {errors.rounds}
        </div>
      )}

      {selectedTournament && !loading.rounds && (
        <>
          {hasRoundData && (
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-flow-accent-light text-primary px-3 py-1.5 rounded-full text-xs font-medium">
                Record: {myRecord.wins}–{myRecord.losses}
              </div>
              <button
                onClick={refreshMyRounds}
                className="px-3 py-1.5 rounded-md font-mono text-[11px] cursor-pointer bg-primary text-primary-foreground border-none hover:brightness-90 transition-all"
              >
                ↻ Refresh
              </button>
            </div>
          )}

          {/* Live round data */}
          {hasRoundData && myRounds.map((r, i) => {
            const isWin = /w|win/i.test(r.decision);
            const isLoss = /l|loss/i.test(r.decision);
            const hasResult = isWin || isLoss;
            return (
              <div key={i} className="flow-card relative overflow-hidden mb-2.5">
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                  isWin ? "bg-primary" : isLoss ? "bg-destructive" : "bg-muted-foreground/30"
                }`} />
                <div className="pl-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium tracking-[-0.2px]">{r.round}</span>
                    {hasResult && (
                      <span className={`flow-badge ${isWin ? "bg-flow-accent-light text-primary" : "bg-flow-warn-light text-destructive"}`}>
                        {isWin ? "✓ Win" : "✗ Loss"}
                      </span>
                    )}
                    {!hasResult && r.opponent && (
                      <span className="flow-badge bg-flow-gold-light text-[hsl(var(--flow-gold))]">Current</span>
                    )}
                  </div>
                  {r.opponent && (
                    <div className="text-xs text-foreground mb-2">
                      vs. <span className="font-medium">{r.opponent}</span>
                    </div>
                  )}
                  <div className="flex gap-4 flex-wrap text-xs">
                    {r.side && (
                      <div className="flex flex-col gap-px">
                        <span className="flow-label">Side</span>
                        <span className="font-medium">{r.side}</span>
                      </div>
                    )}
                    {r.judge && (
                      <div className="flex flex-col gap-px">
                        <span className="flow-label">Judge</span>
                        <span className="font-medium">{r.judge}</span>
                      </div>
                    )}
                    {r.room && (
                      <div className="flex flex-col gap-px">
                        <span className="flow-label">Room</span>
                        <span className="font-medium">{r.room}</span>
                      </div>
                    )}
                    {r.points && (
                      <div className="flex flex-col gap-px">
                        <span className="flow-label">Speaks</span>
                        <span className="font-medium">{r.points}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 mt-2.5 flex-wrap">
                    {r.judge && (
                      <button onClick={() => onTabChange("judge")}
                        className="inline-flex items-center gap-1.5 bg-flow-accent-light text-primary px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer border-none font-mono transition-colors hover:bg-primary/20">
                        ⚖️ Paradigm
                      </button>
                    )}
                    {r.room && (
                      <button onClick={() => onTabChange("nav")}
                        className="inline-flex items-center gap-1.5 bg-flow-accent-light text-primary px-2.5 py-1.5 rounded-md text-[11px] font-medium cursor-pointer border-none font-mono transition-colors hover:bg-primary/20">
                        📍 Directions
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!hasRoundData && pairings.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground mb-3">
                Showing current pairings (detailed round data not yet available):
              </div>
              {pairings.map((p, i) => (
                <div key={i} className="flow-card relative overflow-hidden mb-2.5">
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
                  <div className="pl-2">
                    <div className="text-sm font-medium mb-2 tracking-[-0.2px]">
                      {p.aff} vs. {p.neg}
                    </div>
                    <div className="flex gap-4 flex-wrap">
                      {p.room && (
                        <div className="flex flex-col gap-px">
                          <span className="flow-label">Room</span>
                          <span className="text-xs font-medium">{p.room}</span>
                        </div>
                      )}
                      {p.judge && (
                        <div className="flex flex-col gap-px">
                          <span className="flow-label">Judge</span>
                          <span className="text-xs font-medium">{p.judge}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {!hasRoundData && pairings.length === 0 && !errors.rounds && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              No round data found yet. Pairings may not have been posted.
            </div>
          )}
        </>
      )}
    </div>
  );
}
