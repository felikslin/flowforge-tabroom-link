import { useState, useRef, useCallback, useEffect } from "react";
import { useTabroom } from "@/contexts/TabroomContext";

interface RoomPin {
  id: string;
  label: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

interface VenueMap {
  id: string;
  name: string;
  floor: string;
  imageUrl: string;
  rooms: RoomPin[];
}

// Demo venue map data — in production this would come from a DB/storage
const DEMO_VENUES: VenueMap[] = [
  {
    id: "default",
    name: "Venue",
    floor: "Floor 1",
    imageUrl: "",
    rooms: [],
  },
];

export function NavigationTab() {
  const { pairings, selectedTournament } = useTabroom();
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [venues, setVenues] = useState<VenueMap[]>(DEMO_VENUES);
  const [activeVenueIdx, setActiveVenueIdx] = useState(0);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [newPins, setNewPins] = useState<RoomPin[]>([]);
  const [addingPin, setAddingPin] = useState(false);
  const [pinLabel, setPinLabel] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);

  const tournamentName = selectedTournament?.name || "No Tournament";
  const activeVenue = venues[activeVenueIdx];

  // Extract rooms from pairings for quick-jump
  const pairingRooms = pairings
    .filter((p) => p.room)
    .map((p, i) => ({ label: `Pairing ${i + 1}`, room: p.room }));

  // All pins (venue + user-added)
  const allPins = activeVenue ? [...activeVenue.rooms, ...newPins] : newPins;

  const handleMapClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!addingPin || !mapRef.current || !pinLabel.trim()) return;
      const rect = mapRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setNewPins((prev) => [
        ...prev,
        { id: `pin-${Date.now()}`, label: pinLabel.trim(), x, y },
      ]);
      setPinLabel("");
      setAddingPin(false);
    },
    [addingPin, pinLabel]
  );

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUploadedImage(reader.result as string);
      setVenues((prev) => {
        const copy = [...prev];
        if (copy[activeVenueIdx]) {
          copy[activeVenueIdx] = { ...copy[activeVenueIdx], imageUrl: reader.result as string };
        } else {
          copy.push({
            id: `venue-${Date.now()}`,
            name: "My Venue",
            floor: "Floor 1",
            imageUrl: reader.result as string,
            rooms: [],
          });
        }
        return copy;
      });
    };
    reader.readAsDataURL(file);
  };

  // Find route between two pins (simple: highlight start + end with line)
  const routeTarget = selectedRoom
    ? allPins.find(
        (p) => p.label.toLowerCase() === selectedRoom.toLowerCase()
      )
    : null;
  const startPin = allPins.find(
    (p) => p.label.toLowerCase().includes("lobby") || p.label.toLowerCase().includes("entrance")
  );

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Navigation
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-4">
        {tournamentName} · Indoor venue map
      </p>

      {/* Venue selector + edit toggle */}
      <div className="flex items-center gap-2 mb-3">
        {venues.length > 1 &&
          venues.map((v, i) => (
            <button
              key={v.id}
              onClick={() => setActiveVenueIdx(i)}
              className={`px-3 py-1.5 rounded-md text-[11px] border-none cursor-pointer font-mono transition-all ${
                i === activeVenueIdx
                  ? "bg-card text-foreground font-medium shadow-sm"
                  : "text-muted-foreground bg-flow-surface2"
              }`}
            >
              {v.floor}
            </button>
          ))}
        <button
          onClick={() => setEditMode(!editMode)}
          className={`ml-auto px-2.5 py-1.5 rounded-md text-[10px] border border-border cursor-pointer transition-all ${
            editMode ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground"
          }`}
        >
          {editMode ? "Done" : "✏️ Edit Map"}
        </button>
      </div>

      {/* Quick-jump from pairings */}
      {pairingRooms.length > 0 && (
        <div className="mb-3">
          <div className="flow-label mb-1.5">Your Room Assignments</div>
          <div className="flex flex-wrap gap-1.5">
            {pairingRooms.map((r, i) => (
              <button
                key={i}
                onClick={() => setSelectedRoom(r.room)}
                className={`px-2.5 py-1.5 rounded-md text-[11px] border cursor-pointer transition-all ${
                  selectedRoom === r.room
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-flow-surface2"
                }`}
              >
                {r.room}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Map area */}
      <div
        ref={mapRef}
        onClick={handleMapClick}
        className={`relative w-full aspect-[4/3] rounded-lg border border-border overflow-hidden ${
          addingPin ? "cursor-crosshair" : ""
        } ${!activeVenue?.imageUrl ? "bg-flow-surface2" : ""}`}
        style={
          activeVenue?.imageUrl
            ? { backgroundImage: `url(${activeVenue.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : undefined
        }
      >
        {!activeVenue?.imageUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <span className="text-3xl mb-2">🗺️</span>
            <p className="text-[12px] font-medium mb-1">No venue map uploaded</p>
            <p className="text-[10px] mb-3">Upload a floor plan image to get started</p>
            <label className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-[11px] font-medium cursor-pointer">
              Upload Floor Plan
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Route line */}
        {startPin && routeTarget && startPin.id !== routeTarget.id && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="hsl(var(--primary))" />
              </marker>
            </defs>
            <line
              x1={`${startPin.x}%`}
              y1={`${startPin.y}%`}
              x2={`${routeTarget.x}%`}
              y2={`${routeTarget.y}%`}
              stroke="hsl(var(--primary))"
              strokeWidth="2.5"
              strokeDasharray="6 4"
              markerEnd="url(#arrowhead)"
              opacity="0.8"
            />
          </svg>
        )}

        {/* Room pins */}
        {allPins.map((pin) => {
          const isTarget = selectedRoom && pin.label.toLowerCase() === selectedRoom.toLowerCase();
          const isStart = startPin?.id === pin.id && routeTarget && startPin.id !== routeTarget.id;
          return (
            <button
              key={pin.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedRoom(pin.label);
              }}
              className={`absolute flex flex-col items-center -translate-x-1/2 -translate-y-full border-none bg-transparent cursor-pointer transition-transform ${
                isTarget ? "scale-125 z-20" : "z-10"
              }`}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            >
              <span
                className={`px-2 py-1 rounded-md text-[10px] font-medium whitespace-nowrap shadow-sm ${
                  isTarget
                    ? "bg-primary text-primary-foreground animate-pulse-dot"
                    : isStart
                    ? "bg-flow-gold-light text-flow-gold border border-flow-gold"
                    : "bg-card text-foreground border border-border"
                }`}
              >
                {pin.label}
              </span>
              <span
                className={`w-2 h-2 rounded-full mt-0.5 ${
                  isTarget ? "bg-primary animate-glow" : "bg-muted-foreground"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* Edit controls */}
      {editMode && (
        <div className="mt-3 flow-card space-y-2.5">
          <div className="flow-label">Edit Venue Map</div>

          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card cursor-pointer text-[11px]">
            📷 Upload new floor plan
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </label>

          {activeVenue?.imageUrl && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Room label (e.g. Room 107)"
                value={pinLabel}
                onChange={(e) => setPinLabel(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-card text-[11px] outline-none"
              />
              <button
                onClick={() => setAddingPin(true)}
                disabled={!pinLabel.trim()}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium border-none cursor-pointer disabled:opacity-40"
              >
                📌 Place Pin
              </button>
            </div>
          )}

          {addingPin && (
            <div className="bg-flow-gold-light text-flow-gold text-[11px] px-3 py-2 rounded-lg">
              Click on the map to place "{pinLabel}"
            </div>
          )}

          {newPins.length > 0 && (
            <div>
              <div className="flow-label mb-1">Added Pins</div>
              <div className="flex flex-wrap gap-1">
                {newPins.map((p) => (
                  <span
                    key={p.id}
                    className="flex items-center gap-1 bg-flow-surface2 px-2 py-1 rounded-md text-[10px]"
                  >
                    {p.label}
                    <button
                      onClick={() => setNewPins((prev) => prev.filter((pin) => pin.id !== p.id))}
                      className="text-flow-warn bg-transparent border-none cursor-pointer text-[10px]"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected room info */}
      {selectedRoom && routeTarget && (
        <div className="mt-3 flow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="flow-label">Navigate to</div>
              <div className="text-[14px] font-medium">{selectedRoom}</div>
              {startPin && (
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  From {startPin.label} → {selectedRoom}
                </div>
              )}
            </div>
            <a
              href={`https://maps.google.com?q=${encodeURIComponent(selectedRoom + " " + tournamentName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md text-[11px] font-medium no-underline"
            >
              ↗ External Maps
            </a>
          </div>
        </div>
      )}

      {/* Room list */}
      {allPins.length > 0 && !editMode && (
        <div className="mt-3">
          <div className="flow-label mb-1.5">All Rooms</div>
          <div className="flow-card p-0">
            {allPins.map((pin, i) => (
              <button
                key={pin.id}
                onClick={() => setSelectedRoom(pin.label)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left border-none cursor-pointer transition-colors ${
                  selectedRoom === pin.label ? "bg-flow-accent-light" : "bg-transparent hover:bg-flow-surface2"
                } ${i < allPins.length - 1 ? "border-b border-border" : ""}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  selectedRoom === pin.label ? "bg-primary" : "bg-muted-foreground"
                }`} />
                <span className="text-[12px] font-medium">{pin.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
