// Tabroom Proxy handler for Cloudflare Workers
import type { Env } from './index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const TABROOM_WEB = 'https://www.tabroom.com';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status);
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function tabroomFetch(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith('http') ? path : `${TABROOM_WEB}${path}`;
  const decodedToken = decodeURIComponent(token);
  const cookieStr = `TabroomToken=${decodedToken}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Cookie: cookieStr,
      'User-Agent': BROWSER_UA,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...(options.headers || {}),
    },
    redirect: 'follow',
  });
  return res;
}

// ─── LOGIN ───────────────────────────────────────────────
async function handleLogin(body: { email: string; password: string }) {
  if (!body.email || !body.password) return err('Email and password are required');

  try {
    const res = await fetch(`${TABROOM_WEB}/user/login/login_save.mhtml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': BROWSER_UA },
      body: `username=${encodeURIComponent(body.email)}&password=${encodeURIComponent(
        body.password
      )}`,
      redirect: 'manual',
    });

    const setCookie = res.headers.get('set-cookie') || '';
    const location = res.headers.get('location') || '';
    await res.text();

    const tokenMatch = setCookie.match(/TabroomToken=([^;]+)/);
    const token = tokenMatch?.[1] || null;

    if (location.includes('err=') || !token || token === '') {
      const errMsg = decodeURIComponent(location.match(/err=([^&]*)/)?.[1] || 'Invalid credentials');
      return json({ error: errMsg, success: false }, 401);
    }

    let personInfo: Record<string, unknown> = { person_id: null, name: null };

    // Strategy 1: Home page may have "Welcome, Name" or profile info
    const pagesToTry = ['/user/home.mhtml', '/user/login/profile.mhtml'];
    for (const page of pagesToTry) {
      try {
        const dashRes = await tabroomFetch(page, token);
        const dashHtml = await dashRes.text();
        if (isLoginPage(dashHtml)) continue;

        // Extract person_id
        if (!personInfo.person_id) {
          const pidMatch =
            dashHtml.match(/person_id[=:]\s*["']?(\d+)/) ||
            dashHtml.match(/personId[=:]\s*["']?(\d+)/);
          if (pidMatch) personInfo.person_id = pidMatch[1];
        }

        // Try form fields for name
        if (!personInfo.name) {
          const firstMatch =
            dashHtml.match(/name\s*=\s*"first"[^>]*value\s*=\s*"([^"]+)"/i) ||
            dashHtml.match(/name\s*=\s*"first_name"[^>]*value\s*=\s*"([^"]+)"/i) ||
            dashHtml.match(/value\s*=\s*"([^"]+)"[^>]*name\s*=\s*"first"/i);
          const lastMatch =
            dashHtml.match(/name\s*=\s*"last"[^>]*value\s*=\s*"([^"]+)"/i) ||
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

        const inputFields = (dashHtml.match(/<input[^>]*(?:first|last|name)[^>]*>/gi) || []).slice(
          0,
          3
        );
        if (inputFields.length > 0)
          console.log(`Login: Input fields on ${page}: ${JSON.stringify(inputFields)}`);

        if (personInfo.person_id && personInfo.name) break;
      } catch (e) {
        console.log(`Login: Could not fetch ${page}:`, (e as Error).message);
      }
    }

    // Strategy 2: Student index page for person_id
    if (!personInfo.person_id) {
      try {
        const res = await tabroomFetch('/user/student/index.mhtml', token);
        const html = await res.text();
        if (!isLoginPage(html)) {
          const pidMatch =
            html.match(/person_id[=:]\s*["']?(\d+)/) || html.match(/personId[=:]\s*["']?(\d+)/);
          if (pidMatch) personInfo.person_id = pidMatch[1];
        }
      } catch {
        /* skip */
      }
    }

    // Strategy 3: Extract name from past-results entries
    if (!personInfo.name && personInfo.person_id) {
      try {
        const prRes = await tabroomFetch(
          `/index/results/ranked_list.mhtml?person_id=${personInfo.person_id}`,
          token
        );
        const prHtml = await prRes.text();
        if (!isLoginPage(prHtml)) {
          const headingMatches = prHtml.matchAll(/<h[1-4][^>]*>\s*([\s\S]*?)\s*<\/h[1-4]>/gi);
          for (const hm of headingMatches) {
            const text = hm[1].replace(/<[^>]+>/g, '').trim();
            if (
              text.length >= 4 &&
              text.length < 40 &&
              /^[A-Z]/.test(text) &&
              !/not found|tabroom|log in|results|search/i.test(text) &&
              /\s/.test(text)
            ) {
              personInfo.name = text;
              console.log(`Login: Found name from ranked_list heading: "${personInfo.name}"`);
              break;
            }
          }
        }
      } catch {
        /* skip */
      }
    }

    console.log(`Login: Final person_id=${personInfo.person_id}, name=${personInfo.name}`);

    return json({
      success: true,
      token,
      person_id: personInfo.person_id || null,
      name: personInfo.name || body.email.split('@')[0],
      email: body.email,
    });
  } catch (e) {
    return err(`Failed to connect to Tabroom: ${(e as Error).message}`, 502);
  }
}

// ─── MY TOURNAMENTS ──────────────────────────────────────
async function handleMyTournaments(body: { token: string }) {
  if (!body.token) return err('Token is required');
  try {
    const res = await tabroomFetch('/user/student/index.mhtml', body.token);
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

// ─── PAIRINGS EVENTS ──────────────────────────────────────
async function handlePairingsEvents(body: { token: string; tourn_id: string }) {
  if (!body.token || !body.tourn_id) return err('Token and tourn_id are required');
  try {
    const indexPath = `/index/tourn/postings/index.mhtml?tourn_id=${body.tourn_id}`;
    const res = await tabroomFetch(indexPath, body.token);
    const html = await res.text();
    if (isLoginPage(html)) return err('Session expired - please log in again', 401);

    const eventMap = new Map<
      string,
      { id: string; name: string; rounds: Array<{ id: string; name: string }> }
    >();
    
    let m: RegExpExecArray | null;
    
    // Method 1: Find the event selector dropdown (handle spaces around = sign)
    const selectEventRegex = /<select[^>]*(?:id|name)\s*=\s*["']eventSelector["'][^>]*>([\s\S]*?)<\/select>/gi;
    const selectMatch = selectEventRegex.exec(html);
    
    if (selectMatch) {
      const selectContent = selectMatch[1];
      // Extract option elements with value and text (handle spaces around = sign)
      const optionRegex = /<option[^>]*value\s*=\s*["'](\d+)["'][^>]*>([^<]+)<\/option>/gi;
      while ((m = optionRegex.exec(selectContent)) !== null) {
        const id = m[1];
        const rawName = m[2]
          .replace(/&amp;/g, '&')
          .replace(/&#\d+;/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (id && rawName && rawName.length > 1) {
          eventMap.set(id, { id, name: rawName, rounds: [] });
        }
      }
    }
    
    // Method 2: If no eventSelector found, look for event links with event_id parameter
    if (eventMap.size === 0) {
      const eventLinkRegex = /<a[^>]*href="[^"]*[?&]event_id=(\d+)[^"]*"[^>]*>([^<]+)<\/a>/gi;
      while ((m = eventLinkRegex.exec(html)) !== null) {
        const id = m[1];
        const rawName = m[2]
          .replace(/&amp;/g, '&')
          .replace(/&#\d+;/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (id && rawName && rawName.length > 2 && !eventMap.has(id)) {
          eventMap.set(id, { id, name: rawName, rounds: [] });
        }
      }
    }
    
    // Method 3: Look for event_id in URL parameters within the page
    if (eventMap.size === 0) {
      const urlEventRegex = /tourn_id=\d+[^"']*event_id=(\d+)/gi;
      const foundEventIds = new Set<string>();
      while ((m = urlEventRegex.exec(html)) !== null) {
        foundEventIds.add(m[1]);
      }
      // For each found event_id, try to fetch its details
      for (const eventId of foundEventIds) {
        try {
          const eventPath = `/index/tourn/postings/index.mhtml?tourn_id=${body.tourn_id}&event_id=${eventId}`;
          const eventRes = await tabroomFetch(eventPath, body.token);
          const eventHtml = await eventRes.text();
          // Try to extract event name from title or h tags
          const titleMatch = /<title>([^<]+)<\/title>/i.exec(eventHtml) || /<h2[^>]*>([^<]+)<\/h2>/i.exec(eventHtml);
          if (titleMatch) {
            const eventName = titleMatch[1].replace(/Tabroom\.com/g, '').replace(/\s+/g, ' ').trim();
            if (eventName && !eventMap.has(eventId)) {
              eventMap.set(eventId, { id: eventId, name: eventName, rounds: [] });
            }
          }
        } catch {
          // Skip if we can't fetch
        }
      }
    }

    const events: Array<{ id: string; name: string; rounds: Array<{ id: string; name: string }> }> =
      [];
    
    // Extract rounds for each event from the eventListing divs in the same HTML
    for (const [eventId, event] of eventMap.entries()) {
      // Find the div with id matching this event ID - look for eventListing class with this specific id
      const eventDivRegex = new RegExp(`<div[^>]*id="${eventId}"[^>]*class="[^"]*eventListing[^"]*"[^>]*>([\\s\\S]*?)<\\/div>`, 'gi');
      let eventDivMatch = eventDivRegex.exec(html);
      
      // Try alternative: class before id
      if (!eventDivMatch) {
        const altRegex = new RegExp(`<div[^>]*class="[^"]*eventListing[^"]*"[^>]*id="${eventId}"[^>]*>([\\s\\S]*?)<\\/div>`, 'gi');
        eventDivMatch = altRegex.exec(html);
      }
      
      if (eventDivMatch) {
        const eventDivContent = eventDivMatch[1];
        // Extract round links: <a href="/index/tourn/postings/round.mhtml?tourn_id=38592&round_id=1457445">CONG Ses1</a>
        const roundRegex = /<a[^>]*href="[^"]*round_id=(\d+)"[^>]*>([^<]+)<\/a>/gi;
        let rm: RegExpExecArray | null;
        while ((rm = roundRegex.exec(eventDivContent)) !== null) {
          const rid = rm[1];
          const rname = rm[2]
            .replace(/&amp;/g, '&')
            .replace(/&#\d+;/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          if (rid && rname && !event.rounds.find((r) => r.id === rid)) {
            event.rounds.push({ id: rid, name: rname });
          }
        }
      }
      
      // Always add event even if no rounds found (some events might not have started yet)
      events.push(event);
    }
    
    // Method 4: If still no events found, this might be a single-event tournament
    // Look for direct round links and create a single event
    if (events.length === 0) {
      const directRoundRegex = /<a[^>]*href="[^"]*round_id=(\d+)"[^>]*>([^<]+)<\/a>/gi;
      const directRounds: Array<{ id: string; name: string }> = [];
      while ((m = directRoundRegex.exec(html)) !== null) {
        const rid = m[1];
        const rname = m[2]
          .replace(/&amp;/g, '&')
          .replace(/&#\d+;/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (rid && rname && !directRounds.find((r) => r.id === rid)) {
          directRounds.push({ id: rid, name: rname });
        }
      }
      
      if (directRounds.length > 0) {
        // Try to extract event name from various sources
        let eventName = 'Tournament Rounds';
        
        // Try page title first (often contains event name)
        const titleMatch = /<title>([^<]+?)\s*(?:-|—|–)?\s*Tabroom\.com<\/title>/i.exec(html);
        if (titleMatch) {
          const titleText = titleMatch[1].trim();
          // Skip if it's just the tournament name (typically in h2)
          const h2Match = /<h2[^>]*>([^<]+)<\/h2>/i.exec(html);
          if (h2Match && titleText !== h2Match[1].trim()) {
            eventName = titleText;
          }
        }
        
        // Try to find event name from h4 or h5 tags (often used for event names)
        if (eventName === 'Tournament Rounds') {
          const h4Match = /<h4[^>]*>(?!Schematics)([^<]+)<\/h4>/i.exec(html);
          if (h4Match) {
            eventName = h4Match[1].replace(/\s+/g, ' ').trim();
          }
        }
        
        // Last resort: use the first few words of the first round name
        if (eventName === 'Tournament Rounds' && directRounds.length > 0) {
          const firstRound = directRounds[0].name;
          // Extract event abbreviation (e.g., "PF" from "PF R1")
          const abbrevMatch = /^([A-Z]{2,6})\s+/i.exec(firstRound);
          if (abbrevMatch) {
            eventName = abbrevMatch[1];
          }
        }
        
        events.push({
          id: 'single',
          name: eventName,
          rounds: directRounds
        });
      }
    }

    return json({ events, total: events.length });
  } catch (e) {
    return err(`Failed to fetch pairings events: ${(e as Error).message}`, 502);
  }
}

// ─── PAIRINGS (for specific round) ────────────────────────
async function handlePairings(body: { token: string; round_id: string }) {
  if (!body.token || !body.round_id) return err('Token and round_id are required');
  try {
    const roundPath = `/index/tourn/postings/round.mhtml?round_id=${body.round_id}`;
    const res = await tabroomFetch(roundPath, body.token);
    const html = await res.text();
    if (isLoginPage(html)) return err('Session expired - please log in again', 401);

    // ── 1. Find the table ──────────────────────────────────────────────────────
    // Try strict id match first, then loose id-contains match, then first table.
    let tableContent = '';
    const strictId = new RegExp(
      `<table[^>]*\\bid=["']${body.round_id}["'][^>]*>[\\s\\S]*?<\\/table>`, 'i'
    );
    const looseId = new RegExp(
      `<table[^>]*\\bid=["'][^"']*${body.round_id}[^"']*["'][^>]*>[\\s\\S]*?<\\/table>`, 'i'
    );
    const anyTable = /<table[\s\S]*?<\/table>/i;

    let m = strictId.exec(html) ?? looseId.exec(html) ?? anyTable.exec(html);
    if (m) tableContent = m[0];

    if (!tableContent) {
      return json({ pairings: [], headers: [], message: 'No pairings table found',
                    html_preview: html.substring(0, 4000) });
    }

    // ── 2. Helper: clean raw cell HTML → plain text ────────────────────────────
    function cellText(raw: string): string {
      return raw
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<span[^>]*class=["'][^"']*\bfa\b[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, '')
        .replace(/&[a-z][a-z0-9]*;/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // ── 3. Extract all <tr> arrays with their cell tags and colspan ────────────
    // Returns [{tag:'th'|'td', text, colspan}, ...] per row.
    function parseRows(html: string): Array<Array<{tag: string; text: string; colspan: number}>> {
      const rows: Array<Array<{tag: string; text: string; colspan: number}>> = [];
      const rowRe = /<tr(?:[^>]*)>([\s\S]*?)<\/tr>/gi;
      let rMatch: RegExpExecArray | null;
      while ((rMatch = rowRe.exec(html)) !== null) {
        const cells: Array<{tag: string; text: string; colspan: number}> = [];
        const cellRe = /<(th|td)(?:[^>]*)>([\s\S]*?)<\/\1>/gi;
        let cMatch: RegExpExecArray | null;
        const rowHtml = rMatch[1];
        while ((cMatch = cellRe.exec(rowHtml)) !== null) {
          const tag = cMatch[1].toLowerCase();
          const raw = cMatch[0];
          const colspanM = /colspan=["']?(\d+)["']?/i.exec(raw);
          const colspan = colspanM ? parseInt(colspanM[1], 10) : 1;
          cells.push({ tag, text: cellText(cMatch[2]), colspan });
        }
        if (cells.length > 0) rows.push(cells);
      }
      return rows;
    }

    // ── 4. Expand a row of cells into a flat string array, respecting colspan ──
    function expandCells(cells: Array<{tag: string; text: string; colspan: number}>): string[] {
      const out: string[] = [];
      for (const c of cells) {
        for (let i = 0; i < c.colspan; i++) out.push(c.text);
      }
      return out;
    }

    // ── 5. Normalise a header string → snake_case key ──────────────────────────
    let blankIdx = 0;
    function normaliseHeader(raw: string): string {
      const key = raw
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      if (!key) {
        blankIdx++;
        return `entry_${blankIdx}`;
      }
      // Deduplicate: if key already used, append _2, _3 …
      return key;
    }

    // ── 6. Build headers list ──────────────────────────────────────────────────
    // Strategy:
    //   a) Look for a <thead> block → use its first <tr>
    //   b) Otherwise use the first <tr> in the table that contains any <th>
    //   c) Otherwise use the very first <tr> as headers (treated as plain text)
    const headers: string[] = [];
    blankIdx = 0;

    // Separate thead and "body" portions for later row extraction
    const theadM = /<thead[\s\S]*?>([\s\S]*?)<\/thead>/i.exec(tableContent);
    const tbodyM = /<tbody[\s\S]*?>([\s\S]*?)<\/tbody>/i.exec(tableContent);

    // Strip <thead>/<tbody> wrappers to get raw rows for fallback
    const rawTableInner = tableContent
      .replace(/<thead[\s\S]*?<\/thead>/gi, '')
      .replace(/<tfoot[\s\S]*?<\/tfoot>/gi, '');

    let headerCells: Array<{tag: string; text: string; colspan: number}> = [];
    let dataRowsHtml = '';

    if (theadM) {
      // Has explicit <thead>
      const headRows = parseRows(theadM[1]);
      if (headRows.length > 0) headerCells = headRows[0];
      dataRowsHtml = tbodyM ? tbodyM[1] : rawTableInner;
    } else {
      // No <thead> — scan all rows for first one containing <th>
      const allRows = parseRows(tbodyM ? tbodyM[1] : rawTableInner);
      const firstThRow = allRows.findIndex(r => r.some(c => c.tag === 'th'));
      if (firstThRow !== -1) {
        headerCells = allRows[firstThRow];
        // Data rows = everything after the header row
        const remaining = allRows.slice(firstThRow + 1);
        dataRowsHtml = remaining.map(r =>
          '<tr>' + r.map(c => `<td>${c.text}</td>`).join('') + '</tr>'
        ).join('');
      } else if (allRows.length > 0) {
        // No <th> at all — treat first row as headers
        headerCells = allRows[0];
        const remaining = allRows.slice(1);
        dataRowsHtml = remaining.map(r =>
          '<tr>' + r.map(c => `<td>${c.text}</td>`).join('') + '</tr>'
        ).join('');
      } else {
        dataRowsHtml = tbodyM ? tbodyM[1] : rawTableInner;
      }
    }

    // Expand colspan in headers and build the key list
    const usedKeys = new Map<string, number>();
    for (const cell of headerCells) {
      for (let i = 0; i < cell.colspan; i++) {
        let key = normaliseHeader(i === 0 ? cell.text : '');
        // Handle duplicate keys (e.g. two "judge" columns)
        const count = usedKeys.get(key) ?? 0;
        usedKeys.set(key, count + 1);
        if (count > 0) key = `${key}_${count + 1}`;
        headers.push(key);
      }
    }

    // ── 7. Extract data rows ───────────────────────────────────────────────────
    const pairings: Array<Record<string, string>> = [];

    if (dataRowsHtml) {
      const dataRows = parseRows(dataRowsHtml);
      for (const rowCells of dataRows) {
        const flatCells = expandCells(rowCells);
        if (flatCells.length === 0) continue;

        const row: Record<string, string> = {};
        // Map by index; if row has MORE cells than headers, create extra columns
        const colCount = Math.max(headers.length, flatCells.length);
        for (let i = 0; i < colCount; i++) {
          const key = headers[i] ?? `col_${i + 1}`;
          row[key] = flatCells[i] ?? '';
        }
        // Only store the row if at least one cell is non-empty
        if (Object.values(row).some(v => v !== '')) {
          pairings.push(row);
        }
      }
    }

    // ── 8. If we derived extra keys from data rows, add them to headers list ──
    if (pairings.length > 0) {
      const allKeys = new Set(headers);
      for (const row of pairings) {
        for (const k of Object.keys(row)) {
          if (!allKeys.has(k)) { allKeys.add(k); headers.push(k); }
        }
      }
    }

    return json({
      pairings,
      headers,
      total: pairings.length,
    });
  } catch (e) {
    return err(`Failed to fetch pairings: ${(e as Error).message}`, 502);
  }
}

// ─── TABLE PARSING HELPERS ───────────────────────────────

function cleanCellHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSingleTable(tableHtml: string): { headers: string[]; rows: string[][] } {
  const headers: string[] = [];
  const rows: string[][] = [];

  const theadMatch = /<thead[\s\S]*?>([\s\S]*?)<\/thead>/i.exec(tableHtml);
  if (theadMatch) {
    const thCells = theadMatch[1].match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || [];
    headers.push(...thCells.map(th => cleanCellHtml(th)));
  } else {
    const firstRowMatch = /<tr[^>]*>([\s\S]*?)<\/tr>/i.exec(tableHtml);
    if (firstRowMatch) {
      const thCells = firstRowMatch[1].match(/<th[^>]*>([\s\S]*?)<\/th>/gi) || [];
      if (thCells.length) headers.push(...thCells.map(th => cleanCellHtml(th)));
    }
  }

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = rowMatch[1];
    if (/<th[\s>]/i.test(rowHtml)) continue;
    const tdCells = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    if (tdCells.length === 0) continue;
    const cellTexts = tdCells.map(td => cleanCellHtml(td));
    if (cellTexts.some(c => c !== '')) rows.push(cellTexts);
  }

  return { headers, rows };
}

function parseAllTablesFromHtml(html: string): Array<{ headers: string[]; rows: string[][] }> {
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  const tableRegex = /<table[\s\S]*?<\/table>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const { headers, rows } = parseSingleTable(tableMatch[0]);
    if (rows.length > 0) tables.push({ headers, rows });
  }
  return tables;
}

function mapRowsToRounds(headers: string[], rows: string[][]): Array<Record<string, string>> {
  const rounds: Array<Record<string, string>> = [];
  const lh = headers.map(h => h.toLowerCase());
  for (const row of rows) {
    const entry: Record<string, string> = {};
    for (let i = 0; i < Math.min(headers.length, row.length); i++) {
      const h = lh[i];
      const val = row[i] || '';
      if (h.includes('round') || h === 'rd' || h === 'r') entry.round = val;
      else if (h.includes('side')) entry.side = val;
      else if (h.includes('opp')) entry.opponent = val;
      else if (h.includes('judge') || h.includes('panel')) entry.judge = val;
      else if (h.includes('decision') || h.includes('result') || h.includes('w/l') || h.includes('ballot')) entry.decision = val;
      else if (h.includes('point') || h.includes('speak') || h.includes('pts')) entry.points = val;
      else if (h.includes('room')) entry.room = val;
    }
    if (Object.values(entry).some(v => v !== '')) rounds.push(entry);
  }
  return rounds;
}

// ─── ROUNDS TABLE PARSER ─────────────────────────────────
// Parses the structured round rows from /user/student/index.mhtml
// Columns: Round | Start | Room | Side | Opp | Doc Share | Judges & Results
function extractCurrentRounds(html: string): {
  rounds: Array<Record<string, string>>;
  headers: string[];
  wins: number;
  losses: number;
} {
  const HEADERS = ['Round', 'Start', 'Room', 'Side', 'Opponent', 'Doc Share', 'Judge', 'Result'];
  const rounds: Array<Record<string, string>> = [];
  let wins = 0;
  let losses = 0;

  // Try to isolate the "current" screen section to avoid picking up future/results tables
  let searchHtml = html;
  const currentMatch = html.match(
    /<div[^>]+class="[^"]*screens\s+current[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]+class="[^"]*screens\s+(?:future|results)[^"]*")/i
  );
  if (currentMatch) searchHtml = currentMatch[1];

  // Each data row has class="row"; feedback/hidden rows are skipped
  const rowRegex = /<tr\s+class="row">([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(searchHtml)) !== null) {
    const rowHtml = rowMatch[1];

    // Extract <td> cells in order
    const cells: string[] = [];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1]);
    }
    if (cells.length < 4) continue;

    // Cell 0: Round — prefer the "smallhide" div ("Round 6") over "smallshow" ("R6")
    const roundDivMatch = (cells[0] ?? '').match(/<div[^>]*class="[^"]*smallhide[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const round = roundDivMatch
      ? roundDivMatch[1].trim()
      : cleanCellHtml(cells[0] ?? '').trim();

    // Cell 1: Start — first two flex-row divs: date + local time (skip timezone div)
    const startDivs = Array.from(
      (cells[1] ?? '').matchAll(/<div[^>]*class="[^"]*flexrow[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)
    );
    const start = startDivs
      .slice(0, 2)
      .map(m => m[1].trim().replace(/\s+/g, ' '))
      .filter(Boolean)
      .join(' ');

    // Cell 2: Room
    const room = cleanCellHtml(cells[2] ?? '').trim();

    // Cell 3: Side — "Pro 2nd" / "Con 1st"
    const side = cleanCellHtml(cells[3] ?? '').trim().replace(/\s+/g, ' ');

    // Cell 4: Opponent team code
    const opponent = cleanCellHtml(cells[4] ?? '').trim();

    // Cell 5: Doc Share — extract link text; fall back to URL suffix
    const docCell = cells[5] ?? '';
    const docShare = (() => {
      const m = docCell.match(/<a[^>]+href="([^"]+)"[^>]*>([^<]*)<\/a>/i);
      if (!m) return '';
      if (m[2].trim()) return m[2].trim();
      const parts = m[1].split('/');
      return parts[parts.length - 1] || '';
    })();

    // Cell 6: Judges & Results
    const judgeCell = cells[6] ?? '';
    // Judge name: find all title="..." values that contain a comma (Last, First format)
    // and aren't "Paradigm"
    const judgeTitles = Array.from(judgeCell.matchAll(/title="([\s\S]*?)"/gi))
      .map(m => m[1].trim().replace(/\s+/g, ' '))
      .filter(t => t !== 'Paradigm' && t.includes(','));
    const judge = judgeTitles[0] || '';

    // W/L result from the quarter-width span
    const wlMatch = judgeCell.match(
      /<span[^>]*class="[^"]*quarter\s+semibold\s+centeralign[^"]*"[^>]*>\s*([WL])\s*<\/span>/i
    );
    const result = wlMatch ? wlMatch[1].toUpperCase() : '';

    if (result === 'W') wins++;
    else if (result === 'L') losses++;

    if (round || opponent) {
      rounds.push({
        Round: round,
        Start: start,
        Room: room,
        Side: side,
        Opponent: opponent,
        'Doc Share': docShare,
        Judge: judge,
        Result: result,
      });
    }
  }

  return { rounds, headers: HEADERS, wins, losses };
}

// ─── MY ROUNDS ───────────────────────────────────────────
async function handleMyRounds(body: { token: string; tourn_id?: string; person_name?: string; person_id?: string }) {
  if (!body.token) return err('Token is required');

  try {
    let personId = body.person_id || null;
    let entriesHtml = '';

    // Step 1: Navigate to /user/home.mhtml and find the Entries link
    try {
      const homeRes = await tabroomFetch('/user/home.mhtml', body.token);
      const homeHtml = await homeRes.text();
      if (!isLoginPage(homeHtml)) {
        // Find: href="/user/student/index.mhtml?person_id=<id>"
        const entriesMatch = homeHtml.match(/href="(\/user\/student\/index\.mhtml\?person_id=(\d+))"/);
        if (entriesMatch) {
          personId = entriesMatch[2];
          // Step 2: Follow the Entries link
          const entriesRes = await tabroomFetch(entriesMatch[1], body.token);
          entriesHtml = await entriesRes.text();
          console.log(`MyRounds: Fetched entries page for person_id=${personId}, len=${entriesHtml.length}`);
        }
      }
    } catch (e) {
      console.log('MyRounds home.mhtml failed:', (e as Error).message);
    }

    // Fallback: use person_id directly
    if (!entriesHtml && personId) {
      try {
        const res = await tabroomFetch(`/user/student/index.mhtml?person_id=${personId}`, body.token);
        entriesHtml = await res.text();
        console.log(`MyRounds: Direct person_id fetch, len=${entriesHtml.length}`);
      } catch (e) {
        console.log('MyRounds person_id direct fetch failed:', (e as Error).message);
      }
    }

    // Fallback: plain student index
    if (!entriesHtml) {
      try {
        const res = await tabroomFetch('/user/student/index.mhtml', body.token);
        entriesHtml = await res.text();
      } catch (e) {
        console.log('MyRounds student/index fallback failed:', (e as Error).message);
      }
    }

    if (!entriesHtml || isLoginPage(entriesHtml)) {
      return json({ rounds: [], entries: [], headers: [], record: { wins: 0, losses: 0 }, total: 0 });
    }

    // Step 3: Use specialized parser to extract structured round data
    const { rounds: entries, headers, wins, losses } = extractCurrentRounds(entriesHtml);

    // Build RoundData-compatible objects for the rounds field
    const rounds = entries.map(e => ({
      round: e['Round'] || '',
      status: 'current' as const,
      opponent: e['Opponent'] || '',
      room: e['Room'] || '',
      side: e['Side'] || '',
      judge: e['Judge'] || '',
      start: e['Start'] || '',
      result: e['Result'] || '',
    }));

    return json({
      rounds,
      entries,
      headers,
      record: { wins, losses },
      total: entries.length,
      html_preview: entriesHtml.substring(0, 3000),
    });
  } catch (e) {
    return err(`Failed to fetch rounds: ${(e as Error).message}`, 502);
  }
}

// (Truncating for brevity - continued in next comment with remaining functions)
function isLoginPage(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    lower.includes('log in to tabroom') ||
    lower.includes('please login to view') ||
    lower.includes('login session has expired') ||
    lower.includes('please log in again') ||
    lower.includes('showloginbox') ||
    (lower.includes('password') &&
      lower.includes('email') &&
      lower.includes('create a new account'))
  );
}

// Export the main handler
export async function handleTabroomProxy(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(request.url);
  const path = url.pathname.split('/').pop();

  if (request.method !== 'POST') return err('Only POST requests are supported', 405);

  let body: Record<string, unknown>;
  try {
    body = await request.json() as any;
  } catch {
    return err('Invalid JSON body');
  }

  switch (path) {
    case 'login':
      return handleLogin(body as any);
    case 'my-tournaments':
      return handleMyTournaments(body as any);
    case 'pairings-events':
      return handlePairingsEvents(body as any);
    case 'pairings':
      return handlePairings(body as any);
    case 'my-rounds':
      return handleMyRounds(body as any);
    // Add other handlers here
    default:
      return json({
        service: 'Flow × Tabroom Proxy',
        endpoints: [
          'POST /login',
          'POST /my-tournaments',
          'POST /pairings',
          'POST /judge',
          'POST /ballots',
          'POST /my-rounds',
          'POST /entries',
          'POST /upcoming',
          'POST /past-results',
        ],
      });
  }
}
