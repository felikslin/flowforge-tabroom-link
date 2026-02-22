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

async function tabroomFetch(path: string, token: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${TABROOM_WEB}${path}`;
  const decodedToken = decodeURIComponent(token);
  const cookieStr = `TabroomToken=${decodedToken}`;
  
  // Use redirect: "follow" for simplicity — cookies are preserved on same-origin redirects
  const res = await fetch(url, {
    ...options,
    headers: { Cookie: cookieStr, ...(options.headers || {}) },
    redirect: "follow",
  });
  return res;
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
      const dashRes = await tabroomFetch("/user/home.mhtml", token);
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

// ─── JUDGE PARADIGM ──────────────────────────────────────
function isLoginPage(html: string): boolean {
  const lower = html.toLowerCase();
  return lower.includes("log in to tabroom") || lower.includes("please login to view") || 
    lower.includes("login session has expired") || lower.includes("please log in again") ||
    lower.includes("showloginbox") ||
    (lower.includes("password") && lower.includes("email") && lower.includes("create a new account"));
}

function isNoResults(html: string): boolean {
  return /returned no judges/i.test(html) || /no results found/i.test(html);
}

function extractJudgeName(html: string): string | null {
  // Look for the judge's name specifically — Tabroom uses h4 for judge names on paradigm pages
  const h4Match = html.match(/<h4[^>]*>([\s\S]*?)<\/h4>/);
  if (h4Match?.[1]) {
    const name = h4Match[1].replace(/<[^>]+>/g, "").trim();
    // Filter out generic page titles
    if (name && !/(paradigm|tabroom|log in|judge|view past)/i.test(name)) return name;
  }
  // Try h2/h3
  const hMatches = html.matchAll(/<h[2-3][^>]*>([\s\S]*?)<\/h[2-3]>/gi);
  for (const m of hMatches) {
    const name = m[1].replace(/<[^>]+>/g, "").trim();
    if (name && name.length < 60 && !/(paradigm|tabroom|log in|search|judge paradigms|view past)/i.test(name)) return name;
  }
  return null;
}

function extractParadigm(html: string): string | null {
  if (isLoginPage(html) || isNoResults(html)) return null;
  
  const patterns = [
    /class="paradigm[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /id="paradigm[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*ltborderbottom[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*paradigm_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) {
      const text = m[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
      if (text.length > 20) return text;
    }
  }
  // Grab content after the judge name heading (h4)
  const bodyMatch = html.match(/<h4[^>]*>[\s\S]*?<\/h4>([\s\S]*?)(?:<div[^>]*class="[^"]*menu|<footer|$)/i);
  if (bodyMatch?.[1]) {
    const text = bodyMatch[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
    if (text.length > 20 && !isLoginPage(text) && !isNoResults(text)) return text;
  }
  return null;
}

async function handleJudge(body: { judge_id?: string; judge_name?: string; token?: string }) {
  if (!body.judge_id && !body.judge_name) return err("judge_id or judge_name is required");

  // Helper to fetch paradigm page (authenticated if token provided)
  async function fetchParadigmPage(url: string): Promise<string> {
    if (body.token) {
      const res = await tabroomFetch(url, body.token);
      return await res.text();
    }
    const res = await fetch(url);
    return await res.text();
  }

  try {
    if (body.judge_id) {
      const url = `${TABROOM_WEB}/index/paradigm.mhtml?judge_person_id=${body.judge_id}`;
      const html = await fetchParadigmPage(url);
      const name = extractJudgeName(html) || body.judge_name || "Unknown";
      return json({
        judge_id: body.judge_id,
        name: isLoginPage(html) ? (body.judge_name || "Unknown") : name,
        paradigm: extractParadigm(html),
        tabroom_url: url,
        html_preview: isLoginPage(html) ? undefined : html.substring(0, 5000),
      });
    }

    // Try tournaments.tech first
    try {
      const res = await fetch(`https://tournaments.tech/query?format=LD&term=${encodeURIComponent(body.judge_name!)}`, { signal: AbortSignal.timeout(5000) });
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        return json(data);
      } catch { /* fall through */ }
    } catch (ttErr) {
      console.log("tournaments.tech unavailable:", (ttErr as Error).message);
    }

    // Tabroom search fallback (authenticated)
    const firstName = body.judge_name!.split(" ")[0] || "";
    const lastName = body.judge_name!.split(" ").slice(1).join(" ") || body.judge_name!;
    const searchUrl = `${TABROOM_WEB}/index/paradigm.mhtml?search_first=${encodeURIComponent(firstName)}&search_last=${encodeURIComponent(lastName)}`;
    const searchHtml = await fetchParadigmPage(searchUrl);

    // Check if we got a login page
    if (isLoginPage(searchHtml)) {
      return json({
        name: body.judge_name,
        paradigm: null,
        error: "Tabroom requires login to view paradigms. Please ensure you're logged in.",
        tabroom_url: searchUrl,
      });
    }

    // Check for no results
    if (isNoResults(searchHtml)) {
      return json({
        name: body.judge_name,
        paradigm: null,
        tabroom_url: searchUrl,
        source: "tabroom_fallback",
      });
    }

    const judgeResults: Array<Record<string, string | null>> = [];
    const linkRegex = /judge_person_id=(\d+)[^>]*>([^<]+)/g;
    const seenIds = new Set<string>();
    let m;
    while ((m = linkRegex.exec(searchHtml)) !== null) {
      const name = m[2].trim();
      const id = m[1];
      // Filter out navigation links and duplicates
      if (seenIds.has(id) || /(view past|rating|paradigm|search|log in)/i.test(name)) continue;
      seenIds.add(id);
      judgeResults.push({ judge_id: id, name });
    }

    if (judgeResults.length === 1) {
      const pUrl = `${TABROOM_WEB}/index/paradigm.mhtml?judge_person_id=${judgeResults[0].judge_id}`;
      const pHtml = await fetchParadigmPage(pUrl);
      return json({
        judge_id: judgeResults[0].judge_id,
        name: judgeResults[0].name,
        paradigm: extractParadigm(pHtml),
        tabroom_url: pUrl,
        html_preview: isLoginPage(pHtml) ? undefined : pHtml.substring(0, 5000),
        source: "tabroom_fallback",
      });
    }

    // Check if the search page itself is a paradigm page (single result auto-displayed)
    if (judgeResults.length === 0) {
      const searchParadigm = extractParadigm(searchHtml);
      if (searchParadigm) {
        const name = body.judge_name || extractJudgeName(searchHtml) || "Unknown";
        return json({
          name,
          paradigm: searchParadigm,
          tabroom_url: searchUrl,
          source: "tabroom_fallback",
        });
      }
    }

    return json({
      results: judgeResults,
      total: judgeResults.length,
      source: "tabroom_fallback",
      html_preview: searchHtml.substring(0, 3000),
    });
  } catch (e) {
    return err(`Failed to fetch judge info: ${(e as Error).message}`, 502);
  }
}

// ─── FIND ENTRY ID ───────────────────────────────────────
async function findEntryId(token: string, tournId: string): Promise<string | null> {
  // Method 1: Try the postings index page — look for entry_record or entry_id links
  try {
    const res = await tabroomFetch(`/index/tourn/postings/index.mhtml?tourn_id=${tournId}`, token);
    const html = await res.text();
    const entryMatch = html.match(/entry_id=(\d+)/);
    if (entryMatch) return entryMatch[1];
    // Look for "Your Entry" or similar self-referencing links
    const selfMatch = html.match(/entry_record[^"]*entry_id=(\d+)/i);
    if (selfMatch) return selfMatch[1];
  } catch (e) {
    console.log("findEntryId postings failed:", (e as Error).message);
  }
  
  // Method 2: Try Mason API to get the user's entry for this tournament
  try {
    const decodedToken = decodeURIComponent(token);
    const cookieStr = `TabroomToken=${decodedToken}`;
    const res = await fetch(`https://masonapi.tabroom.com/v1/tourn/${tournId}/me`, {
      headers: { Cookie: cookieStr },
      redirect: "follow",
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`Mason API /me response:`, JSON.stringify(data).substring(0, 500));
      if (data?.entry?.id) return String(data.entry.id);
      if (data?.entries?.[0]?.id) return String(data.entries[0].id);
      // Try to find entry_id in any nested structure
      const jsonStr = JSON.stringify(data);
      const entryMatch = jsonStr.match(/"entry_id"\s*:\s*(\d+)/);
      if (entryMatch) return entryMatch[1];
      const idMatch = jsonStr.match(/"id"\s*:\s*(\d+)/);
      if (data?.entry || data?.entries) {
        if (idMatch) return idMatch[1];
      }
    } else {
      console.log(`Mason API /me returned ${res.status}`);
    }
  } catch (e) {
    console.log("Mason API failed:", (e as Error).message);
  }

  // Method 3: Try the student tournament-specific page
  try {
    const res = await tabroomFetch(`/user/student/tourn.mhtml?tourn_id=${tournId}`, token);
    const html = await res.text();
    const entryMatch = html.match(/entry_id=(\d+)/);
    if (entryMatch) return entryMatch[1];
  } catch (e) {
    console.log("findEntryId student/tourn failed:", (e as Error).message);
  }

  return null;
}

// ─── BALLOTS ─────────────────────────────────────────────
async function handleBallots(body: { token: string; tourn_id: string; entry_id?: string }) {
  if (!body.token || !body.tourn_id) return err("Token and tourn_id are required");

  try {
    // Strategy 1: Try entry_record with discovered entry_id
    let entryId = body.entry_id;
    if (!entryId) {
      entryId = await findEntryId(body.token, body.tourn_id) || undefined;
    }
    
    let html = "";
    
    if (entryId) {
      const path = `/index/tourn/postings/entry_record.mhtml?tourn_id=${body.tourn_id}&entry_id=${entryId}`;
      const res = await tabroomFetch(path, body.token);
      html = await res.text();
    }
    
    // Strategy 2: If no entry_id or entry_record failed, try public results page
    if (!entryId || html.includes("Invalid Entry ID")) {
      try {
        const res = await tabroomFetch(`/index/tourn/results/index.mhtml?tourn_id=${body.tourn_id}`, body.token);
        html = await res.text();
      } catch (e) {
        console.log("Public results fallback failed:", (e as Error).message);
      }
    }

    if (isLoginPage(html)) {
      return json({ rounds: [], total: 0, error: "Session expired. Please sign out and back in." });
    }

    // Parse round results
    const rounds: Array<Record<string, unknown>> = [];
    const roundRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let match;
    while ((match = roundRegex.exec(html)) !== null) {
      const row = match[1];
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
      const cellText = cells.map((c: string) => c.replace(/<[^>]+>/g, "").trim());
      if (cellText.length >= 4) {
        const roundLabel = cellText[0];
        if (roundLabel && /round|rd|r\d|elim|final|quarter|semi|octo/i.test(roundLabel)) {
          rounds.push({
            round: cellText[0], side: cellText[1] || "", opponent: cellText[2] || "",
            judge: cellText[3] || "", decision: cellText[4] || "", points: cellText[5] || "",
          });
        }
      }
    }

    return json({ rounds, total: rounds.length, html_preview: html.substring(0, 8000) });
  } catch (e) {
    return err(`Failed to fetch ballots: ${(e as Error).message}`, 502);
  }
}

// ─── MY ROUNDS (entry-specific current round data) ───────
async function handleMyRounds(body: { token: string; tourn_id: string }) {
  if (!body.token || !body.tourn_id) return err("Token and tourn_id are required");

  try {
    const entryId = await findEntryId(body.token, body.tourn_id);
    let html = "";

    if (entryId) {
      const res = await tabroomFetch(`/index/tourn/postings/entry_record.mhtml?tourn_id=${body.tourn_id}&entry_id=${entryId}`, body.token);
      html = await res.text();
    }

    if (!entryId || html.includes("Invalid Entry ID")) {
      try {
        const res = await tabroomFetch(`/index/tourn/results/index.mhtml?tourn_id=${body.tourn_id}`, body.token);
        html = await res.text();
      } catch (e) {
        console.log("MyRounds results fallback failed:", (e as Error).message);
      }
    }

    if (isLoginPage(html)) {
      return json({ rounds: [], record: { wins: 0, losses: 0 }, total: 0, error: "Session expired. Please sign out and back in." });
    }

    const rounds: Array<Record<string, string>> = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const cells = match[1].match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
      const ct = cells.map((c: string) => c.replace(/<[^>]+>/g, "").trim());
      if (ct.length >= 3) {
        const label = ct[0];
        if (label && /round|rd|r\s*\d|elim|final|quarter|semi|octo|double|triple/i.test(label)) {
          rounds.push({ round: ct[0], side: ct[1] || "", opponent: ct[2] || "", judge: ct[3] || "", decision: ct[4] || "", points: ct[5] || "", room: ct[6] || "" });
        }
      }
    }

    let wins = 0, losses = 0;
    for (const r of rounds) {
      const dec = (r.decision || "").toLowerCase();
      if (dec.includes("w") || dec.includes("win")) wins++;
      else if (dec.includes("l") || dec.includes("loss")) losses++;
    }

    return json({ rounds, record: { wins, losses }, total: rounds.length, html_preview: html.substring(0, 5000) });
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
    const res = await fetch(`${TABROOM_WEB}/index/index.mhtml`, { redirect: "follow" });
    const html = await res.text();

    const tournaments: Array<Record<string, string>> = [];
    // Tabroom homepage lists upcoming tournaments with links
    const tournRegex = /tourn_id=(\d+)[^>]*>\s*([^<]+)/g;
    let match;
    const seenIds = new Set<string>();
    while ((match = tournRegex.exec(html)) !== null) {
      const name = match[2].replace(/\s+/g, " ").trim();
      if (!seenIds.has(match[1]) && name.length > 1) {
        seenIds.add(match[1]);
        tournaments.push({ id: match[1], name });
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
    // Try authenticated student dashboard first (shows past tournaments with results)
    const urls: string[] = [];
    if (body.token) {
      urls.push(`${TABROOM_WEB}/user/student/index.mhtml`);
      urls.push(`${TABROOM_WEB}/user/student/history.mhtml`);
    }
    if (body.person_id) {
      urls.push(`${TABROOM_WEB}/index/results/ranked_list.mhtml?person_id=${body.person_id}`);
    }

    if (urls.length === 0) return err("person_id or token is required");

    for (const url of urls) {
      try {
        const res = body.token 
          ? await tabroomFetch(url, body.token) 
          : await fetch(url, { redirect: "follow" });
        const html = await res.text();

        // CRITICAL: detect expired/invalid sessions
        if (isLoginPage(html)) {
          console.log(`Session expired or login required for ${url}`);
          continue; // try next URL
        }

        const results: Array<Record<string, string>> = [];
        
        // Parse table rows - look for tournament result data
        // First, try to detect table headers to understand column mapping
        const headerMatch = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i) || 
                           html.match(/<tr[^>]*>\s*(<th[\s\S]*?)<\/tr>/i);
        
        let columnMap: string[] = [];
        if (headerMatch) {
          const headers = headerMatch[1].match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || [];
          columnMap = headers.map((h: string) => h.replace(/<[^>]+>/g, "").trim().toLowerCase());
        }

        const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
        let match;
        while ((match = rowRegex.exec(html)) !== null) {
          const row = match[1];
          if (/<th[\s>]/i.test(row)) continue;
          
          const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
          const ct = cells.map((c: string) => c.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
          
          if (ct.length < 2) continue;
          
          // Skip header-like rows and empty rows
          const firstLower = ct[0].toLowerCase();
          if (firstLower.includes("tournament") || firstLower.includes("event") || !ct[0]) continue;
          
          // Use column headers if available to map correctly
          if (columnMap.length >= 2) {
            const entry: Record<string, string> = { tournament: "", event: "", place: "", record: "" };
            for (let i = 0; i < ct.length && i < columnMap.length; i++) {
              const h = columnMap[i];
              if (h.includes("tourn") || h.includes("name")) entry.tournament = ct[i];
              else if (h.includes("event") || h.includes("division")) entry.event = ct[i];
              else if (h.includes("place") || h.includes("result") || h.includes("finish")) entry.place = ct[i];
              else if (h.includes("record") || h.includes("w-l") || h.includes("win")) entry.record = ct[i];
              else if (h.includes("date")) entry.dates = ct[i];
              else if (h.includes("location") || h.includes("city")) entry.location = ct[i];
            }
            // Only add if we have a tournament name
            if (entry.tournament) results.push(entry);
          } else {
            // Fallback: check if this looks like a tournament result row
            // Tournament names are usually longer than dates
            // Dates look like "2/20 - 2/22" or "Feb 20-22"
            const looksLikeDate = /^\d{1,2}\/\d{1,2}/.test(ct[0]) || /^[A-Z][a-z]{2}\s+\d/.test(ct[0]);
            
            if (looksLikeDate && ct.length >= 2) {
              // Columns: Date, Tournament, Location, State — it's the homepage upcoming list, skip
              continue;
            }
            
            // Check if we can extract tournament links from the row
            const linkMatch = match[1].match(/tourn_id=\d+[^>]*>([^<]+)/);
            const tournName = linkMatch ? linkMatch[1].trim() : ct[0];
            
            if (tournName && tournName.length > 3) {
              results.push({
                tournament: tournName,
                event: ct[1] || "",
                place: ct[2] || "",
                record: ct[3] || "",
              });
            }
          }
        }

        // Also try extracting from tournament links if table parsing yielded nothing
        if (results.length === 0) {
          const linkRegex = /tourn_id=(\d+)[^>]*>([^<]+)/g;
          let lm;
          const seenIds = new Set<string>();
          while ((lm = linkRegex.exec(html)) !== null) {
            const name = lm[2].trim();
            if (!seenIds.has(lm[1]) && name.length > 3 && !/log\s*in|search|paradigm/i.test(name)) {
              seenIds.add(lm[1]);
              results.push({
                tournament: name,
                event: "",
                place: "",
                record: "",
              });
            }
          }
        }

        if (results.length > 0) {
          return json({ results, total: results.length, html_preview: html.substring(0, 5000) });
        }
      } catch (e) {
        console.log(`Failed to fetch from ${url}:`, (e as Error).message);
      }
    }

    return json({ results: [], total: 0, error: "No results found. Your session may have expired — try signing out and back in." });
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
