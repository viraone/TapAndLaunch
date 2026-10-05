import { afterEach, describe, expect, it, vi } from "vitest";
import { parse } from "@babel/parser";
import { backendRules, checkBackendInput, projectRef, sqlEditorUrl, sqlFiles, sqlHash, SUPABASE_PATH, supabaseFile } from "./backend";
import { isValidPath, validateFiles } from "./files";
import { isFreshApp } from "./first-build";
import { starterFiles } from "./prompt";

const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role, ref: "abcdefghijklmnop" })).toString("base64url")}.sig`;

describe("connecting an app's own database", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a project URL and its public key, in either key format, and tidies the URL", () => {
    expect(checkBackendInput(" https://abcdefghijklmnop.supabase.co/ ", jwt("anon"))).toEqual({ url: "https://abcdefghijklmnop.supabase.co", anonKey: jwt("anon") });
    expect(checkBackendInput("https://abcdefghijklmnop.supabase.co/rest/v1", "sb_publishable_abc123")).toEqual({ url: "https://abcdefghijklmnop.supabase.co", anonKey: "sb_publishable_abc123" });
  });

  it("refuses the secret key, in either format, with a clear reason", () => {
    expect(checkBackendInput("https://abcdefghijklmnop.supabase.co", jwt("service_role"))).toEqual({ error: expect.stringMatching(/secret \(service role\) key/) });
    expect(checkBackendInput("https://abcdefghijklmnop.supabase.co", "sb_secret_abc123")).toEqual({ error: expect.stringMatching(/secret/) });
    expect(checkBackendInput("https://abcdefghijklmnop.supabase.co", "hello")).toEqual({ error: expect.stringMatching(/doesn't look like the public key/) });
  });

  it("on the live site, only talks to real Supabase projects (never an internal address)", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const url of ["http://127.0.0.1:54321", "https://localhost:54321", "https://169.254.169.254", "https://evil.example.com", "https://abcdefghijklmnop.supabase.co.evil.com", "http://abcdefghijklmnop.supabase.co"]) {
      expect(checkBackendInput(url, jwt("anon")), url).toHaveProperty("error");
    }
    expect(checkBackendInput("https://abcdefghijklmnop.supabase.co", jwt("anon"))).not.toHaveProperty("error");
  });

  it("allows the Supabase on this computer while developing", () => {
    expect(checkBackendInput("http://127.0.0.1:54321", jwt("anon"))).toEqual({ url: "http://127.0.0.1:54321", anonKey: jwt("anon") });
  });

  it("links to the project's SQL editor when it's a hosted project", () => {
    expect(projectRef("https://abcdefghijklmnop.supabase.co")).toBe("abcdefghijklmnop");
    expect(sqlEditorUrl("https://abcdefghijklmnop.supabase.co")).toBe("https://supabase.com/dashboard/project/abcdefghijklmnop/sql/new");
    expect(sqlEditorUrl("http://127.0.0.1:54321")).toBeNull();
  });

  it("writes a client that keeps sign-ins through the page around the app", () => {
    const file = supabaseFile({ url: "https://abcdefghijklmnop.supabase.co", anonKey: "sb_publishable_x" });
    expect(file).toContain("createClient(\"https://abcdefghijklmnop.supabase.co\", \"sb_publishable_x\"");
    expect(file).toContain("storage: window.__tlStorage");
    expect(parse(file, { sourceType: "module" })).toBeTruthy();
  });
});

describe("database setup files", () => {
  it("are allowed as db/NNN_name.sql only", () => {
    expect(isValidPath("db/001_init.sql")).toBe(true);
    for (const bad of ["db/init.sql", "db/001_init.SQL", "src/db/001_init.sql", "db/../001_x.sql", "db/001_x.sql.js", "db/01_x.sql"]) expect(isValidPath(bad), bad).toBe(false);
    expect(validateFiles({ "src/App.jsx": "export default () => null", "db/001_init.sql": "create table x();" })).toBeNull();
  });

  it("show which ones the owner has run, and which changed since", () => {
    const files = { "src/App.jsx": "x", "db/002_more.sql": "create table b();", "db/001_init.sql": "create table a();" };
    expect(sqlFiles(files, { "db/001_init.sql": sqlHash("create table a();"), "db/002_more.sql": sqlHash("old text") })).toEqual([
      { path: "db/001_init.sql", sql: "create table a();", ran: true, changed: false },
      { path: "db/002_more.sql", sql: "create table b();", ran: false, changed: true },
    ]);
  });

  it("tell the AI the next free number and never to edit run ones", () => {
    expect(backendRules({ "src/App.jsx": "x" })).toContain("db/001_short_name.sql");
    const rules = backendRules({ "db/001_init.sql": "x", "db/002_more.sql": "y" });
    expect(rules).toContain("db/003_short_name.sql");
    expect(rules).toContain("files already there: db/001_init.sql, db/002_more.sql");
  });

  it("don't stop a brand-new app from being built as a new app", () => {
    expect(isFreshApp({ ...starterFiles("Tasks"), [SUPABASE_PATH]: "export const supabase = 1;" })).toBe(true);
  });
});
