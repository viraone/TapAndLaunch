// StageTime's costume-contest results: the pure parts shared by the hosts' Votes tab and its server route.
// The count itself is done in a Google Sheet (first vote per ballot ID wins, unknown IDs ignored); that sheet's
// "Tally" tab is published to the web as CSV and read here. Nothing in this file touches the network.

export interface VoteRow {
  rank: number;
  name: string;
  votes: number;
  /** 0 to 1. */
  share: number;
}

export interface VoteResults {
  winner: string;
  valid: number;
  duplicates: number;
  invalid: number;
  total: number;
  /** Ballot IDs the sheet knows; 0 means the list was never pasted in and every vote reads as invalid. */
  ballots: number;
  /** The sheet's own warning line, empty when all is well. */
  warning: string;
  rows: VoteRow[];
}

/** Splits CSV text into rows of cells: quoted cells, doubled quotes and line breaks inside quotes included. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function num(value: string | undefined): number {
  const n = Number((value ?? "").replace(/[,%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** "50%" or "0.5" to 0.5. */
function shareOf(value: string | undefined): number {
  const raw = (value ?? "").trim();
  if (raw === "") return 0;
  return raw.includes("%") ? num(raw) / 100 : num(raw);
}

/** Reads the published Tally tab by its labels (not row numbers), so adding a row above doesn't break it. */
export function parseTallyCsv(text: string): VoteResults | null {
  const rows = parseCsv(text);
  const byLabel = new Map<string, string>();
  for (const r of rows) {
    const label = (r[0] ?? "").trim().toLowerCase();
    if (label && !byLabel.has(label)) byLabel.set(label, r[1] ?? "");
  }
  if (!byLabel.has("valid votes counted") || !byLabel.has("winner")) return null;

  const headerAt = rows.findIndex((r) => (r[0] ?? "").trim().toLowerCase() === "rank" && (r[1] ?? "").trim().toLowerCase() === "comedian");
  const table: VoteRow[] = [];
  if (headerAt >= 0) {
    for (const r of rows.slice(headerAt + 1)) {
      const name = (r[1] ?? "").trim();
      if (!name) break;
      table.push({ rank: num(r[0]), name, votes: num(r[2]), share: shareOf(r[3]) });
    }
  }
  const warning = rows.map((r) => (r[0] ?? "").trim()).find((cell) => cell.toUpperCase().startsWith("WARNING")) ?? "";
  return {
    winner: (byLabel.get("winner") ?? "").trim(),
    valid: num(byLabel.get("valid votes counted")),
    duplicates: num(byLabel.get("duplicate votes ignored")),
    invalid: num(byLabel.get("invalid ids ignored")),
    total: num(byLabel.get("total submissions")),
    ballots: num(byLabel.get("ballot ids on file")),
    warning,
    rows: table,
  };
}

/** Only Google's published-sheet addresses may be fetched by the server route. */
export function isPublishedSheetUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname === "docs.google.com" && u.pathname.startsWith("/spreadsheets/d/e/");
  } catch {
    return false;
  }
}

/** Who may read the results: nobody outside the list when one is set, otherwise any host. Case doesn't matter. */
export function mayReadVotes(email: string, allowed: string[] | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  const mine = email.trim().toLowerCase();
  return allowed.some((a) => a.trim().toLowerCase() === mine);
}
