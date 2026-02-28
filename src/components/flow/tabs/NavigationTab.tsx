import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTabroom } from "@/contexts/TabroomContext";
import { tabroomGetVenueMap, type TabroomVenueMap } from "@/lib/tabroom-api";
import { VenueGoogleMap } from "./VenueGoogleMap";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

  // Map interaction handlers for venue images
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

  const activeImage = venueData?.map_images[activeImageIdx];

  // Always generate a Google Maps embed as fallback using tournament name
  const fallbackMapQuery = venueData?.venue_address || venueData?.venue_name || tournamentName;
  const fallbackEmbedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(fallbackMapQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const embedUrl = venueData?.embedded_map_url || fallbackEmbedUrl;

  return (
    <div className="animate-fadein">
      <h2 className="font-serif text-[26px] font-extralight tracking-[-1px] italic mb-0.5">
        Navigation
      </h2>
      <p className="text-muted-foreground text-[11.5px] mb-3">
        {tournamentName} &middot; Venue map
      </p>

      {/* Quick-jump room buttons from pairings */}
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
          <p className="text-[12px]">Loading venue map...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flow-card text-center py-8">
          <p className="text-[12px] text-muted-foreground mb-2">Could not load venue map</p>
          <p className="text-[11px] text-muted-foreground/70">{error}</p>
        </div>
      )}

      {/* Google Maps - interactive SDK (full-screen) or iframe fallback */}
      {!loading && !error && venueData && (
        <div className="mb-3">
          {GOOGLE_MAPS_API_KEY ? (
            <VenueGoogleMap
              venueAddress={venueData.venue_address}
              venueName={venueData.venue_name}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              rooms={allRooms}
              selectedRoom={selectedRoom}
              onRoomSelect={(room) => { setSelectedRoom(room); setSearchQuery(room); }}
              tournamentName={tournamentName}
            />
          ) : (
            <>
              {/* Iframe fallback when no API key */}
              <div className="flow-label mb-1.5">Venue Map</div>
              <div className="relative w-full aspect-[16/10] rounded-lg border border-border overflow-hidden">
                <iframe
                  src={embedUrl}
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Venue Map"
                />
              </div>
              {venueData.venue_name && (
                <p className="text-[11px] text-foreground mt-2">{venueData.venue_name}</p>
              )}
              {venueData.venue_address && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{venueData.venue_address}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* Venue uploaded images (floor plans, campus maps) */}
      {!loading && venueData && venueData.map_images.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="flow-label">Venue Images</div>
            {/* Image selector if multiple */}
            {venueData.map_images.length > 1 && (
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
            )}
          </div>

          {/* Image viewer with zoom/pan */}
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
                -
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

      {/* Selected room card (only shown when no API key / no map overlay) */}
      {selectedRoom && !GOOGLE_MAPS_API_KEY && (
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
              External Maps
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
