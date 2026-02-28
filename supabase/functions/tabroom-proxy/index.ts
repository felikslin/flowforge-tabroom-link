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

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function tabroomFetch(path: string, token: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${TABROOM_WEB}${path}`;
  const decodedToken = decodeURIComponent(token);
  const cookieStr = `TabroomToken=${decodedToken}`;
  const res = await fetch(url, {
    ...options,
    headers: { 
      Cookie: cookieStr, 
      "User-Agent": BROWSER_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(options.headers || {}),
    },
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
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": BROWSER_UA },
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

    let personInfo: Record<string, unknown> = { person_id: null, name: null };
    
    // Strategy 1: Home page may have "Welcome, Name" or profile info
    const pagesToTry = [
      "/user/home.mhtml",
      "/user/login/profile.mhtml",
    ];
    for (const page of pagesToTry) {
      try {
        const dashRes = await tabroomFetch(page, token);
        const dashHtml = await dashRes.text();
        if (isLoginPage(dashHtml)) continue;
        
        // Extract person_id
        if (!personInfo.person_id) {
          const pidMatch = dashHtml.match(/person_id[=:]\s*["']?(\d+)/) || 
                           dashHtml.match(/personId[=:]\s*["']?(\d+)/);
          if (pidMatch) personInfo.person_id = pidMatch[1];
        }
        
        // Try form fields for name
        if (!personInfo.name) {
          // Tabroom profile uses name="first" value="..." and name="last" value="..."
          const firstMatch = dashHtml.match(/name\s*=\s*"first"[^>]*value\s*=\s*"([^"]+)"/i) ||
                            dashHtml.match(/name\s*=\s*"first_name"[^>]*value\s*=\s*"([^"]+)"/i) ||
                            dashHtml.match(/value\s*=\s*"([^"]+)"[^>]*name\s*=\s*"first"/i);
          const lastMatch = dashHtml.match(/name\s*=\s*"last"[^>]*value\s*=\s*"([^"]+)"/i) ||
                           dashHtml.match(/name\s*=\s*"last_name"[^>]*value\s*=\s*"([^"]+)"/i) ||
                           dashHtml.match(/value\s*=\s*"([^"]+)"[^>]*name\s*=\s*"last"/i);
          if (firstMatch?.[1] && lastMatch?.[1]) {
            personInfo.name = `${firstMatch[1].trim()} ${lastMatch[1].trim()}`;
            console.log(`Login: Found name from form fields on ${page}: "${personInfo.name}"`);
          }
        }
        
        // Try heading patterns
        if (!personInfo.name) {
          const welcomeMatch = dashHtml.match(/Welcome[,\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
          if (welcomeMatch?.[1]) {
            personInfo.name = welcomeMatch[1].trim();
            console.log(`Login: Found name from welcome on ${page}: "${personInfo.name}"`);
          }
        }
        
        // Log some context for debugging
        const inputFields = (dashHtml.match(/<input[^>]*(?:first|last|name)[^>]*>/gi) || []).slice(0, 3);
        if (inputFields.length > 0) console.log(`Login: Input fields on ${page}: ${JSON.stringify(inputFields)}`);
        
        if (personInfo.person_id && personInfo.name) break;
      } catch (e) {
        console.log(`Login: Could not fetch ${page}:`, (e as Error).message);
      }
    }
    
    // Strategy 2: Student index page for person_id
    if (!personInfo.person_id) {
      try {
        const res = await tabroomFetch("/user/student/index.mhtml", token);
        const html = await res.text();
        if (!isLoginPage(html)) {
          const pidMatch = html.match(/person_id[=:]\s*["']?(\d+)/) || 
                           html.match(/personId[=:]\s*["']?(\d+)/);
          if (pidMatch) personInfo.person_id = pidMatch[1];
        }
      } catch { /* skip */ }
    }
    
    // Strategy 3: Extract name from past-results entries
    // Past results entries contain codes like "SevLak Feliks Lin" or "Seven Lakes Chen & Lin"
    if (!personInfo.name && personInfo.person_id) {
      try {
        const prRes = await tabroomFetch(
          `/index/results/ranked_list.mhtml?person_id=${personInfo.person_id}`, token
        );
        const prHtml = await prRes.text();
        if (!isLoginPage(prHtml)) {
          // Look for the person's name in page headings (not "Not Found")
          const headingMatches = prHtml.matchAll(/<h[1-4][^>]*>\s*([\s\S]*?)\s*<\/h[1-4]>/gi);
          for (const hm of headingMatches) {
            const text = hm[1].replace(/<[^>]+>/g, "").trim();
            if (text.length >= 4 && text.length < 40 && /^[A-Z]/.test(text) && 
                !/not found|tabroom|log in|results|search/i.test(text) &&
                /\s/.test(text)) {
              personInfo.name = text;
              console.log(`Login: Found name from ranked_list heading: "${personInfo.name}"`);
              break;
            }
          }
        }
      } catch { /* skip */ }
    }
    
    console.log(`Login: Final person_id=${personInfo.person_id}, name=${personInfo.name}`);

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
  const h4Match = html.match(/<h4[^>]*>([\s\S]*?)<\/h4>/);
  if (h4Match?.[1]) {
    const name = h4Match[1].replace(/<[^>]+>/g, "").trim();
    if (name && !/(paradigm|tabroom|log in|judge|view past)/i.test(name)) return name;
  }
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
  const bodyMatch = html.match(/<h4[^>]*>[\s\S]*?<\/h4>([\s\S]*?)(?:<div[^>]*class="[^"]*menu|<footer|$)/i);
  if (bodyMatch?.[1]) {
    const text = bodyMatch[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
    if (text.length > 20 && !isLoginPage(text) && !isNoResults(text)) return text;
  }
  return null;
}

async function handleJudge(body: { judge_id?: string; judge_name?: string; token?: string }) {
  if (!body.judge_id && !body.judge_name) return err("judge_id or judge_name is required");

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

    try {
      const res = await fetch(`https://tournaments.tech/query?format=LD&term=${encodeURIComponent(body.judge_name!)}`, { signal: AbortSignal.timeout(5000) });
      const text = await res.text();
      try {
        const ttData = JSON.parse(text);
        console.log("tournaments.tech response:", JSON.stringify(ttData).substring(0, 500));
        // Map tournaments.tech response to our TabroomJudgeInfo format
        if (ttData && (ttData.paradigm || ttData.name)) {
          return json({
            judge_id: ttData.judge_id || ttData.id || undefined,
            name: ttData.name || body.judge_name,
            paradigm: ttData.paradigm || null,
            tabroom_url: ttData.tabroom_url || ttData.url || (ttData.judge_id ? `${TABROOM_WEB}/index/paradigm.mhtml?judge_person_id=${ttData.judge_id}` : undefined),
            html_preview: ttData.html_preview || undefined,
            source: "tournaments_tech",
          });
        }
        // If tournaments.tech returned results array, map it
        if (Array.isArray(ttData)) {
          if (ttData.length === 1 && ttData[0]) {
            return json({
              judge_id: ttData[0].judge_id || ttData[0].id || undefined,
              name: ttData[0].name || body.judge_name,
              paradigm: ttData[0].paradigm || null,
              tabroom_url: ttData[0].url || undefined,
              source: "tournaments_tech",
            });
          }
          if (ttData.length > 1) {
            return json({
              name: body.judge_name,
              results: ttData.map((j: Record<string, unknown>) => ({
                judge_id: String(j.judge_id || j.id || ""),
                name: String(j.name || "Unknown"),
              })),
              total: ttData.length,
              source: "tournaments_tech",
            });
          }
        }
        // Unrecognized format — fall through to Tabroom scraping
      } catch { /* fall through */ }
    } catch (ttErr) {
      console.log("tournaments.tech unavailable:", (ttErr as Error).message);
    }

    const firstName = body.judge_name!.split(" ")[0] || "";
    const lastName = body.judge_name!.split(" ").slice(1).join(" ") || body.judge_name!;
    const searchUrl = `${TABROOM_WEB}/index/paradigm.mhtml?search_first=${encodeURIComponent(firstName)}&search_last=${encodeURIComponent(lastName)}`;
    const searchHtml = await fetchParadigmPage(searchUrl);

    if (isLoginPage(searchHtml)) {
      return json({
        name: body.judge_name,
        paradigm: null,
        warning: "Tabroom requires login to view paradigms. Please ensure you're logged in.",
        tabroom_url: searchUrl,
      });
    }

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
      name: body.judge_name || "Multiple Results",
      results: judgeResults,
      total: judgeResults.length,
      source: "tabroom_fallback",
      html_preview: searchHtml.substring(0, 3000),
    });
  } catch (e) {
    return err(`Failed to fetch judge info: ${(e as Error).message}`, 502);
  }
}

// ─── NAME MATCHING ───────────────────────────────────────
/** Check if a cell text matches the user's name (handles "Last, First" and "First Last" and team entries like "School Name AB") */
function nameMatches(cellText: string, userName: string): boolean {
  if (!userName || !cellText) return false;
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const userNorm = normalize(userName);
  const cellNorm = normalize(cellText);
  
  // Direct match
  if (cellNorm.includes(userNorm) || userNorm.includes(cellNorm)) return true;
  
  // Split user name into parts
  const parts = userName.trim().split(/\s+/);
  if (parts.length < 2) return cellNorm.includes(normalize(parts[0]));
  
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  
  // "Last, First" format
  if (cellText.toLowerCase().includes(lastName.toLowerCase()) && cellText.toLowerCase().includes(firstName.toLowerCase())) return true;
  
  // Last name + first initial (common in PF: "Smith & Jones" or entry codes like "Smith Jo")
  const lastNorm = normalize(lastName);
  const firstInitial = firstName[0]?.toLowerCase() || "";
  if (cellNorm.includes(lastNorm) && cellText.toLowerCase().includes(firstInitial)) return true;
  
  return false;
}

// ─── FIND ENTRY ID ───────────────────────────────────────
async function findEntryId(token: string, tournId: string, personName?: string): Promise<string | null> {
  // Method 1: Student index page — scan for entry_id or student_id links for this tournament
  let studentId: string | null = null;
  try {
    const res = await tabroomFetch(`/user/student/index.mhtml`, token);
    const html = await res.text();
    if (!isLoginPage(html)) {
      // Look for entry_id
      const entryLinkRegex = new RegExp(`tourn_id=${tournId}[^"]*entry_id=(\\d+)`, 'g');
      const match = entryLinkRegex.exec(html);
      if (match) { console.log(`findEntryId: Found entry ${match[1]} via student/index`); return match[1]; }
      const reverseRegex = new RegExp(`entry_id=(\\d+)[^"]*tourn_id=${tournId}`, 'g');
      const rMatch = reverseRegex.exec(html);
      if (rMatch) { console.log(`findEntryId: Found entry ${rMatch[1]} via reverse`); return rMatch[1]; }
      
      // Extract student_id for this tournament
      const studentIdRegex = new RegExp(`tourn_id=${tournId}[^"]*student_id=(\\d+)`);
      const sMatch = studentIdRegex.exec(html);
      if (sMatch) { studentId = sMatch[1]; console.log(`findEntryId: Found student_id=${studentId} for tourn ${tournId}`); }
    }
  } catch (e) { console.log("findEntryId student/index failed:", (e as Error).message); }

  // Method 2: Use student_id to fetch student tournament page and find entry_id
  if (studentId) {
    try {
      const res = await tabroomFetch(`/user/student/tourn.mhtml?tourn_id=${tournId}&student_id=${studentId}`, token);
      const html = await res.text();
      if (!isLoginPage(html) && !html.includes("404 Not Found")) {
        const entryMatch = html.match(/entry_id=(\d+)/);
        if (entryMatch) { console.log(`findEntryId: Found ${entryMatch[1]} via student/tourn with student_id`); return entryMatch[1]; }
        // Parse rounds directly from this page if it has them
        const parsed = parseRoundsFromHtml(html);
        if (parsed.length > 0) {
          console.log(`findEntryId: student/tourn page has ${parsed.length} rounds directly (no entry_id needed)`);
          // Store in a way the caller can use - return special marker
          return `__HTML__${tournId}__${studentId}`;
        }
      }
    } catch (e) { console.log("findEntryId student/tourn failed:", (e as Error).message); }
  }

  // Method 3: Student tournament page without student_id
  try {
    const res = await tabroomFetch(`/user/student/tourn.mhtml?tourn_id=${tournId}`, token);
    const html = await res.text();
    if (!isLoginPage(html) && !html.includes("404 Not Found")) {
      const entryMatch = html.match(/entry_id=(\d+)/);
      if (entryMatch) { console.log(`findEntryId: Found ${entryMatch[1]} via student/tourn`); return entryMatch[1]; }
    }
  } catch (e) { console.log("findEntryId student/tourn failed:", (e as Error).message); }

  console.log(`findEntryId: No entry found for tourn ${tournId}`);
  return null;
}

// ─── PARSE ROUNDS FROM HTML ─────────────────────────────
function parseRoundsFromHtml(html: string): Array<Record<string, string>> {
  const rounds: Array<Record<string, string>> = [];
  
  const headerMatch = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i) ||
                     html.match(/<tr[^>]*>\s*(<th[\s\S]*?)<\/tr>/i);
  let columnMap: string[] = [];
  if (headerMatch) {
    const headers = headerMatch[1].match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || [];
    columnMap = headers.map((h: string) => h.replace(/<[^>]+>/g, "").trim().toLowerCase());
  }

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    if (/<th[\s>]/i.test(row)) continue;
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [];
    const cellText = cells.map((c: string) => c.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    if (cellText.length < 3) continue;

    if (columnMap.length >= 3) {
      const entry: Record<string, string> = {};
      for (let i = 0; i < cellText.length && i < columnMap.length; i++) {
        const h = columnMap[i];
        if (h.includes("round") || h.includes("rd") || h === "r") entry.round = cellText[i];
        else if (h.includes("side")) entry.side = cellText[i];
        else if (h.includes("opp")) entry.opponent = cellText[i];
        else if (h.includes("judge") || h.includes("panel")) entry.judge = cellText[i];
        else if (h.includes("decision") || h.includes("result") || h.includes("ballot") || h.includes("w/l")) entry.decision = cellText[i];
        else if (h.includes("point") || h.includes("speak") || h.includes("pts")) entry.points = cellText[i];
        else if (h.includes("room")) entry.room = cellText[i];
      }
      if (entry.round) rounds.push(entry);
    } else {
      const label = cellText[0];
      if (label && /round|rd|r\s*\d|elim|final|quarter|semi|octo|double|triple/i.test(label)) {
        rounds.push({
          round: cellText[0], side: cellText[1] || "", opponent: cellText[2] || "",
          judge: cellText[3] || "", decision: cellText[4] || "", points: cellText[5] || "",
          room: cellText[6] || "",
        });
      }
    }
  }
  return rounds;
}

// ─── BALLOTS ─────────────────────────────────────────────
async function handleBallots(body: { token: string; tourn_id: string; entry_id?: string; entry_name?: string; person_name?: string; person_id?: string }) {
  if (!body.token || !body.tourn_id) return err("Token and tourn_id are required");

  try {
    const pages: string[] = [];

    // Strategy 1: Find user's entry_id (now with name-based search)
    let entryId = body.entry_id;
    if (!entryId) {
      entryId = await findEntryId(body.token, body.tourn_id, body.person_name) || undefined;
    }

    // Strategy 1b: If person_id is available and no entry found, try person_id lookup
    if (!entryId && body.person_id) {
      try {
        const res = await tabroomFetch(
          `/index/results/ranked_list.mhtml?person_id=${body.person_id}&tourn_id=${body.tourn_id}`, body.token
        );
        const html = await res.text();
        if (!isLoginPage(html) && !html.includes("404 Not Found")) {
          const match = html.match(/entry_id=(\d+)/);
          if (match) {
            entryId = match[1];
            console.log(`Ballots: Found entry_id=${entryId} via person_id=${body.person_id}`);
          }
        }
      } catch (e) { console.log("Ballots person_id lookup failed:", (e as Error).message); }
    }
    
    if (entryId && entryId.startsWith("__HTML__")) {
      // findEntryId found rounds directly on the student/tourn page — fetch it again
      const parts = entryId.split("__");
      const sid = parts[4]; // student_id
      try {
        const res = await tabroomFetch(`/user/student/tourn.mhtml?tourn_id=${body.tourn_id}&student_id=${sid}`, body.token);
        const html = await res.text();
        if (!isLoginPage(html) && !html.includes("404 Not Found")) {
          pages.push(html);
          console.log(`Ballots: Got student/tourn page with student_id=${sid}, len=${html.length}`);
        }
      } catch (e) { console.log("Ballots: student/tourn fetch failed:", (e as Error).message); }
    } else if (entryId) {
      const path = `/index/tourn/postings/entry_record.mhtml?tourn_id=${body.tourn_id}&entry_id=${entryId}`;
      const res = await tabroomFetch(path, body.token);
      const html = await res.text();
      if (!html.includes("Invalid Entry ID") && !isLoginPage(html) && !html.includes("404 Not Found")) {
        pages.push(html);
        console.log(`Ballots: Got entry_record for entry_id=${entryId}, len=${html.length}`);
      }
    }

    // Strategy 2: Search public results for user's name and get their entry_record
    if (pages.length === 0 && body.person_name) {
      try {
        const indexRes = await tabroomFetch(`/index/tourn/results/index.mhtml?tourn_id=${body.tourn_id}`, body.token);
        const indexHtml = await indexRes.text();
        const indexBlocked = isLoginPage(indexHtml);
        console.log(`Ballots: Results index for tourn ${body.tourn_id}: blocked=${indexBlocked}, 404=${indexHtml.includes("404 Not Found")}, len=${indexHtml.length}`);
        
        if (!indexBlocked && !indexHtml.includes("404 Not Found")) {
          const eventLinks: string[] = [];
          const seenLinks = new Set<string>();
          const allLinkRegex = /href="([^"]*(?:event_results|round_results)[^"]*)"/g;
          let lm;
          while ((lm = allLinkRegex.exec(indexHtml)) !== null) {
            if (!seenLinks.has(lm[1])) {
              seenLinks.add(lm[1]);
              eventLinks.push(lm[1]);
            }
          }

          console.log(`Ballots: Found ${eventLinks.length} result links for tourn ${body.tourn_id}, person_name="${body.person_name}"`);
          
          // Search each results page for the user's name
          for (const link of eventLinks.slice(0, 4)) {
            try {
              const fullLink = link.startsWith("http") ? link : `${TABROOM_WEB}${link}`;
              const res = await tabroomFetch(fullLink, body.token);
              const html = await res.text();
              const pageBlocked = isLoginPage(html);
              console.log(`Ballots: Result page ${fullLink.substring(0, 100)}: blocked=${pageBlocked}, len=${html.length}`);
              if (pageBlocked || html.includes("404 Not Found")) continue;
              
              // Log first few entry_id links and sample rows to debug name matching
              const allEntryIds = [...new Set((html.match(/entry_id=(\d+)/g) || []).map((m: string) => m.replace("entry_id=", "")))];
              console.log(`Ballots: Page has ${allEntryIds.length} unique entry_ids`);
              
              // Sample a few rows to see what names look like
              const sampleRows: string[] = [];
              const sampleRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
              let sampleMatch;
              let sampleCount = 0;
              while ((sampleMatch = sampleRegex.exec(html)) !== null && sampleCount < 3) {
                const rowText = sampleMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
                if (rowText.length > 10 && !/<th/i.test(sampleMatch[1])) {
                  sampleRows.push(rowText.substring(0, 200));
                  sampleCount++;
                }
              }
              console.log(`Ballots: Sample rows: ${JSON.stringify(sampleRows)}`);
              
              // Find user's entry_id by scanning rows for their name
              const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
              let rowMatch;
              let foundEntryId: string | null = null;
              
              while ((rowMatch = rowRegex.exec(html)) !== null) {
                const row = rowMatch[1];
                const rowText = row.replace(/<[^>]+>/g, " ");
                if (nameMatches(rowText, body.person_name)) {
                  const eidMatch = row.match(/entry_id=(\d+)/);
                  if (eidMatch) {
                    foundEntryId = eidMatch[1];
                    console.log(`Ballots: Found user entry_id=${foundEntryId} on results page by name "${body.person_name}"`);
                    break;
                  } else {
                    console.log(`Ballots: Name matched but no entry_id in row: ${rowText.substring(0, 200)}`);
                  }
                }
              }
              
              if (foundEntryId) {
                // Fetch the user's specific entry_record
                const erRes = await tabroomFetch(
                  `/index/tourn/postings/entry_record.mhtml?tourn_id=${body.tourn_id}&entry_id=${foundEntryId}`,
                  body.token
                );
                const erHtml = await erRes.text();
                if (!isLoginPage(erHtml) && !erHtml.includes("404 Not Found")) {
                  pages.push(erHtml);
                  console.log(`Ballots: Got entry_record for name-matched entry_id=${foundEntryId}`);
                  break;
                }
              }
            } catch (e) { 
              console.log(`Ballots: Error fetching result link: ${(e as Error).message}`);
            }
          }
        }
      } catch (e) {
        console.log("Ballots: Public results search failed:", (e as Error).message);
      }
    }

    // Strategy 3: Student tournament page (authenticated, user-specific)
    if (pages.length === 0) {
      try {
        const res = await tabroomFetch(`/user/student/tourn.mhtml?tourn_id=${body.tourn_id}`, body.token);
        const html = await res.text();
        if (!isLoginPage(html) && !html.includes("404 Not Found")) pages.push(html);
      } catch (e) {
        console.log("Ballots: student/tourn fallback failed:", (e as Error).message);
      }
    }

    // Parse all collected pages
    let allRounds: Array<Record<string, string>> = [];
    let bestHtml = "";
    for (const html of pages) {
      const parsed = parseRoundsFromHtml(html);
      if (parsed.length > allRounds.length) {
        allRounds = parsed;
        bestHtml = html;
      }
    }

    // Extract placement info
    let placement: string | null = null;
    for (const html of [bestHtml, ...pages]) {
      if (!html) continue;
      const placeMatch = html.match(/(?:place|finish|result|rank)[^<]*?:\s*([^<\n]+)/i) ||
                        html.match(/(?:1st|2nd|3rd|\d+th)\s+(?:place|speaker|seed)/i) ||
                        html.match(/class="[^"]*champion[^"]*"[^>]*>([^<]+)/i);
      if (placeMatch) {
        placement = (placeMatch[1] || placeMatch[0]).trim();
        break;
      }
    }

    return json({
      rounds: allRounds,
      total: allRounds.length,
      placement,
      html_preview: (bestHtml || pages[0] || "").substring(0, 8000),
    });
  } catch (e) {
    return err(`Failed to fetch ballots: ${(e as Error).message}`, 502);
  }
}

// ─── MY ROUNDS ───────────────────────────────────────────
async function handleMyRounds(body: { token: string; tourn_id: string; person_name?: string; person_id?: string }) {
  if (!body.token || !body.tourn_id) return err("Token and tourn_id are required");

  try {
    const pages: string[] = [];
    const entryId = await findEntryId(body.token, body.tourn_id, body.person_name);

    // Strategy 0: If person_id is available, try the ranked results page directly
    if (!entryId && body.person_id) {
      try {
        const res = await tabroomFetch(
          `/index/results/ranked_list.mhtml?person_id=${body.person_id}&tourn_id=${body.tourn_id}`, body.token
        );
        const html = await res.text();
        if (!isLoginPage(html) && !html.includes("404 Not Found")) {
          const entryMatch = html.match(/entry_id=(\d+)/);
          if (entryMatch) {
            const erRes = await tabroomFetch(
              `/index/tourn/postings/entry_record.mhtml?tourn_id=${body.tourn_id}&entry_id=${entryMatch[1]}`, body.token
            );
            const erHtml = await erRes.text();
            if (!isLoginPage(erHtml) && !erHtml.includes("404 Not Found")) {
              pages.push(erHtml);
              console.log(`MyRounds: Found entry_record via person_id=${body.person_id}, entry_id=${entryMatch[1]}`);
            }
          }
        }
      } catch (e) { console.log("MyRounds person_id lookup failed:", (e as Error).message); }
    }

    if (entryId && entryId.startsWith("__HTML__")) {
      const parts = entryId.split("__");
      const sid = parts[4];
      try {
        const res = await tabroomFetch(`/user/student/tourn.mhtml?tourn_id=${body.tourn_id}&student_id=${sid}`, body.token);
        const html = await res.text();
        if (!isLoginPage(html) && !html.includes("404 Not Found")) pages.push(html);
      } catch { /* skip */ }
    } else if (entryId) {
      const res = await tabroomFetch(`/index/tourn/postings/entry_record.mhtml?tourn_id=${body.tourn_id}&entry_id=${entryId}`, body.token);
      const html = await res.text();
      if (!html.includes("Invalid Entry ID") && !isLoginPage(html) && !html.includes("404 Not Found")) pages.push(html);
    }

    // Try public results pages for user's name
    if (pages.length === 0 && body.person_name) {
      try {
        const indexRes = await tabroomFetch(`/index/tourn/results/index.mhtml?tourn_id=${body.tourn_id}`, body.token);
        const indexHtml = await indexRes.text();
        if (!isLoginPage(indexHtml) && !indexHtml.includes("404 Not Found")) {
          const eventLinks: string[] = [];
          const linkRegex = /href="([^"]*(?:event_results|round_results|entry_ballots)[^"]*)"/g;
          let lm;
          while ((lm = linkRegex.exec(indexHtml)) !== null) {
            eventLinks.push(lm[1]);
          }
          for (const link of eventLinks.slice(0, 3)) {
            try {
              const fullLink = link.startsWith("http") ? link : `${TABROOM_WEB}${link}`;
              const res = await tabroomFetch(fullLink, body.token);
              const html = await res.text();
              if (isLoginPage(html) || html.includes("404 Not Found")) continue;
              
              // Find user's entry by name
              const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
              let rowMatch;
              while ((rowMatch = rowRegex.exec(html)) !== null) {
                const row = rowMatch[1];
                const rowText = row.replace(/<[^>]+>/g, " ");
                if (nameMatches(rowText, body.person_name)) {
                  const eidMatch = row.match(/entry_id=(\d+)/);
                  if (eidMatch) {
                    const erRes = await tabroomFetch(
                      `/index/tourn/postings/entry_record.mhtml?tourn_id=${body.tourn_id}&entry_id=${eidMatch[1]}`,
                      body.token
                    );
                    const erHtml = await erRes.text();
                    if (!isLoginPage(erHtml) && !erHtml.includes("404 Not Found")) {
                      pages.push(erHtml);
                      console.log(`MyRounds: Found entry_record via name match, entry_id=${eidMatch[1]}`);
                    }
                    break;
                  }
                }
              }
              if (pages.length > 0) break;
            } catch { /* skip */ }
          }
        }
      } catch (e) {
        console.log("MyRounds public results fallback failed:", (e as Error).message);
      }
    }

    // Student tournament page as last resort
    if (pages.length === 0) {
      try {
        const res = await tabroomFetch(`/user/student/tourn.mhtml?tourn_id=${body.tourn_id}`, body.token);
        const html = await res.text();
        if (!isLoginPage(html) && !html.includes("404 Not Found")) pages.push(html);
      } catch (e) {
        console.log("MyRounds student/tourn fallback failed:", (e as Error).message);
      }
    }

    let rounds: Array<Record<string, string>> = [];
    let bestHtml = "";
    for (const html of pages) {
      const parsed = parseRoundsFromHtml(html);
      if (parsed.length > rounds.length) {
        rounds = parsed;
        bestHtml = html;
      }
    }

    let wins = 0, losses = 0;
    for (const r of rounds) {
      const dec = (r.decision || "").toLowerCase();
      if (dec.includes("w") || dec.includes("win")) wins++;
      else if (dec.includes("l") || dec.includes("loss")) losses++;
    }

    return json({ rounds, record: { wins, losses }, total: rounds.length, html_preview: (bestHtml || pages[0] || "").substring(0, 5000) });
  } catch (e) {
    return err(`Failed to fetch rounds: ${(e as Error).message}`, 502);
  }
}

// ─── ENTRIES ─────────────────────────────────────────────
async function handleEntries(body: { token: string }) {
  if (!body.token) return err("Token is required");

  try {
    const res = await tabroomFetch("/user/student/index.mhtml", body.token);
    const html = await res.text();

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

    const eventRegex = /event[^>]*>([^<]+)/gi;
    const events: string[] = [];
    let em;
    while ((em = eventRegex.exec(html)) !== null) {
      events.push(em[1].trim());
    }

    const dateRegex = /(\w+\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?,?\s*\d{4})/g;
    const dates: string[] = [];
    let dm;
    while ((dm = dateRegex.exec(html)) !== null) {
      dates.push(dm[1].trim());
    }

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

// ─── UPCOMING TOURNAMENTS ────────────────────────────────
async function handleUpcoming() {
  try {
    const res = await fetch(`${TABROOM_WEB}/index/index.mhtml`, { redirect: "follow" });
    const html = await res.text();

    const tournaments: Array<Record<string, string>> = [];
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

// ─── PAST RESULTS ────────────────────────────────────────
async function handlePastResults(body: { person_id?: string; token?: string }) {
  try {
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

        if (isLoginPage(html)) {
          console.log(`Session expired or login required for ${url}`);
          continue;
        }

        const results: Array<Record<string, string>> = [];
        
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
          
          const firstLower = ct[0].toLowerCase();
          if (firstLower.includes("tournament") || firstLower.includes("event") || !ct[0]) continue;
          
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
            if (entry.tournament) results.push(entry);
          } else {
            const looksLikeDate = /^\d{1,2}\/\d{1,2}/.test(ct[0]) || /^[A-Z][a-z]{2}\s+\d/.test(ct[0]);
            if (looksLikeDate && ct.length >= 2) continue;
            
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

// ─── VENUE MAP ───────────────────────────────────────────
async function handleVenueMap(body: { token: string; tourn_id: string }) {
  if (!body.token || !body.tourn_id) return err("Token and tourn_id are required");

  try {
    const pagesToTry = [
      `/index/tourn/index.mhtml?tourn_id=${body.tourn_id}`,
      `/index/tourn/postings/round.mhtml?tourn_id=${body.tourn_id}`,
    ];

    const mapImages: string[] = [];
    let venueAddress = "";
    let venueName = "";
    let embeddedMapUrl = "";
    let tournamentLocation = "";

    // Helper: check if a URL is a Tabroom UI/system image (not a venue map)
    const isSystemImage = (src: string): boolean => {
      return /\/lib\/(images|css|javascript)\//i.test(src) ||
        /tabroom-logo|nsda-blue|favicon|icon|logo|badge|pixel|spacer|tracking|avatar|arrow|button|nav|menu|header|footer|spinner|loading/i.test(src) ||
        /\.(css|js|min\.|woff|ttf|eot)/i.test(src) ||
        /url_settings|gear|cog|settings/i.test(src) ||
        src.includes("1x1") || src.includes("blank.");
    };

    for (const page of pagesToTry) {
      try {
        const res = await tabroomFetch(page, body.token);
        const html = await res.text();
        if (isLoginPage(html)) continue;

        // Extract Google Maps embed iframe
        const iframeMatch = html.match(/<iframe[^>]*src="([^"]*(?:google\.com\/maps|maps\.google)[^"]*)"/i);
        if (iframeMatch && !embeddedMapUrl) {
          embeddedMapUrl = iframeMatch[1].replace(/&amp;/g, "&");
        }

        // Extract Google Maps link
        if (!embeddedMapUrl) {
          const mapsLink = html.match(/href="(https?:\/\/(?:www\.)?(?:google\.com\/maps|maps\.google|goo\.gl\/maps)[^"]*)"/i);
          if (mapsLink) embeddedMapUrl = mapsLink[1].replace(/&amp;/g, "&");
        }

        // Extract static map images (Google Static Maps API)
        const staticMapRegex = /<img[^>]*src="([^"]*maps\.googleapis\.com[^"]*)"/gi;
        let imgMatch;
        while ((imgMatch = staticMapRegex.exec(html)) !== null) {
          const src = imgMatch[1].replace(/&amp;/g, "&");
          if (!mapImages.includes(src)) mapImages.push(src);
        }

        // Look for venue-specific uploaded images (not in /lib/)
        const venueImgRegex = /<img[^>]*src="([^"]*(?:venue|floor|campus|building|map)[^"]*)"/gi;
        while ((imgMatch = venueImgRegex.exec(html)) !== null) {
          const src = imgMatch[1].replace(/&amp;/g, "&");
          if (!isSystemImage(src) && !mapImages.includes(src)) {
            mapImages.push(src.startsWith("http") ? src : `${TABROOM_WEB}${src}`);
          }
        }

        // Extract tournament location from structured content (not from <script> tags)
        // Remove all script/style tags first for clean text extraction
        const cleanHtml = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");

        // Try to find venue/location in visible text content
        if (!venueName) {
          // Look for location in tournament header area - common patterns on Tabroom
          const locPatterns = [
            /class="[^"]*location[^"]*"[^>]*>([^<]{5,80})</i,
            /(?:venue|location|hosted at|held at|site)\s*[:]\s*([A-Z][^<\n]{5,80})/i,
            /class="[^"]*address[^"]*"[^>]*>([^<]{5,80})</i,
          ];
          for (const pat of locPatterns) {
            const m = cleanHtml.match(pat);
            if (m?.[1]) {
              const text = m[1].replace(/\s+/g, " ").trim();
              // Validate it looks like a real location (not JS code)
              if (text.length > 4 && !/function|var |const |let |=>|\.href|{|}|\(|\)/i.test(text)) {
                venueName = text;
                break;
              }
            }
          }
        }

        // Extract address - must look like a real address, not code
        if (!venueAddress) {
          const addrPatterns = [
            /class="[^"]*addr[^"]*"[^>]*>([^<]{10,120})</i,
            /(\d+\s+[A-Z][a-zA-Z\s]+(?:St|Ave|Blvd|Dr|Rd|Ln|Way|Ct|Pkwy|Hwy|Circle|Place|Drive|Road|Street|Avenue|Boulevard)[^<]{0,60})/,
          ];
          for (const pat of addrPatterns) {
            const m = cleanHtml.match(pat);
            if (m?.[1]) {
              const text = m[1].replace(/\s+/g, " ").trim();
              if (!/function|var |const |let |=>|\.href|{|}|\(|\)/i.test(text)) {
                venueAddress = text;
                break;
              }
            }
          }
        }

        // Try to get tournament location from the page header (city, state)
        if (!tournamentLocation) {
          const cityMatch = cleanHtml.match(/class="[^"]*city[^"]*"[^>]*>([^<]+)</i) ||
                           cleanHtml.match(/>,?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,?\s+[A-Z]{2})\s*</);
          if (cityMatch?.[1]) {
            const text = cityMatch[1].trim();
            if (text.length > 3 && text.length < 60 && !/function|var |const /i.test(text)) {
              tournamentLocation = text;
            }
          }
        }
      } catch (e) {
        console.log(`Venue map: Failed to fetch ${page}:`, (e as Error).message);
      }
    }

    return json({
      map_images: mapImages,
      embedded_map_url: embeddedMapUrl || null,
      venue_name: venueName || null,
      venue_address: venueAddress || tournamentLocation || null,
      total_images: mapImages.length,
    });
  } catch (e) {
    return err(`Failed to fetch venue map: ${(e as Error).message}`, 502);
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
    case "venue-map": return handleVenueMap(body as any);
    case "debug-api": {
      const token = body.token as string;
      const tournId = body.tourn_id as string;
      if (!token || !tournId) return err("token and tourn_id required");
      const decodedToken = decodeURIComponent(token);
      const cookieStr = `TabroomToken=${decodedToken}`;
      const results: Record<string, unknown> = {};
      const urls = [
        `https://masonapi.tabroom.com/v1/tourn/${tournId}/me`,
        `https://masonapi.tabroom.com/v1/tourn/${tournId}/results`,
        `https://masonapi.tabroom.com/v1/tourn/${tournId}/entries`,
        `https://masonapi.tabroom.com/v1/user/student/rounds?tourn_id=${tournId}`,
        `https://masonapi.tabroom.com/v1/user/student/mine`,
        `https://api.tabroom.com/v1/tourn/${tournId}/me`,
      ];
      for (const u of urls) {
        try {
          const r = await fetch(u, { headers: { Cookie: cookieStr, "User-Agent": BROWSER_UA }, redirect: "follow" });
          const text = await r.text();
          results[u] = { status: r.status, body: text.substring(0, 500) };
        } catch (e) { results[u] = { error: (e as Error).message }; }
      }
      // Also try student page for entry_id links
      try {
        const r = await tabroomFetch("/user/student/index.mhtml", token);
        const html = await r.text();
        const entryLinks = html.match(/entry_id=\d+/g) || [];
        const tournLinks = html.match(new RegExp(`tourn_id=${tournId}[^"]{0,200}`, 'g')) || [];
        results["student_page"] = { entryLinks: entryLinks.slice(0, 10), tournLinks: tournLinks.slice(0, 5), len: html.length };
      } catch (e) { results["student_page"] = { error: (e as Error).message }; }
      return json(results);
    }
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
