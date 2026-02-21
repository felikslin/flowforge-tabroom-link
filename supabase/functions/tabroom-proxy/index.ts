import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TABROOM_WEB = "https://www.tabroom.com";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

async function tabroomFetch(path: string, token: string, options: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `${TABROOM_WEB}${path}`;
  return await fetch(url, {
    ...options,
    headers: { Cookie: `TabroomToken=${token}`, ...(options.headers || {}) },
    redirect: "manual",
  });
}

// ─── LOGIN ───────────────────────────────────────────────
async function handleLogin(body: { email: string; password: string }) {
  if (!body.email || !body.password) return err("Email and password are required");

  try {
    const res = await fetch(`${TABROOM_WEB}/user/login/login_save.mhtml`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `username=${encodeURIComponent(body.email)}&password=${encodeURIComponent(body.password)}`,
      redirect: "manual",
    });

    const setCookie = res.headers.get("set-cookie") || "";
    const location = res.headers.get("location") || "";
    await res.text();

    const tokenMatch = setCookie.match(/TabroomToken=([^;]+)/);
    const token = tokenMatch?.[1] || null;

    if (location.includes("err=") || !token || token === "") {
      const errMsg = decodeURIComponent(location.match(/err=([^&]*)/)?.[1] || "Invalid credentials");
      return json({ error: errMsg, success: false }, 401);
    }

    let personInfo: Record<string, unknown> = {};
    try {
      const dashRes = await tabroomFetch("/index/index.mhtml", token);
      const dashHtml = await dashRes.text();
      const personIdMatch = dashHtml.match(/person_id[=:]\s*["']?(\d+)/);
      const nameMatch = dashHtml.match(/Welcome[,\s]+([^<]+)/i) ||
        dashHtml.match(/class="[^"]*username[^"]*"[^>]*>([^<]+)/i);
      personInfo = { person_id: personIdMatch?.[1] || null, name: nameMatch?.[1]?.trim() || null };
    } catch (e) {
      console.log("Could not fetch dashboard info:", (e as Error).message);
    }

    return json({
      success: true,
      token,
      person_id: personInfo.person_id || null,
      name: personInfo.name || body.email.split("@")[0],
      email: body.email,
    });
  } catch (e) {
    return err(`Failed to connect to Tabroom: ${(e as Error).message}`, 502);
  }
}

// ─── MY TOURNAMENTS ──────────────────────────────────────
async function handleMyTournaments(body: { token: string }) {
  if (!body.token) return err("Token is required");
  try {
    const res = await tabroomFetch("/user/student/index.mhtml", body.token);
    const html = await res.text();

    const tournaments: Array<Record<string, string | null>> = [];
    const tournRegex = /tourn_id=(\d+)[^>]*>([^<]+)/g;
    let match;
    while ((match = tournRegex.exec(html)) !== null) {
      tournaments.push({ id: match[1], name: match[2].trim() });
    }

    return json({ tournaments, total: tournaments.length, html_preview: html.substring(0, 3000) });
  } catch (e) {
    return err(`Failed to fetch tournaments: ${(e as Error).message}`, 502);
  }
}

// ─── PAIRINGS ────────────────────────────────────────────
async function handlePairings(body: { token: string; tourn_id: string; event_id?: string; round_id?: string }) {
  if (!body.token || !body.tourn_id) return err("Token and tourn_id are required");

  try {
    let path = `/index/tourn/postings/index.mhtml?tourn_id=${body.tourn_id}`;
    if (body.event_id) path += `&event_id=${body.event_id}`;
    if (body.round_id) path += `&round_id=${body.round_id}`;

    const res = await tabroomFetch(path, body.token);
    const html = await res.text();

    const pairings: Array<Record<string, string>> = [];
    const rowRegex = /<tr[^>]*class="[^"]*row[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const cells = match[1].match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
      const cellText = cells.map((c: string) => c.replace(/<[^>]+>/g, "").trim());
      if (cellText.length >= 3) {
        pairings.push({ room: cellText[0] || "", aff: cellText[1] || "", neg: cellText[2] || "", judge: cellText[3] || "" });
      }
    }

    // Coin flip detection
    const coinFlip: Record<string, unknown> = { available: false };
    const htmlLower = html.toLowerCase();
    const hasFlip = htmlLower.includes("coin flip") || htmlLower.includes("flip for sides") ||
      htmlLower.includes("side_lock") || htmlLower.includes("flip_deadline") ||
      htmlLower.includes("digital flip") || htmlLower.includes("fliponline") || htmlLower.includes("sidelock");

    if (hasFlip) {
      coinFlip.available = true;
      const deadlineMatch = html.match(/(?:flip_deadline|side_lock|deadline)[^"]*["']?\s*[:=]\s*["']?([^"'<>\n]+)/i);
      if (deadlineMatch) coinFlip.deadline = deadlineMatch[1].trim();
      const countdownMatch = html.match(/(?:countdown|timer|seconds?_remaining|time_left)[^"]*["']?\s*[:=]\s*["']?(\d+)/i);
      if (countdownMatch) coinFlip.countdown_seconds = parseInt(countdownMatch[1]);
      if (htmlLower.includes("flip complete") || htmlLower.includes("sides locked")) coinFlip.status = "completed";
      else if (htmlLower.includes("flip in progress") || htmlLower.includes("flip now") || countdownMatch) coinFlip.status = "active";
      else coinFlip.status = "pending";
      const sideResultMatch = html.match(/(?:your side|you are|assigned)[^<]*?(AFF|NEG|Aff|Neg|aff|neg)/i);
      if (sideResultMatch) coinFlip.assigned_side = sideResultMatch[1].toUpperCase();
    }

    return json({ pairings, total: pairings.length, coin_flip: coinFlip, html_preview: html.substring(0, 5000) });
  } catch (e) {
    return err(`Failed to fetch pairings: ${(e as Error).message}`, 502);
  }
}

// ─── JUDGE PARADIGM (public) ─────────────────────────────
async function handleJudge(body: { judge_id?: string; judge_name?: string }) {
  if (!body.judge_id && !body.judge_name) return err("judge_id or judge_name is required");

  try {
    if (body.judge_id) {
      const res = await fetch(`${TABROOM_WEB}/index/paradigm.mhtml?judge_person_id=${body.judge_id}`);
      const html = await res.text();
      const paradigmMatch = html.match(/class="paradigm[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      const nameMatch = html.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/);
      return json({
        judge_id: body.judge_id,
        name: nameMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || "Unknown",
        paradigm: paradigmMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || null,
        html_preview: html.substring(0, 5000),
      });
    }

    try {
      const res = await fetch(`https://tournaments.tech/query?format=LD&term=${encodeURIComponent(body.judge_name!)}`, { signal: AbortSignal.timeout(5000) });
      const text = await res.text();
      try { return json(JSON.parse(text)); } catch { return json({ results: [], raw: text.substring(0, 2000) }); }
    } catch (ttErr) {
      console.log("tournaments.tech unavailable:", (ttErr as Error).message);
    }

    const searchRes = await fetch(`${TABROOM_WEB}/index/paradigm.mhtml?search_first=${encodeURIComponent(body.judge_name!.split(" ")[0] || "")}&search_last=${encodeURIComponent(body.judge_name!.split(" ").slice(1).join(" ") || body.judge_name!)}`);
    const searchHtml = await searchRes.text();
    const judgeResults: Array<Record<string, string | null>> = [];
    const linkRegex = /judge_person_id=(\d+)[^>]*>([^<]+)/g;
    let m;
    while ((m = linkRegex.exec(searchHtml)) !== null) {
      judgeResults.push({ judge_id: m[1], name: m[2].trim() });
    }
    if (judgeResults.length === 1) {
      const pRes = await fetch(`${TABROOM_WEB}/index/paradigm.mhtml?judge_person_id=${judgeResults[0].judge_id}`);
      const pHtml = await pRes.text();
      const paradigmMatch = pHtml.match(/class="paradigm[^"]*"[^>]*>([\s\S]*?)<\/div>/);
      return json({ judge_id: judgeResults[0].judge_id, name: judgeResults[0].name, paradigm: paradigmMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || null, source: "tabroom_fallback" });
    }
    return json({ results: judgeResults, total: judgeResults.length, source: "tabroom_fallback", html_preview: searchHtml.substring(0, 3000) });
  } catch (e) {
    return err(`Failed to fetch judge info: ${(e as Error).message}`, 502);
  }
}

// ─── BALLOTS ─────────────────────────────────────────────
async function handleBallots(body: { token: string; tourn_id: string; entry_id?: string }) {
  if (!body.token || !body.tourn_id) return err("Token and tourn_id are required");

  try {
    let path = `/index/tourn/postings/entry_record.mhtml?tourn_id=${body.tourn_id}`;
    if (body.entry_id) path += `&entry_id=${body.entry_id}`;

    const res = await tabroomFetch(path, body.token);
    const html = await res.text();

    // Parse round results from ballots page
    const rounds: Array<Record<string, unknown>> = [];
    const roundRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let match;
    while ((match = roundRegex.exec(html)) !== null) {
      const row = match[1];
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
      const cellText = cells.map((c: string) => c.replace(/<[^>]+>/g, "").trim());
      // Typical ballot table: Round, Side, Opponent, Judge, Decision, Points
      if (cellText.length >= 4) {
        const roundLabel = cellText[0];
        if (roundLabel && /round|rd|r\d|elim|final|quarter|semi|octo/i.test(roundLabel)) {
          rounds.push({
            round: cellText[0],
            side: cellText[1] || "",
            opponent: cellText[2] || "",
            judge: cellText[3] || "",
            decision: cellText[4] || "",
            points: cellText[5] || "",
          });
        }
      }
    }

    return json({
      rounds,
      total: rounds.length,
      html_preview: html.substring(0, 8000),
    });
  } catch (e) {
    return err(`Failed to fetch ballots: ${(e as Error).message}`, 502);
  }
}

// ─── MY ROUNDS (entry-specific current round data) ───────
async function handleMyRounds(body: { token: string; tourn_id: string }) {
  if (!body.token || !body.tourn_id) return err("Token and tourn_id are required");

  try {
    // Fetch the user's entry record page which has round-by-round results
    const res = await tabroomFetch(`/index/tourn/postings/entry_record.mhtml?tourn_id=${body.tourn_id}`, body.token);
    const html = await res.text();

    const rounds: Array<Record<string, string>> = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const cells = match[1].match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
      const ct = cells.map((c: string) => c.replace(/<[^>]+>/g, "").trim());
      if (ct.length >= 3) {
        const label = ct[0];
        if (label && /round|rd|r\s*\d|elim|final|quarter|semi|octo|double|triple/i.test(label)) {
          rounds.push({
            round: ct[0],
            side: ct[1] || "",
            opponent: ct[2] || "",
            judge: ct[3] || "",
            decision: ct[4] || "",
            points: ct[5] || "",
            room: ct[6] || "",
          });
        }
      }
    }

    // Try to determine record (W-L)
    let wins = 0, losses = 0;
    for (const r of rounds) {
      const dec = (r.decision || "").toLowerCase();
      if (dec.includes("w") || dec.includes("win")) wins++;
      else if (dec.includes("l") || dec.includes("loss")) losses++;
    }

    return json({
      rounds,
      record: { wins, losses },
      total: rounds.length,
      html_preview: html.substring(0, 5000),
    });
  } catch (e) {
    return err(`Failed to fetch rounds: ${(e as Error).message}`, 502);
  }
}

// ─── ENTRIES (detailed) ──────────────────────────────────
async function handleEntries(body: { token: string }) {
  if (!body.token) return err("Token is required");

  try {
    // Fetch student page for entry details
    const res = await tabroomFetch("/user/student/index.mhtml", body.token);
    const html = await res.text();

    // Also try the judge/competitor history page
    const entries: Array<Record<string, string | null>> = [];
    const entryRegex = /tourn_id=(\d+)[^>]*>([^<]+)/g;
    let match;
    const seenIds = new Set<string>();
    while ((match = entryRegex.exec(html)) !== null) {
      if (!seenIds.has(match[1])) {
        seenIds.add(match[1]);
        entries.push({ id: match[1], name: match[2].trim() });
      }
    }

    // Try to extract event info for each entry
    const eventRegex = /event[^>]*>([^<]+)/gi;
    const events: string[] = [];
    let em;
    while ((em = eventRegex.exec(html)) !== null) {
      events.push(em[1].trim());
    }

    // Try to extract dates
    const dateRegex = /(\w+\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?,?\s*\d{4})/g;
    const dates: string[] = [];
    let dm;
    while ((dm = dateRegex.exec(html)) !== null) {
      dates.push(dm[1].trim());
    }

    // Merge extra info
    const enriched = entries.map((e, i) => ({
      ...e,
      event: events[i] || null,
      dates: dates[i] || null,
    }));

    return json({ entries: enriched, total: enriched.length, html_preview: html.substring(0, 3000) });
  } catch (e) {
    return err(`Failed to fetch entries: ${(e as Error).message}`, 502);
  }
}

// ─── UPCOMING TOURNAMENTS (public) ───────────────────────
async function handleUpcoming() {
  try {
    const res = await fetch(`${TABROOM_WEB}/index/index.mhtml`);
    const html = await res.text();

    const tournaments: Array<Record<string, string>> = [];
    // Tabroom homepage lists upcoming tournaments
    const tournRegex = /tourn_id=(\d+)[^>]*>([^<]+)/g;
    let match;
    const seenIds = new Set<string>();
    while ((match = tournRegex.exec(html)) !== null) {
      if (!seenIds.has(match[1])) {
        seenIds.add(match[1]);
        tournaments.push({ id: match[1], name: match[2].trim() });
      }
    }

    return json({ tournaments: tournaments.slice(0, 50), total: tournaments.length });
  } catch (e) {
    return err(`Failed to fetch upcoming tournaments: ${(e as Error).message}`, 502);
  }
}

// ─── PAST RESULTS (competitor history) ───────────────────
async function handlePastResults(body: { person_id?: string; token?: string }) {
  try {
    // If person_id available, use the competitor history page
    if (body.person_id) {
      const res = await fetch(`${TABROOM_WEB}/index/results/ranked_list.mhtml?person_id=${body.person_id}`);
      const html = await res.text();

      const results: Array<Record<string, string>> = [];
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
      let match;
      while ((match = rowRegex.exec(html)) !== null) {
        const cells = match[1].match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
        const ct = cells.map((c: string) => c.replace(/<[^>]+>/g, "").trim());
        if (ct.length >= 2 && ct[0] && !ct[0].toLowerCase().includes("tournament")) {
          results.push({
            tournament: ct[0],
            event: ct[1] || "",
            place: ct[2] || "",
            record: ct[3] || "",
          });
        }
      }

      return json({ results, total: results.length, html_preview: html.substring(0, 5000) });
    }

    // Fallback: use token to get history from student page
    if (body.token) {
      const res = await tabroomFetch("/user/student/history.mhtml", body.token);
      const html = await res.text();
      return json({ html_preview: html.substring(0, 5000) });
    }

    return err("person_id or token is required");
  } catch (e) {
    return err(`Failed to fetch past results: ${(e as Error).message}`, 502);
  }
}

// ─── ROUTER ──────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const path = url.pathname.split("/").pop();

  if (req.method !== "POST") return err("Only POST requests are supported", 405);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err("Invalid JSON body"); }

  switch (path) {
    case "login": return handleLogin(body as any);
    case "my-tournaments": return handleMyTournaments(body as any);
    case "pairings": return handlePairings(body as any);
    case "judge": return handleJudge(body as any);
    case "ballots": return handleBallots(body as any);
    case "my-rounds": return handleMyRounds(body as any);
    case "entries": return handleEntries(body as any);
    case "upcoming": return handleUpcoming();
    case "past-results": return handlePastResults(body as any);
    default:
      return json({
        service: "Flow × Tabroom Proxy",
        endpoints: [
          "POST /login", "POST /my-tournaments", "POST /pairings",
          "POST /judge", "POST /ballots", "POST /my-rounds",
          "POST /entries", "POST /upcoming", "POST /past-results",
        ],
      });
  }
});
