import { useState, useEffect, useRef, useCallback } from "react";
import { useTabroom } from "@/contexts/TabroomContext";
import { useToast } from "@/hooks/use-toast";

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

export function PairingsTab() {
  const { pairings, coinFlip, loading, errors, selectedTournament, refreshPairings, htmlPreviews } = useTabroom();
  const { toast } = useToast();

  // Coin flip timer
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

    // Set duration from Tabroom data
    if (coinFlip.countdown_seconds && coinFlip.countdown_seconds > 0) {
      setTimerDuration(coinFlip.countdown_seconds);
      setTimeLeft(coinFlip.countdown_seconds);
      // Auto-start if flip is active
      if (coinFlip.status === "active" && timerState === "idle") {
        startTimerInternal(coinFlip.countdown_seconds);
      }
    } else if (coinFlip.duration_minutes) {
      const secs = coinFlip.duration_minutes * 60;
      setTimerDuration(secs);
      setTimeLeft(secs);
    }

    // Show notification about coin flip
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

  // Fire warnings
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

    // Also fire initial warning at timer start (full duration)
    if (timeLeft === timerDuration && !firedWarnings.has(timerDuration) && timerDuration > 0) {
      setFiredWarnings((prev) => new Set(prev).add(timerDuration));
      toast({
        title: "🪙 Coin Flip Timer Started",
        description: `${formatTime(timerDuration)} to complete the coin flip.`,
      });
      playBeep(550, 300);
    }
  }, [timeLeft, timerState, firedWarnings, toast, playBeep, timerDuration]);

  // Timer tick
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
        All Pairings
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-5">
        {selectedTournament?.name || "No tournament selected"}
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

          {/* Coin flip info from Tabroom */}
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

          {/* Progress bar */}
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
                <button
                  onClick={startTimer}
                  className="px-3 py-1.5 rounded-md text-[11px] cursor-pointer bg-primary text-primary-foreground border-none font-medium"
                >
                  ▶ Start
                </button>
              )}
              {timerState === "running" && (
                <button
                  onClick={pauseTimer}
                  className="px-3 py-1.5 rounded-md text-[11px] cursor-pointer bg-flow-gold text-primary-foreground border-none font-medium"
                >
                  ⏸ Pause
                </button>
              )}
              {timerState === "paused" && (
                <button
                  onClick={resumeTimer}
                  className="px-3 py-1.5 rounded-md text-[11px] cursor-pointer bg-primary text-primary-foreground border-none font-medium"
                >
                  ▶ Resume
                </button>
              )}
              {timerState !== "idle" && (
                <button
                  onClick={resetTimer}
                  className="px-3 py-1.5 rounded-md text-[11px] cursor-pointer bg-flow-surface2 text-muted-foreground border border-border font-medium"
                >
                  ↻ Reset
                </button>
              )}
            </div>
          </div>

          {/* Warning log */}
          {firedWarnings.size > 0 && (
            <div className="mt-3 border-t border-border pt-2.5">
              <div className="flow-label mb-1.5">Alerts Fired</div>
              <div className="flex flex-wrap gap-1.5">
                {WARNINGS.filter((w) => firedWarnings.has(w.at)).map((w) => (
                  <span
                    key={w.at}
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      w.at === 0
                        ? "bg-destructive/20 text-destructive"
                        : w.at <= 60
                        ? "bg-flow-warn-light text-flow-warn"
                        : "bg-flow-accent-light text-primary"
                    }`}
                  >
                    {w.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Completed coin flip */}
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

      {/* Manual timer toggle when no coin flip detected */}
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
          Select a tournament from the Entries tab first.
        </div>
      )}

      {loading.pairings && (
        <div className="flex items-center gap-2 text-muted-foreground text-xs py-8 justify-center">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Loading pairings…
        </div>
      )}

      {errors.pairings && (
        <div className="rounded-lg px-3 py-2.5 text-xs mb-3.5"
          style={{ background: "rgba(196,81,42,.2)", border: "1px solid rgba(196,81,42,.4)", color: "#fca" }}>
          {errors.pairings}
        </div>
      )}

      {!loading.pairings && selectedTournament && (
        <>
          <div className="flex gap-2 mb-3.5">
            <button
              onClick={refreshPairings}
              className="px-3 py-1.5 rounded-md font-mono text-[11px] cursor-pointer bg-primary text-primary-foreground border-none hover:brightness-90 transition-all"
            >
              ↻ Refresh
            </button>
          </div>

          {pairings.length > 0 ? (
            <div className="flow-card p-0 overflow-hidden">
              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr>
                    {["Room", "AFF", "NEG", "Judge"].map((h) => (
                      <th key={h} className="text-left px-2.5 py-2 flow-label border-b border-border">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pairings.map((row, i) => (
                    <tr key={i} className="hover:bg-flow-surface2 transition-colors">
                      <td className="px-2.5 py-2.5 border-b border-border">{row.room}</td>
                      <td className="px-2.5 py-2.5 border-b border-border">{row.aff}</td>
                      <td className="px-2.5 py-2.5 border-b border-border">{row.neg}</td>
                      <td className="px-2.5 py-2.5 border-b border-border">
                        <span className="text-primary underline cursor-pointer">{row.judge}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-xs">
              {htmlPreviews.pairings
                ? "Pairings page loaded but no structured pairings were parsed. The raw HTML is available below."
                : "No pairings found for this tournament."}
            </div>
          )}

          {pairings.length === 0 && htmlPreviews.pairings && (
            <details className="mt-3">
              <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground">
                Show raw HTML preview
              </summary>
              <div
                className="mt-2 bg-flow-surface2 rounded-lg p-3 text-[11px] leading-[1.6] max-h-[300px] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: htmlPreviews.pairings }}
              />
            </details>
          )}
        </>
      )}

      <div className="text-[11px] text-muted-foreground mt-1.5">
        Data scraped from Tabroom. Tap judge name for paradigm.
      </div>
    </div>
  );
}
