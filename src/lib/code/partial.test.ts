import { describe, expect, it } from "vitest";
import { parse } from "@babel/parser";
import { closePartialJsx, runnablePartial, salvage } from "./partial";

const SECTION = `import { useState } from 'react';
import { Check, Star } from 'lucide-react';
import { useShared } from '@/lib/shared';

// Four services; the picked one is shared with the booking form.
const SERVICES = [
  { id: 'bath', name: "Bath & Brush", price: 45, note: 'We\\'ll be gentle' },
  { id: 'full', name: 'Full Groom', price: 75, note: \`90 min\` },
];

export default function ServicePicker({ title = "Pick a service" }) {
  const [service, setService] = useShared('service', null);
  const [open, setOpen] = useState(false);
  const total = SERVICES.reduce((sum, s) => sum + (s.price > 50 ? s.price : 0), 0);
  return (
    <section id="book" className="mx-auto max-w-6xl px-6 py-20">
      {/* heading */}
      <h2 className="text-3xl font-extrabold">{title} — it's quick</h2>
      <p style={{ color: 'gray', marginTop: 8 }}>Over {total > 0 ? \`$\${total}\` : 'nothing'} in treats</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <button key={s.id} onClick={() => setService(s.id)} className={\`rounded-2xl p-5 \${service === s.id ? 'ring-2' : ''}\`}>
            <h3 className="font-bold">{s.name}</h3>
            {service === s.id && <Check className="h-5 w-5" />}
            {open ? (
              <p>{s.note}</p>
            ) : (
              <Star />
            )}
          </button>
        ))}
      </div>
      <>
        <span>Fragment text</span>
      </>
    </section>
  );
}

function Unused() {
  return <div>later</div>;
}
`;

const parses = (code: string) => {
  try {
    parse(code, { sourceType: "module", plugins: ["jsx"] });
    return true;
  } catch {
    return false;
  }
};

describe("closing a half-written section", () => {
  it("closes open elements, brackets and an unfinished ternary", () => {
    expect(closePartialJsx("export default function A() {\n  return (\n    <section>\n      <h1>Hello wor")).toBe("export default function A() {\n  return (\n    <section>\n      <h1>Hello wor</h1></section>)}");
    expect(closePartialJsx("const a = 1;\nexport default () => <div>{ok ? (<p>x")).toBe("const a = 1;\nexport default () => <div>{ok ? (<p>x</p>) : null}</div>");
    expect(closePartialJsx("const a = [\n  { id: 1 },")).toBeNull();
    expect(closePartialJsx("return x < y ? 1 : 2")).toBeNull();
  });

  it("never cuts inside an opening tag or a string", () => {
    const closed = closePartialJsx('function A() { return (<div>\n  <a href="https://x.com/a') as string;
    expect(closed).toBe("function A() { return (<div>\n  </div>)}");
  });

  it("gives code that parses for every possible cut of a realistic section", () => {
    let shown = 0;
    for (let at = 0; at <= SECTION.length; at += 3) {
      const out = runnablePartial("src/components/ServicePicker.jsx", SECTION.slice(0, at));
      if (out === null) continue;
      shown += 1;
      expect(parses(out), `cut at ${at}: ${JSON.stringify(SECTION.slice(Math.max(0, at - 40), at))}`).toBe(true);
    }
    // Most of the file is inside the JSX, so most cuts can be shown.
    expect(shown).toBeGreaterThan(SECTION.length / 3 / 2);
  });

  it("wraps the default export so an error shows the placeholder, and keeps the named export", () => {
    const out = runnablePartial("src/components/ServicePicker.jsx", SECTION.slice(0, SECTION.indexOf("{title}"))) as string;
    expect(out).toContain("function ServicePicker(");
    expect(out).not.toMatch(/export\s+default\s+function\s+ServicePicker/);
    expect(out).toContain("export { ServicePicker };");
    expect(out).toContain("export default function __TlPartial(props)");
    expect(out).toContain('"Writing Service Picker…"');
    expect(parses(out)).toBe(true);
  });

  it("shows nothing until the component has started its JSX", () => {
    expect(runnablePartial("src/components/A.jsx", SECTION.slice(0, SECTION.indexOf("return (")))).toBeNull();
    expect(runnablePartial("src/components/A.jsx", "")).toBeNull();
  });

  it("ends a section that hit its length limit after its last whole element, never mid-sentence", () => {
    const cut = "export default function Reviews() {\n  return (\n    <section>\n      <h2>Reviews</h2>\n      <p>Absolutely love th";
    expect(salvage("src/components/Reviews.jsx", cut)).toBe("export default function Reviews() {\n  return (\n    <section>\n      <h2>Reviews</h2>\n      </section>)}");
    expect(salvage("src/components/Hero.jsx", "function Hero() {\n  return <div><h1>Hi</h1><p>The")).toBe("function Hero() {\n  return <div><h1>Hi</h1></div>}\nexport default Hero;");
    expect(salvage("src/components/A.jsx", "const A = [1, 2")).toBeNull();
    let kept = 0;
    for (let at = 0; at <= SECTION.length; at += 3) {
      const out = salvage("src/components/ServicePicker.jsx", SECTION.slice(0, at));
      if (out === null) continue;
      kept += 1;
      expect(parses(out), `cut at ${at}`).toBe(true);
      expect(out).toMatch(/export\s+default/);
    }
    expect(kept).toBeGreaterThan(0);
  });
});
