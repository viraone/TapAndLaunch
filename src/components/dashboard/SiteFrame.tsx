import { TemplatePreview } from "@/components/dashboard/TemplatePreview";
import type { StarterTemplate } from "@/lib/apps/templates";

/**
 * A template's preview as the picker and the home page show it: a website on a laptop with its phone version beside
 * it (the frame says "a real site, on both"); a phone-first template is its phone. Put it inside a `group` parent
 * (a link or button) and the devices lift a touch on hover. `templateId` names one design of the template
 * (`photography--noir`); the template itself when left out; `goals` are the sections the preview should include.
 */
export function SiteFrame({ template, templateId, goals }: { template: StarterTemplate; templateId?: string; goals?: readonly string[] }) {
  const id = templateId ?? template.id;
  if (template.category !== "website") {
    return (
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-black/10">
        <div className="h-full w-full transition duration-500 ease-out group-hover:scale-[1.03]">
          <TemplatePreview templateId={id} color={template.color} />
        </div>
      </div>
    );
  }
  return (
    <div className="relative aspect-[16/10] w-full">
      {/* The laptop: a dark bezel around the screen, its base a shade wider, both in normal flow so the base always
          sits right under the screen whatever the card's width. */}
      <div className="absolute left-0 top-[3%] flex w-[86%] flex-col items-center transition duration-500 ease-out group-hover:-translate-y-0.5">
        <div className="w-[94%] rounded-t-[10px] rounded-b-[3px] bg-[#15171a] p-[1.8%] pb-[1.2%]">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[3px] bg-neutral-100">
            <TemplatePreview templateId={id} color={template.color} goals={goals} />
          </div>
        </div>
        <div className="h-[7px] w-full rounded-b-[8px] bg-gradient-to-b from-[#e6e7ea] to-[#c9cbd0]" />
      </div>
      <div className="absolute bottom-[2%] right-[1%] aspect-[9/19] w-[24%] overflow-hidden rounded-[12%/6%] bg-neutral-100 shadow-[0_0_0_2.5px_#15171a,0_18px_28px_-14px_rgba(0,0,0,0.55)] transition duration-500 ease-out group-hover:-translate-y-1">
        <TemplatePreview templateId={id} color={template.color} goals={goals} phone />
      </div>
    </div>
  );
}
