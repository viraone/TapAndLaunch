/**
 * The "Get live" checklist: the handful of steps between a new app and one
 * people are actually using. Every step is worked out from the app's own
 * data, so nobody has to tick anything.
 */

export type ChecklistStepId = "create" | "content" | "look" | "publish" | "visit";

export interface ChecklistSignals {
  /** The app has at least one block on a page. */
  hasContent: boolean;
  /** An app icon has been uploaded. */
  hasIcon: boolean;
  /** The owner has saved their colours in App settings. */
  hasLook: boolean;
  published: boolean;
  /** Someone has opened the published app (the owner counts). */
  hasVisit: boolean;
}

export interface ChecklistStep {
  id: ChecklistStepId;
  title: string;
  /** Shown under the title while the step is the next one to do. */
  hint: string;
  /** The button on the next step. */
  action: string;
  done: boolean;
}

export interface Checklist {
  steps: ChecklistStep[];
  doneCount: number;
  total: number;
  complete: boolean;
  /** The first step not done yet, or null when everything is. */
  next: ChecklistStep | null;
}

export function buildChecklist(s: ChecklistSignals): Checklist {
  const steps: ChecklistStep[] = [
    { id: "create", title: "Create your app", hint: "", action: "", done: true },
    {
      id: "content",
      title: "Add your content",
      hint: "Pick a section from the list on the left, like a banner or your opening hours, to start this page.",
      action: "Add a section",
      done: s.hasContent,
    },
    {
      id: "look",
      title: "Pick your colors and icon",
      hint: "Make it look like you: a brand color, and the picture people see when they add your app to their home screen.",
      action: "Pick colors and icon",
      done: s.hasIcon || s.hasLook,
    },
    {
      id: "publish",
      title: "Publish",
      hint: "Put it on its own web address. You can unpublish any time.",
      action: "Publish now",
      done: s.published,
    },
    {
      id: "visit",
      title: "Scan the QR code on your phone",
      hint: "Your app's page has a QR code. Point your phone's camera at it and try the app the way your customers will.",
      action: "Show my QR code",
      done: s.hasVisit,
    },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  return {
    steps,
    doneCount,
    total: steps.length,
    complete: doneCount === steps.length,
    next: steps.find((x) => !x.done) ?? null,
  };
}
