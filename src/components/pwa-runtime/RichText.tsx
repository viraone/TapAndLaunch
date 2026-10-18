import { Fragment } from "react";
import { isContactHref, parseRichText, type Run } from "@/lib/rich-text";

/** A paragraph with its bold, italic, links and bullets, from the plain text the app stores (see `lib/rich-text`). */
export function RichText({ text }: { text: string }) {
  const blocks = parseRichText(text);
  return (
    <>
      {blocks.map((block, i) =>
        block.type === "ul" ? (
          <ul key={i} className="my-2 list-disc space-y-1 pl-5">
            {block.items.map((runs, j) => (
              <li key={j}>
                <Runs runs={runs} />
              </li>
            ))}
          </ul>
        ) : (
          <Fragment key={i}>
            {i > 0 && blocks[i - 1].type === "p" && <br />}
            {block.lines.map((runs, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Runs runs={runs} />
              </Fragment>
            ))}
          </Fragment>
        )
      )}
    </>
  );
}

function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) => {
        let node: React.ReactNode = run.text;
        if (run.bold) node = <strong className="font-semibold text-foreground">{node}</strong>;
        if (run.italic) node = <em>{node}</em>;
        if (run.href)
          node = isContactHref(run.href) ? (
            <a href={run.href} className="font-medium text-primary underline underline-offset-2">
              {node}
            </a>
          ) : (
            <a href={run.href} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
              {node}
            </a>
          );
        return <Fragment key={i}>{node}</Fragment>;
      })}
    </>
  );
}
