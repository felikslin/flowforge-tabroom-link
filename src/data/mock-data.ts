import { RoundData, PairingRow } from "@/types/flow";

export const MOCK_ROUNDS: RoundData[] = [
  {
    round: "Round 3",
    status: "current",
    opponent: "Jordan Park",
    school: "Exeter Academy",
    room: "Sever 107",
    side: "AFF",
    judge: "M. Okafor",
    start: "11:00 AM",
  },
  {
    round: "Round 2",
    status: "complete",
    opponent: "Priya Mehta",
    school: "Hopkins School",
    room: "Emerson 105",
    result: "✓ W (3-0)",
    points: "29.1",
  },
  {
    round: "Round 1",
    status: "complete",
    opponent: "Alex Chen",
    school: "Bronx Science",
    room: "Emerson 201",
    result: "✓ W (2-1)",
    points: "28.4",
  },
  {
    round: "Round 4",
    status: "upcoming",
    opponent: "Pairings not yet posted",
    room: "",
    start: "1:30 PM",
  },
];

export const MOCK_PAIRINGS: PairingRow[][] = [
  [
    { room: "Emerson 201", aff: "Smith JS", neg: "Chen BX", judge: "Williams, Kate", isMe: true },
    { room: "Sever 107", aff: "Patel HA", neg: "Rivera SJ", judge: "Johnson, Marc" },
    { room: "Boylston 202", aff: "Kim SP", neg: "Torres EX", judge: "Davis, Alyssa" },
    { room: "Lamont B10", aff: "Wang GR", neg: "Osei RG", judge: "Brown, Tom" },
  ],
  [
    { room: "Emerson 105", aff: "Rivera SJ", neg: "Smith JS", judge: "Davis, Alyssa", isMe: true },
    { room: "Sever 107", aff: "Chen BX", neg: "Kim SP", judge: "Williams, Kate" },
    { room: "Boylston 202", aff: "Patel HA", neg: "Wang GR", judge: "Brown, Tom" },
    { room: "Lamont B10", aff: "Torres EX", neg: "Osei RG", judge: "Johnson, Marc" },
  ],
  [
    { room: "Sever 107", aff: "Smith JS", neg: "Park EX", judge: "Okafor, Michael", isMe: true },
    { room: "Emerson 201", aff: "Chen BX", neg: "Patel HA", judge: "Williams, Kate" },
    { room: "Boylston 202", aff: "Rivera SJ", neg: "Wang GR", judge: "Davis, Alyssa" },
    { room: "Lamont B10", aff: "Kim SP", neg: "Torres EX", judge: "Brown, Tom" },
  ],
];

export const MOCK_SCHEDULE = [
  { label: "Round 1", time: "8:00 AM", status: "done" as const },
  { label: "Round 2", time: "9:30 AM", status: "done" as const },
  { label: "Round 3", time: "11:00 AM", status: "now" as const },
  { label: "Lunch", time: "12:30 PM", status: "upcoming" as const },
  { label: "Round 4", time: "1:30 PM", status: "upcoming" as const },
  { label: "Round 5", time: "3:00 PM", status: "upcoming" as const },
  { label: "Elims Check", time: "5:00 PM", status: "upcoming" as const },
];

export const MOCK_NEARBY = [
  { icon: "🍕", name: "Pinocchio's Pizza", meta: "Pizza · ⭐ 4.6 · Until 10 PM", dist: "3 min", type: "food" },
  { icon: "☕", name: "Crema Café", meta: "Café · ⭐ 4.5 · Until 6 PM", dist: "5 min", type: "cafe" },
  { icon: "🌯", name: "Felipe's Taqueria", meta: "Mexican · ⭐ 4.4 · Until 11 PM", dist: "6 min", type: "food" },
  { icon: "💊", name: "CVS Pharmacy", meta: "Pharmacy & supplies · 24 hrs", dist: "4 min", type: "store" },
  { icon: "🥪", name: "Darwin's Ltd.", meta: "Café & sandwiches · ⭐ 4.7", dist: "7 min", type: "cafe" },
  { icon: "📚", name: "Harvard Book Store", meta: "Books & stationery · Until 9 PM", dist: "5 min", type: "store" },
];

export const CHAT_REPLIES: Record<string, string> = {
  dir: 'Two options to reach Sever 107:\n\n🏛 **Indoor:** Main doors → straight down corridor → Room 107 on the north (left) side, west end. ~2 min.\n\n📍 **Campus:** South through the Yard past John Harvard → red brick Sever on your right. ~3 min.',
  judge: 'Okafor votes AFF **58%**. Flow-centric, fine with speed, likes policy impacts and K. **Avoid frivolous T and blippy spikes.** You\'re well-positioned on AFF.',
  points: '**R1:** 28.4 (W 2-1) · **R2:** 29.1 (W 3-0). Average **28.8** — top quartile. Your 2AR crystallization in R2 was especially noted.',
  record: 'You\'re **2–0** — excellent shape for elims. Win R3 and you\'re almost certainly in the octofinals.',
  pep: '2–0 at Harvard with top-quartile speaks. Your judge favors AFF and you\'re prepped. Go protect your flow, trust your blocks, and close it out. 🔥',
  food: 'Closest: **Pinocchio\'s Pizza** (3 min), **Felipe\'s Taqueria** (6 min), **Darwin\'s** sandwiches (7 min). CVS is 4 min for quick snacks.',
};
