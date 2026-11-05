/** The builder's preview of the Automation screen: one line, because everything private happens on the live page. */
export function OpenMicAutomationBlockView() {
  return (
    <div className="px-4 py-3">
      <h2 className="text-lg font-semibold">Automation</h2>
      <p className="mt-2 rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Automation (private) — only the listed address sees this.
      </p>
    </div>
  );
}
