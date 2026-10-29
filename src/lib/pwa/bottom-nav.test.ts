import { describe, expect, it } from "vitest";
import { tabsToShow } from "./bottom-nav";

const STAGETIME = [
  { label: "Sign-Up & Lineup", icon: "signup", page_path: "signup", label_if: { flag: "openmic-hosts", label: "Home", icon: "home" } },
  { label: "Hosts", icon: "chat", page_path: "hosts", show_if: "openmic-hosts" },
  { label: "Message the Hosts", icon: "chat", page_path: "message-hosts", show_if: "openmic-comic" },
  { label: "Remote", icon: "remote", page_path: "remote", show_if: "openmic-hosts" },
];

describe("tabsToShow", () => {
  it("shows nothing when the switches leave a single tab of several", () => {
    expect(tabsToShow(STAGETIME, [])).toEqual([]);
  });

  it("a signed-in comic gets two tabs", () => {
    expect(tabsToShow(STAGETIME, ["openmic-comic"]).map((t) => t.label)).toEqual(["Sign-Up & Lineup", "Message the Hosts"]);
  });

  it("a host gets the renamed first tab and the host tabs", () => {
    expect(tabsToShow(STAGETIME, ["openmic-hosts"]).map((t) => t.label)).toEqual(["Home", "Hosts", "Remote"]);
    expect(tabsToShow(STAGETIME, ["openmic-hosts"])[0]!.icon).toBe("home");
  });

  it("leaves a bar set up with one tab alone", () => {
    const one = [{ label: "Home", icon: "home", page_path: "home" }];
    expect(tabsToShow(one, [])).toEqual(one);
  });

  it("keeps a plain bar as it is", () => {
    const plain = [
      { label: "Home", icon: "home", page_path: "home" },
      { label: "Shop", icon: "cart", page_path: "shop" },
    ];
    expect(tabsToShow(plain, [])).toEqual(plain);
  });
});
