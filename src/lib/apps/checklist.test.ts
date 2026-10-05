import { describe, expect, it } from "vitest";
import { buildChecklist } from "./checklist";

const none = { hasContent: false, hasIcon: false, hasLook: false, published: false, hasVisit: false };

describe("Get live checklist", () => {
  it("starts with just the app created, and content as the next step", () => {
    const c = buildChecklist(none);
    expect(c.doneCount).toBe(1);
    expect(c.total).toBe(5);
    expect(c.complete).toBe(false);
    expect(c.next?.id).toBe("content");
  });

  it("points at the first step that isn't done, in order", () => {
    expect(buildChecklist({ ...none, hasContent: true }).next?.id).toBe("look");
    expect(buildChecklist({ ...none, hasContent: true, hasLook: true }).next?.id).toBe("publish");
    expect(buildChecklist({ ...none, hasContent: true, hasLook: true, published: true }).next?.id).toBe("visit");
    expect(buildChecklist({ ...none, hasContent: true, hasLook: true, published: true, hasVisit: true }).complete).toBe(true);
  });

  it("counts either an icon or saved colors as making it yours", () => {
    expect(buildChecklist({ ...none, hasContent: true, hasIcon: true }).next?.id).toBe("publish");
    expect(buildChecklist({ ...none, hasContent: true, hasLook: true }).next?.id).toBe("publish");
  });

  it("doesn't skip ahead: a published app with no content still asks for content", () => {
    const c = buildChecklist({ ...none, published: true });
    expect(c.next?.id).toBe("content");
    expect(c.doneCount).toBe(2);
  });

  it("is complete when everything is done", () => {
    const c = buildChecklist({ hasContent: true, hasIcon: true, hasLook: true, published: true, hasVisit: true });
    expect(c.complete).toBe(true);
    expect(c.next).toBeNull();
    expect(c.doneCount).toBe(5);
  });
});
