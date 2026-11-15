/** A short success buzz. Android and desktop Chrome: the Vibration API. iPhone has no Vibration API, so it flips a hidden
 *  <input type="checkbox" switch> through its label, which makes iOS Safari 17.4+ tick (nothing happens on older iPhones). Never throws. */
function tick(): void {
  const label = document.createElement("label");
  label.setAttribute("aria-hidden", "true");
  label.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  label.appendChild(input);
  document.body.appendChild(label);
  label.click();
  label.remove();
}

export function hapticSuccess(): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([80, 50, 80]);
      return;
    }
    if (typeof document === "undefined") return;
    tick();
    setTimeout(() => {
      try {
        tick();
      } catch {
        // A second tick is a bonus; ignore any failure.
      }
    }, 120);
  } catch {
    // No haptics on this device: the card is still shown.
  }
}
