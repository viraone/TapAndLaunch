// Pure helpers of the FitnessNav class reader (read.mjs): turning day labels and headings into dates, cutting a page into
// day pieces, checking a read class against the page's text, and parsing a FullCalendar event. No browser, no model, no
// network: tests live in src/lib/fitness/reader.test.ts. `makeHelpers(todayIso)` fixes "today" (Seattle, YYYY-MM-DD) so the
// date rules can be tested on any day.

export function makeHelpers(TODAY_ISO) {
  /**
   * The date a day tab or day heading stands for: "Today 10/06", "Thursday 10/08", "T 6", "Wed 7", "7 Wed", "Oct 7 Thu",
   * "Tue, Oct 06", "WEDNESDAY, OCTOBER 7", "Mon October 5, 2026", "Tomorrow Wed", "Today". Null when it names no day.
   */
  function dateFromLabel(label) {
    const [ty, tm, td] = TODAY_ISO.split("-").map(Number);
    const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const plusDays = (n) => { const t = new Date(Date.UTC(ty, tm - 1, td + n)); return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
    const l = String(label ?? "").replace(/\s+/g, " ").trim();
    let m;
    if ((m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(l))) return m[0];
    if ((m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(l))) {
      const mo = +m[1], d = +m[2];
      let y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : ty;
      if (!m[3] && mo < tm - 6) y += 1;
      return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? iso(y, mo, d) : null;
    }
    const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    // Day before month ("FRIDAY 09 OCT", F45): the same as "Oct 9".
    if ((m = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\b(?:,?\s+(\d{4}))?/i.exec(l))) {
      const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, d = +m[1];
      let y = m[3] ? +m[3] : ty;
      if (!m[3] && mo < tm - 6) y += 1;
      return iso(y, mo, d);
    }
    if ((m = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/i.exec(l))) {
      const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, d = +m[2];
      let y = m[3] ? +m[3] : ty;
      if (!m[3] && mo < tm - 6) y += 1;
      return iso(y, mo, d);
    }
    if (/^today\b/i.test(l)) return plusDays(0);
    if (/^tomorrow\b/i.test(l)) return plusDays(1);
    if ((m = /(?:^|\s)(\d{1,2})(?:\s|$)/.exec(l)) && /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b|^[SMTWF]\s/i.test(l)) {
      // A bare day of the month next to a weekday ("T 6", "Wed 7", "7 Wed"): this month, or next month once it has passed.
      // A week strip often starts on a Sunday already past (Sun 4 on Wed 7): that is this month. Only a number far below
      // today's is next month's.
      const d = +m[1];
      let mo = tm, y = ty;
      if (d < td - 7) { mo += 1; if (mo > 12) { mo = 1; y += 1; } }
      return d >= 1 && d <= 31 ? iso(y, mo, d) : null;
    }
    if ((m = /\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\b/i.exec(l))) {
      const want = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].indexOf(m[1].toLowerCase());
      const todayWd = new Date(Date.UTC(ty, tm - 1, td)).getUTCDay();
      return plusDays((want - todayWd + 7) % 7);
    }
    return null;
  }
  /** A line that is only a day heading ("Wed, Oct 07", "WEDNESDAY, OCTOBER 7", "Mon October 5, 2026", "Thursday 10/08"). */
  const DAY_HEADING = /^\s*(?:(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*,?\s+)?(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:,?\s+\d{4})?|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*(?:PDT|PST)?\s*$/i;

  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  function timeOnPage(hhmm, text) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? ""); if (!m) return false;
    const h = +m[1], mi = m[2], h12 = ((h + 11) % 12) + 1, ap = h < 12 ? "a" : "p";
    const t = text.toLowerCase().replace(/\s+/g, " ");
    // "3:00 - 3:50" (a range with no am/pm, Fitli): the 12-hour start followed by a dash.
    return [`${h12}:${mi} -`, `${h12}:${mi}-`, `${h12}:${mi} ${ap}`, `${h12}:${mi}${ap}`, `${h12}:${mi} ${ap}.m`, `${String(h).padStart(2, "0")}:${mi}`, `${h}:${mi}`, mi === "00" ? `${h12} ${ap}m` : "#", mi === "00" ? `${h12}${ap}m` : "#"].some((v) => v !== "#" && t.includes(v));
  }
  function verify(classes, text) {
    const pageNorm = norm(text);
    const kept = [], dropped = [];
    for (const c of classes) {
      const nameOk = norm(c.name).length >= 3 && pageNorm.includes(norm(c.name));
      const timeOk = timeOnPage(c.start, text);
      (nameOk && timeOk ? kept : dropped).push({ ...c, why: nameOk ? (timeOk ? "" : "time not on page") : "name not on page" });
    }
    // A name that begins with its own time ("5am CrossFit", Magnolia CrossFit Village) is shown without it; the time is on the row.
    for (const c of kept) c.name = c.name.replace(/^\d{1,2}(?::\d{2})?\s?(?:am|pm)\s+(?=\S)/i, "");
    // one row per (date, start, name)
    const seen = new Set();
    return { kept: kept.filter((c) => { const k = `${c.date}|${c.start}|${norm(c.name)}`; return seen.has(k) ? false : seen.add(k); }), dropped };
  }
  /**
   * Splits page text into day pieces: at the reader's own "[Day tab shown: …]" / "[Day column: …]" markers, and inside a
   * piece at day-heading lines when there are at least three (a week listed under headings). Each piece carries the date its
   * marker or heading names, or null when the text names no day (then the model works it out as before).
   */
  function dayPieces(text) {
    const out = [];
    const marked = text.split(/^(?=\[Day (?:tab shown|column):[^\]]*\])/m);
    for (const block of marked) {
      const m = /^\[Day (?:tab shown|column):\s*([^\]]*)\]\n?/.exec(block);
      const date = m ? dateFromLabel(m[1]) : null;
      const body = m ? block.slice(m[0].length) : block;
      // A header printed over two lines ("MON" then "05", Olympic Athletic Club) is one heading: "MON 05".
      const lines = body.split("\n").reduce((acc, l) => { const prev = acc[acc.length - 1]; if (prev !== undefined && /^\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?\s*$/i.test(prev) && /^\s*\d{1,2}\s*$/.test(l)) acc[acc.length - 1] = `${prev.trim()} ${l.trim()}`; else acc.push(l); return acc; }, []);
      let heads = lines.map((l, i) => (DAY_HEADING.test(l) && dateFromLabel(l) ? i : -1)).filter((i) => i >= 0);
      if (!date && heads.length < 3) {
        // "MON 05" headings count only when a week really hangs under them: at least three of the days have class times. A strip
        // of day buttons at the top of a page (every day, then the classes of one) never does.
        const wd = lines.map((l, i) => (/^\s*(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?\s+\d{1,2}\s*$/i.test(l) && dateFromLabel(l) ? i : -1)).filter((i) => i >= 0);
        const timed = wd.filter((h, k) => /\b\d{1,2}:\d{2}\s*(am|pm)/i.test(lines.slice(h, wd[k + 1] ?? lines.length).join("\n"))).length;
        if (wd.length >= 3 && timed >= 3) heads = wd;
      }
      // A tab that shows the whole fortnight under dated headings (F45 Eastlake: "FRIDAY 09 OCT" … with classes under each)
      // is not one day, whatever its label says: the headings win when at least three of them have class times under them.
      const timedHeads = heads.filter((h, k) => /\b\d{1,2}:\d{2}/.test(lines.slice(h, heads[k + 1] ?? lines.length).join("\n"))).length;
      if ((!date || timedHeads >= 3) && heads.length >= 3) {
        out.push({ date: null, text: lines.slice(0, heads[0]).join("\n") });
        heads.forEach((h, k) => out.push({ date: dateFromLabel(lines[h]), text: lines.slice(h, heads[k + 1] ?? lines.length).join("\n") }));
      } else out.push({ date, text: body });
    }
    return out.filter((x) => x.text.trim());
  }
  /**
   * One FullCalendar event as the page prints it, turned into a class: { time, title, coach } → { date, start, end, name, instructor }.
   * `time` is a range ("7:30AM — 8:30AM", "3:00 PM - 3:50 PM") or a start ("5:30am"); a title that begins with its own time
   * ("8:30 AM Hyrox", "3:00 Conditioning") loses it. Null when no start time can be read, so the page falls back to the model.
   */
  function parseFcEvent(ev, date) {
    const T = /(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m?\.?/i;
    const to24 = (h, m, ap) => `${String(((+h % 12) + (/p/i.test(ap) ? 12 : 0))).padStart(2, "0")}:${m ?? "00"}`;
    const range = /(\d{1,2})(?::(\d{2}))?\s*([ap])m?\s*[—–-]\s*(\d{1,2})(?::(\d{2}))?\s*([ap])m?/i.exec(ev.time ?? "");
    let start = null, end = null;
    if (range) { start = to24(range[1], range[2], range[3]); end = to24(range[4], range[5], range[6]); }
    else { const one = T.exec(ev.time ?? ""); if (one) start = to24(one[1], one[2], one[3]); }
    if (!start) return null;
    const name = String(ev.title ?? "").replace(/^\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s+(?=\S)/i, "").replace(/\s+/g, " ").trim();
    if (!name) return null;
    return { date, start, end, name, instructor: ev.coach ? ev.coach.replace(/\s+/g, " ").trim() : null, spots: null };
  }

  /**
   * The part of a day's text that holds its classes: from a little before the first line with a time to a little after the
   * last. Menus, intro copy and footers around it are most of a page and cost the model time without ever naming a class.
   */
  function trimToTimes(text) {
    const lines = text.split("\n");
    const timed = lines.map((l, i) => (/\b\d{1,2}:\d{2}\s*(am|pm)|\b\d{1,2}\s*(am|pm)\b|\b\d{1,2}:\d{2}\b/i.test(l) ? i : -1)).filter((i) => i >= 0);
    if (!timed.length) return text;
    const from = Math.max(0, timed[0] - 20), to = Math.min(lines.length, timed[timed.length - 1] + 12);
    return (from > 0 ? "…\n" : "") + lines.slice(from, to).join("\n") + (to < lines.length ? "\n…" : "");
  }

  /**
   * A classic Mindbody class-schedule page (clients.mindbodyonline.com/classic/mainclass …) as its text: a date heading ("Mon
   * October 5, 2026"), then one row per class made of lines: start time ("5:00 am PDT"), class, teacher, location, length
   * ("1 hour"). Returns the classes from today on, or [] when the text has no such rows. `location` keeps one location's rows.
   */
  function parseMindbodyClassic(text, location) {
    const lines = String(text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    const HEAD = /^(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*\s+([a-z]+)\s+(\d{1,2}),\s*(\d{4})$/i;
    const TIME = /^(\d{1,2}):(\d{2})\s*([ap])m(?:\s+[A-Z]{3})?$/i;
    const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const out = [];
    let date = null;
    for (let i = 0; i < lines.length; i++) {
      const h = HEAD.exec(lines[i]);
      if (h) { const mo = MONTHS.indexOf(h[1].slice(0, 3).toLowerCase()) + 1; date = mo ? `${h[3]}-${String(mo).padStart(2, "0")}-${String(+h[2]).padStart(2, "0")}` : null; continue; }
      const t = TIME.exec(lines[i]);
      if (!t || !date) continue;
      const row = [];
      for (let j = i + 1; j < lines.length && row.length < 4 && !TIME.test(lines[j]) && !HEAD.test(lines[j]); j++) row.push(lines[j]);
      if (row.length < 3) continue;
      // Some studios print no location column (SweatBox): then the third line is already the length.
      const isLength = (l) => /^\d+(?:\.\d+)?\s*(?:hours?|mins?|minutes?)\b/i.test(l ?? "") || /^(?:\d+\s*hours?\s*&?\s*)?\d*\s*minutes?$/i.test(l ?? "");
      const hasWhere = row.length >= 4 || !isLength(row[2]);
      const name = row[0], teacher = row[1], where = hasWhere ? row[2] : null, length = hasWhere ? row[3] : row[2];
      const startH = (+t[1] % 12) + (t[3].toLowerCase() === "p" ? 12 : 0);
      // "1 hour", "45 minutes", "1 hour &30 minutes": hours and minutes both count.
      const mins = (/(\d+)\s*hours?/i.exec(length ?? "")?.[1] ?? 0) * 60 + +(/(\d+)\s*min/i.exec(length ?? "")?.[1] ?? 0);
      const start = `${String(startH).padStart(2, "0")}:${t[2]}`;
      const total = startH * 60 + +t[2] + mins;
      const end = mins ? `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` : null;
      if (date < TODAY_ISO) continue;
      if (location && !String(where ?? "").toLowerCase().includes(location.toLowerCase())) continue;
      out.push({ date, start, end, name, instructor: teacher && !/^(staff|tbd)$/i.test(teacher) ? teacher.replace(/\s*\(\d+\)\s*$/, "") : null, spots: null, location: where ?? null });
    }
    return out;
  }

  /**
   * One Arketa calendar cell (article.calendar-view__cell) as its pieces: { time: "09:00 AM (60 min)", name, host, location } →
   * { date, start, end, name, instructor, location }. The length in brackets gives the end. Null without a start time or name
   * (a "No Classes" placeholder has neither), so the page falls back to the model.
   */
  function parseArketaCell(cell, date) {
    const t = /(\d{1,2}):(\d{2})\s*([ap])m?(?:[^()\d]*\((\d+)\s*min\))?/i.exec(cell.time ?? "");
    const name = String(cell.name ?? "").replace(/\s+/g, " ").trim();
    if (!t || !name || /^no classes$/i.test(name)) return null;
    const h = (+t[1] % 12) + (t[3].toLowerCase() === "p" ? 12 : 0);
    const start = `${String(h).padStart(2, "0")}:${t[2]}`;
    const total = h * 60 + +t[2] + (t[4] ? +t[4] : 0);
    const end = t[4] ? `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` : null;
    return { date, start, end, name, instructor: cell.host ? String(cell.host).replace(/\s+/g, " ").trim() : null, spots: null, location: cell.location ? String(cell.location).trim() : null };
  }

  /**
   * A Club Pilates studio page (clubpilates.com/location/<studio>) as its text: dated headings ("Saturday October 10"), then per
   * class a name line ("CP Reformer Flow 1.5 (50 Mins)"), a line "8:00 am • Instructor", "Class details", and a status line
   * ("5 spots", "1 spot", "Class Full"). Returns { classes, timeLines }: the classes from today on, and how many "time •" lines
   * the page has from today on, so the caller can tell a complete parse from a partial one.
   */
  function parseClubPilates(text) {
    const lines = String(text ?? "").split("\n").map((l) => l.replace(/\s+/g, " ").trim());
    const HEAD = /^(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*\s+([a-z]+)\s+(\d{1,2})$/i;
    const TIME = /^(\d{1,2}):(\d{2})\s*([ap])m\s*[•·]\s*(.*)$/i;
    const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const skipName = /^(class details|book class|join waitlist|class full|\d+ spots?( left)?|waitlist.*|cancel.*)$/i;
    const classes = [];
    let timeLines = 0;
    let date = null;
    for (let i = 0; i < lines.length; i++) {
      const h = HEAD.exec(lines[i]);
      if (h) {
        const mo = MONTHS.indexOf(h[1].slice(0, 3).toLowerCase()) + 1;
        date = mo ? dateFromLabel(`${h[1]} ${h[2]}`) : null;
        continue;
      }
      const t = TIME.exec(lines[i]);
      if (!t || !date) continue;
      if (date < TODAY_ISO) continue;
      timeLines += 1;
      let name = "";
      for (let j = i - 1; j >= 0 && j >= i - 4; j--) { if (lines[j] && !skipName.test(lines[j]) && !TIME.test(lines[j]) && !HEAD.test(lines[j])) { name = lines[j]; break; } }
      if (!name) continue;
      let spots = null;
      for (let j = i + 1; j < lines.length && j <= i + 7 && !TIME.test(lines[j]) && !HEAD.test(lines[j]); j++) {
        const m = /^(\d+) spots?( left)?$/i.exec(lines[j]);
        if (m) { spots = `${m[1]} ${+m[1] === 1 ? "spot" : "spots"} left`; break; }
        if (/^class full$/i.test(lines[j])) { spots = "Full"; break; }
      }
      const h24 = (+t[1] % 12) + (t[3].toLowerCase() === "p" ? 12 : 0);
      const start = `${String(h24).padStart(2, "0")}:${t[2]}`;
      const len = /\((\d+)\s*mins?\)/i.exec(name)?.[1];
      const total = h24 * 60 + +t[2] + (len ? +len : 0);
      const end = len ? `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}` : null;
      classes.push({ date, start, end, name: name.replace(/\s*\(\d+\s*mins?\)\s*$/i, "").trim(), instructor: t[4]?.trim() || null, spots });
    }
    return { classes, timeLines };
  }

  /**
   * An F45 studio page (f45training.com/studio/<studio>) as its text: dated headings ("FRIDAY 09 OCT"), then per class a start
   * time line ("04:50"), an "AM"/"PM" line, "Name - 11 Spots" (or "Name - Full"), and the instructor, with "BOOK" lines between.
   * A page whose day tabs repeat the same fortnight lists each class several times; each (day, time, name) is taken once.
   * Returns { classes, timeLines }: the classes from today on and how many distinct time rows the page has from today on.
   */
  function parseF45(text) {
    const lines = String(text ?? "").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    const HEAD = /^(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*\s+(\d{1,2})\s+([a-z]{3})$/i;
    const seen = new Set();
    const classes = [];
    const timeKeys = new Set();
    let date = null;
    for (let i = 0; i < lines.length; i++) {
      if (HEAD.test(lines[i])) { date = dateFromLabel(lines[i]); continue; }
      const t = /^(\d{1,2}):(\d{2})$/.exec(lines[i]);
      const ap = /^(am|pm)$/i.exec(lines[i + 1] ?? "");
      if (!t || !ap || !date || date < TODAY_ISO) continue;
      const key = `${date}|${lines[i]}${ap[1].toUpperCase()}|${lines[i + 2] ?? ""}`;
      timeKeys.add(key);
      // "Lonestar - 11 Spots", "Vegas - Full", or just "Lonestar" when the studio shows no spots.
      const nameLine = lines[i + 2] ?? "";
      if (!nameLine || /^book$/i.test(nameLine) || /^\d{1,2}:\d{2}$/.test(nameLine) || HEAD.test(nameLine)) continue;
      const nm = /^(.+?)(?:\s+-\s+(.+))?$/.exec(nameLine);
      if (!nm) continue;
      let instructor = null;
      for (let j = i + 3; j < lines.length && j <= i + 5; j++) { if (/^book$/i.test(lines[j])) continue; if (/^\d{1,2}:\d{2}$/.test(lines[j]) || HEAD.test(lines[j])) break; instructor = lines[j]; break; }
      if (seen.has(key)) continue;
      seen.add(key);
      const h24 = (+t[1] % 12) + (/^p/i.test(ap[1]) ? 12 : 0);
      const sp = /^(\d+)\s+spots?$/i.exec(nm[2] ?? "");
      classes.push({ date, start: `${String(h24).padStart(2, "0")}:${t[2]}`, end: null, name: nm[1].trim(), instructor, spots: sp ? `${sp[1]} ${+sp[1] === 1 ? "spot" : "spots"} left` : /^full$/i.test(nm[2] ?? "") ? "Full" : null });
    }
    return { classes, timeLines: timeKeys.size };
  }

  /**
   * A [solidcore] studio page (solidcore.co/studios/<studio>) as its text: a day heading over two lines ("Sunday" then
   * "October 11"), then per class a range "7:10 AM - 8:00 AM", the class name, the studio ("WA, Ballard"), "w/ Gabby R. / Head
   * Coach", a "view coach details" line, and "7 of 15 open" or "join waitlist". Each day's tab repeats the strip of days, so a
   * class is taken once per (day, start, name). Returns { classes, timeLines } like the other page parsers.
   */
  function parseSolidcore(text) {
    const lines = String(text ?? "").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    const WD = /^(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i;
    const MD = /^([A-Za-z]+) (\d{1,2})$/;
    const RANGE = /^(\d{1,2}):(\d{2}) ([AP])M - (\d{1,2}):(\d{2}) ([AP])M$/i;
    const to24 = (h, m, ap) => `${String(((+h % 12) + (/^p/i.test(ap) ? 12 : 0))).padStart(2, "0")}:${m}`;
    const seen = new Set(), classes = [], timeKeys = new Set();
    let date = null;
    for (let i = 0; i < lines.length; i++) {
      if (WD.test(lines[i]) && MD.test(lines[i + 1] ?? "")) { const m = MD.exec(lines[i + 1]); date = dateFromLabel(`${m[1]} ${m[2]}`); i += 1; continue; }
      const r = RANGE.exec(lines[i]);
      if (!r || !date || date < TODAY_ISO) continue;
      const name = lines[i + 1] ?? "";
      const key = `${date}|${lines[i]}|${name}`;
      timeKeys.add(key);
      if (!name || seen.has(key)) continue;
      seen.add(key);
      let instructor = null, spots = null;
      for (let j = i + 2; j < lines.length && j <= i + 8 && !RANGE.test(lines[j]) && !(WD.test(lines[j]) && MD.test(lines[j + 1] ?? "")); j++) {
        const w = /^w\/ (.+)$/i.exec(lines[j]);
        if (w && instructor == null) instructor = w[1].split(" / ")[0].trim();
        const o = /^(\d+) of (\d+) open$/i.exec(lines[j]);
        if (o) spots = `${o[1]} of ${o[2]} open`;
        if (/^join waitlist$/i.test(lines[j])) spots = "Waitlist";
      }
      classes.push({ date, start: to24(r[1], r[2], r[3]), end: to24(r[4], r[5], r[6]), name, instructor, spots });
    }
    return { classes, timeLines: timeKeys.size };
  }

  /**
   * A Pure Barre or YogaSix studio page (purebarre.com / yogasix.com, one page template) as the reader gets it: one piece per day tab, each opening with
   * the reader's "[Day tab shown: Saturday 10/10]" marker. In a piece, every class is a name line ("Pure Barre Classic™"), an
   * optional note ("New Members & Local Residents Only!"), the range with the teacher glued on ("9:45am-10:35amKatie W.") and
   * "reserve" or "5 spots openreserve". Returns { classes, timeLines } like the other page parsers.
   */
  function parsePureBarre(text) {
    const pieces = String(text ?? "").split(/^(?=\[Day tab shown:)/m);
    const RANGE = /^(\d{1,2}):(\d{2})(am|pm)-(\d{1,2}):(\d{2})(am|pm)(.*)$/i;
    const to24 = (h, m, ap) => `${String(((+h % 12) + (/^p/i.test(ap) ? 12 : 0))).padStart(2, "0")}:${m}`;
    const skip = /only!?$|^reserve$|spots? open|^\d|^new members|^teacher|^today$|^(sun|mon|tue|wed|thu|fri|sat)[a-z]*$/i;
    const seen = new Set(), classes = [], timeKeys = new Set();
    for (const piece of pieces) {
      const mk = /^\[Day tab shown:\s*([^\]]*)\]/.exec(piece);
      const date = mk ? dateFromLabel(mk[1]) : null;
      if (!date || date < TODAY_ISO) continue;
      const lines = piece.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const r = RANGE.exec(lines[i]);
        if (!r) continue;
        const key = `${date}|${r[1]}:${r[2]}${r[3]}`;
        // The class name is the nearest line above the range, unless a special title sits between them (YogaSix: "Y6 Slow Flow", then
        // "1 Year Anniversary", then the range): then the brand's own class name wins.
        let name = "", brand = "";
        for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
          if (skip.test(lines[j]) || RANGE.test(lines[j]) || lines[j].length >= 70) continue;
          if (!name) name = lines[j];
          if (/^(y6\b|pure barre\b)/i.test(lines[j])) { brand = lines[j]; break; }
        }
        if (brand) name = brand;
        timeKeys.add(`${key}|${name}`);
        if (!name || seen.has(`${key}|${name}`)) continue;
        seen.add(`${key}|${name}`);
        let spots = null;
        for (let j = i + 1; j < lines.length && j <= i + 2; j++) { const m = /^(\d+) spots? open/i.exec(lines[j]); if (m) { spots = `${m[1]} ${+m[1] === 1 ? "spot" : "spots"} left`; break; } if (RANGE.test(lines[j])) break; }
        classes.push({ date, start: to24(r[1], r[2], r[3]), end: to24(r[4], r[5], r[6]), name: name.replace(/[™®]/g, "").trim(), instructor: r[7]?.trim() || null, spots });
      }
    }
    return { classes, timeLines: timeKeys.size };
  }

  /**
   * A CorePower Yoga studio schedule page (corepoweryoga.com/yoga-schedules/studio?centerId=…) as its text: a day heading
   * ("Sun, Oct 11") and "10 classes", then per class a time line ("9:00 am"), "PDT", the class ("C2 - CorePower Yoga 2"), the studio, the
   * teacher, and "BOOK" or "Cancelled". Cancelled classes are left out (and not counted). Every day tab repeats the list, so a class is
   * taken once per (day, start, name). Returns { classes, timeLines }.
   */
  function parseCorePower(text) {
    const lines = String(text ?? "").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    const HEAD = /^(?:sun|mon|tue|wed|thu|fri|sat)[a-z]*,? ([a-z]{3,9}) (\d{1,2})$/i;
    const TIME = /^(\d{1,2}):(\d{2}) ([ap])m$/i;
    const seen = new Set(), classes = [], timeKeys = new Set();
    let date = null;
    for (let i = 0; i < lines.length; i++) {
      const h = HEAD.exec(lines[i]);
      if (h) { date = dateFromLabel(`${h[1]} ${h[2]}`); continue; }
      const t = TIME.exec(lines[i]);
      if (!t || !date || date < TODAY_ISO) continue;
      // A time line that is not followed by a zone ("PDT") is a row of a shape this parser does not know: it is counted, but is no class,
      // so the page fails the count check and goes to the model instead of losing the class.
      if (!/^[A-Z]{3,4}$/.test(lines[i + 1] ?? "")) { timeKeys.add(`odd|${date}|${lines[i]}|${i}`); continue; }
      const name = lines[i + 2] ?? "", teacher = lines[i + 4] ?? "", status = lines[i + 5] ?? "";
      if (/^cancel/i.test(status) || /cancel/i.test(name)) continue;
      const key = `${date}|${lines[i]}|${name}`;
      timeKeys.add(key);
      if (!name || seen.has(key)) continue;
      seen.add(key);
      const h24 = (+t[1] % 12) + (t[3].toLowerCase() === "p" ? 12 : 0);
      classes.push({ date, start: `${String(h24).padStart(2, "0")}:${t[2]}`, end: null, name, instructor: teacher && !/^(book|cancel|waitlist)/i.test(teacher) ? teacher : null, spots: /^waitlist/i.test(status) ? "Waitlist" : null });
    }
    return { classes, timeLines: timeKeys.size };
  }

  return { dateFromLabel, DAY_HEADING, norm, timeOnPage, verify, dayPieces, parseFcEvent, trimToTimes, parseMindbodyClassic, parseArketaCell, parseClubPilates, parseF45, parseSolidcore, parsePureBarre, parseCorePower };
}
