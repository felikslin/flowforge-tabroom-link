import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTabroom } from "@/contexts/TabroomContext";
import { tabroomGetVenueMap, type TabroomVenueMap } from "@/lib/tabroom-api";

export function NavigationTab() {
  const { pairings, selectedTournament, user } = useTabroom();
  const [venueData, setVenueData] = useState<TabroomVenueMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const tournamentName = selectedTournament?.name || "No Tournament";

  // Fetch venue map when tournament changes
  useEffect(() => {
    if (!selectedTournament) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setVenueData(null);
    setActiveImageIdx(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });

    tabroomGetVenueMap(user.token, selectedTournament.id)
      .then((data) => {
        if (!cancelled) setVenueData(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [selectedTournament, user.token]);

  // Extract unique rooms from pairings
  const allRooms = useMemo(() => {
    const rooms = pairings.filter((p) => p.room).map((p) => p.room);
    return [...new Set(rooms)];
  }, [pairings]);

  const pairingRooms = pairings
    .filter((p) => p.room)
    .map((p, i) => ({ label: `Pairing ${i + 1}`, room: p.room }));

  // Filtered rooms based on search
  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return allRooms;
    const q = searchQuery.toLowerCase();
    return allRooms.filter((r) => r.toLowerCase().includes(q));
  }, [allRooms, searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Map interaction handlers
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.3, 4)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.3, 0.5)), []);
  const handleReset = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((z) => Math.min(Math.max(z + delta, 0.5), 4));
  }, []);

  const hasMap = venueData && (venueData.map_images.length > 0 || venueData.embedded_map_url);
  const activeImage = venueData?.map_images[activeImageIdx];

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Navigation
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-4">
        {tournamentName} · Venue map
      </p>

      {/* Room search */}
      {allRooms.length > 0 && (
        <div ref={searchRef} className="relative mb-3">
          <div className="flow-label mb-1.5">Find a Room</div>
          <input
            type="text"
            placeholder="Search rooms (e.g. Room 107)…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-[12px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary transition-colors"
          />
          {searchOpen && searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-[200px] overflow-y-auto">
              {filteredRooms.length === 0 ? (
                <div className="px-3 py-2.5 text-[11px] text-muted-foreground">No rooms match "{searchQuery}"</div>
              ) : (
                filteredRooms.map((room) => (
                  <button
                    key={room}
                    onClick={() => { setSelectedRoom(room); setSearchQuery(room); setSearchOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-[12px] border-none cursor-pointer transition-colors ${
                      selectedRoom === room
                        ? "bg-primary/10 text-primary font-medium"
                        : "bg-card text-foreground hover:bg-flow-surface2"
                    }`}
                  >
                    {room}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick-jump from pairings */}
      {pairingRooms.length > 0 && (
        <div className="mb-3">
          <div className="flow-label mb-1.5">Your Room Assignments</div>
          <div className="flex flex-wrap gap-1.5">
            {pairingRooms.map((r, i) => (
              <button
                key={i}
                onClick={() => { setSelectedRoom(r.room); setSearchQuery(r.room); }}
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

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-[12px]">Loading venue map…</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flow-card text-center py-8">
          <span className="text-2xl mb-2 block">⚠️</span>
          <p className="text-[12px] text-muted-foreground mb-2">Could not load venue map</p>
          <p className="text-[11px] text-muted-foreground/70">{error}</p>
        </div>
      )}

      {/* No map found */}
      {!loading && !error && venueData && !hasMap && (
        <div className="flow-card text-center py-10">
          <span className="text-3xl mb-2 block">🗺️</span>
          <p className="text-[12px] font-medium mb-1">No venue map available</p>
          <p className="text-[10px] text-muted-foreground mb-3">
            This tournament doesn't have a map on its Tabroom page
          </p>
          {venueData.venue_name && (
            <p className="text-[11px] text-foreground mb-1">📍 {venueData.venue_name}</p>
          )}
          {venueData.venue_address && (
            <a
              href={`https://maps.google.com?q=${encodeURIComponent(venueData.venue_address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-[11px] font-medium no-underline mt-2"
            >
              ↗ Open in Google Maps
            </a>
          )}
        </div>
      )}

      {/* Embedded Google Map */}
      {!loading && venueData?.embedded_map_url && (
        <div className="mb-3">
          <div className="flow-label mb-1.5">Venue Map</div>
          <div className="relative w-full aspect-[16/10] rounded-lg border border-border overflow-hidden">
            <iframe
              src={venueData.embedded_map_url}
              className="absolute inset-0 w-full h-full"
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Venue Map"
            />
          </div>
        </div>
      )}

      {/* Map images with zoom/pan */}
      {!loading && venueData && venueData.map_images.length > 0 && (
        <div>
          {/* Image selector if multiple */}
          {venueData.map_images.length > 1 && (
            <div className="flex items-center gap-1.5 mb-2">
              <div className="flow-label">Maps</div>
              <div className="flex gap-1 ml-auto">
                {venueData.map_images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setActiveImageIdx(i); setZoom(1); setPan({ x: 0, y: 0 }); }}
                    className={`w-7 h-7 rounded-md text-[10px] border-none cursor-pointer transition-all ${
                      i === activeImageIdx
                        ? "bg-primary text-primary-foreground font-medium"
                        : "bg-card text-muted-foreground hover:bg-flow-surface2"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Map viewer */}
          <div
            className="relative w-full aspect-[4/3] rounded-lg border border-border overflow-hidden bg-flow-surface2 select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
          >
            {activeImage && (
              <img
                src={activeImage}
                alt="Venue map"
                className="absolute inset-0 w-full h-full object-contain transition-transform duration-150"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
                draggable={false}
              />
            )}

            {/* Zoom controls */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10">
              <button
                onClick={handleZoomOut}
                className="w-7 h-7 rounded-md bg-card/90 backdrop-blur-sm border border-border text-foreground text-[14px] cursor-pointer flex items-center justify-center hover:bg-card"
              >
                −
              </button>
              <button
                onClick={handleReset}
                className="px-2 h-7 rounded-md bg-card/90 backdrop-blur-sm border border-border text-muted-foreground text-[10px] cursor-pointer hover:bg-card"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                className="w-7 h-7 rounded-md bg-card/90 backdrop-blur-sm border border-border text-foreground text-[14px] cursor-pointer flex items-center justify-center hover:bg-card"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Venue info & external link */}
      {!loading && venueData && (venueData.venue_name || venueData.venue_address) && (
        <div className="mt-3 flow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="flow-label">Venue</div>
              {venueData.venue_name && (
                <div className="text-[13px] font-medium">{venueData.venue_name}</div>
              )}
              {venueData.venue_address && (
                <div className="text-[11px] text-muted-foreground mt-0.5">{venueData.venue_address}</div>
              )}
            </div>
            <a
              href={`https://maps.google.com?q=${encodeURIComponent(
                venueData.venue_address || venueData.venue_name || tournamentName
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md text-[11px] font-medium no-underline flex-shrink-0"
            >
              ↗ Google Maps
            </a>
          </div>
        </div>
      )}

      {/* Selected room info */}
      {selectedRoom && (
        <div className="mt-3 flow-card">
          <div className="flex items-center justify-between">
            <div>
              <div className="flow-label">Looking for</div>
              <div className="text-[14px] font-medium">{selectedRoom}</div>
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
    </div>
  );
}
