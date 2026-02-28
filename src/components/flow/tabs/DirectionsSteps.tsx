import { useMemo } from "react";

interface DirectionsStepsProps {
  directions: google.maps.DirectionsResult | null;
  userLat: number | null;
  userLng: number | null;
}

function getDistanceBetween(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function maneuverIcon(maneuver: string | undefined): string {
  if (!maneuver) return "→";
  if (maneuver.includes("left")) return "↰";
  if (maneuver.includes("right")) return "↱";
  if (maneuver.includes("uturn")) return "↩";
  if (maneuver.includes("merge")) return "⤵";
  if (maneuver.includes("ramp")) return "↗";
  if (maneuver.includes("roundabout")) return "↻";
  return "→";
}

export function DirectionsSteps({ directions, userLat, userLng }: DirectionsStepsProps) {
  const steps = directions?.routes?.[0]?.legs?.[0]?.steps;

  // Find the closest upcoming step based on user position
  const activeStepIdx = useMemo(() => {
    if (!steps || userLat == null || userLng == null) return 0;

    let closestIdx = 0;
    let closestDist = Infinity;

    for (let i = 0; i < steps.length; i++) {
      const endLat = steps[i].end_location.lat();
      const endLng = steps[i].end_location.lng();
      const dist = getDistanceBetween(userLat, userLng, endLat, endLng);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    return closestIdx;
  }, [steps, userLat, userLng]);

  if (!steps || steps.length === 0) return null;

  const currentStep = steps[activeStepIdx];

  return (
    <div className="mt-3 space-y-2">
      {/* Current step highlight */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div className="flex items-start gap-3">
          <span className="text-[20px] mt-0.5 shrink-0">
            {maneuverIcon(currentStep.maneuver)}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className="text-[13px] font-medium text-foreground leading-snug"
              dangerouslySetInnerHTML={{ __html: currentStep.instructions }}
            />
            <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
              <span>{currentStep.distance?.text}</span>
              <span>{currentStep.duration?.text}</span>
            </div>
          </div>
          <span className="text-[10px] text-primary font-medium whitespace-nowrap">
            Step {activeStepIdx + 1}/{steps.length}
          </span>
        </div>
      </div>

      {/* All steps */}
      <details className="group">
        <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none py-1">
          All steps ({steps.length})
        </summary>
        <div className="mt-1.5 space-y-0 border-l-2 border-border ml-2">
          {steps.map((step, i) => {
            const isPast = i < activeStepIdx;
            const isCurrent = i === activeStepIdx;
            return (
              <div
                key={i}
                className={`relative pl-4 py-2 transition-opacity ${
                  isPast ? "opacity-40" : ""
                } ${isCurrent ? "bg-primary/5 rounded-r-md" : ""}`}
              >
                {/* Dot on the timeline */}
                <div
                  className={`absolute left-[-5px] top-3 w-2 h-2 rounded-full border-2 ${
                    isCurrent
                      ? "bg-primary border-primary"
                      : isPast
                      ? "bg-muted-foreground/40 border-muted-foreground/40"
                      : "bg-card border-border"
                  }`}
                />
                <div className="flex items-start gap-2">
                  <span className="text-[13px] shrink-0 mt-px">
                    {maneuverIcon(step.maneuver)}
                  </span>
                  <div className="min-w-0">
                    <div
                      className={`text-[11px] leading-snug ${
                        isCurrent ? "text-foreground font-medium" : "text-foreground/80"
                      }`}
                      dangerouslySetInnerHTML={{ __html: step.instructions }}
                    />
                    <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{step.distance?.text}</span>
                      <span>{step.duration?.text}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
