import { getRootDomain } from "@/lib/tenant";

/** `https://tapandlaunch.com` (or `http://localhost:3100` in development): the address of the marketing site and dashboard. */
export function siteOrigin(): string {
  const root = getRootDomain();
  const local = /^(localhost|127\.|\d{1,3}(\.\d{1,3}){3})/.test(root);
  return `${local ? "http" : "https"}://${root}`;
}
