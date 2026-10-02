/**
 * The "Get live" checklist: the handful of steps between a new app and one
 * people are actually using. Every step is worked out from the app's own
 * data, so nobody has to tick anything.
 */

export type ChecklistStepId = "create" | "content" | "icon" | "publish" | "visit";

export interface ChecklistSignals {
  /** The app has at least one block on a page. */
  hasContent: boolean;
  /** An app icon has been uploaded. */
  hasIcon: boolean;
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
      hint: "Pick a block from the library on the left to start this page.",
      action: "Add a block",
      done: s.hasContent,
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
      title: "Open it on your phone",
      hint: "Visit your live address and try it the way your customers will.",
      action: "Open my app",
      done: s.hasVisit,
    },
    {
      id: "icon",
      title: "Add your app icon",
      hint: "It's the picture people see when they add your app to their home screen.",
      action: "Upload an icon",
      done: s.hasIcon,
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
