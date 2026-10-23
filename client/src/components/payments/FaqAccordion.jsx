import React, { useId, useState } from "react";

export default function FaqAccordion({ title, items, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className="rounded-2xl border border-border-subtle bg-white overflow-hidden">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={function () {
          setOpen(!open);
        }}
        className="flex w-full min-h-[44px] cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left transition-colors duration-200 hover:bg-surface-low"
      >
        <span className="font-headline-md text-headline-md text-text-primary">{title}</span>
        <span
          className={
            "material-symbols-outlined shrink-0 text-text-muted text-[22px] transition-transform duration-200 motion-reduce:transition-none " +
            (open ? "rotate-180" : "")
          }
          aria-hidden="true"
        >
          expand_more
        </span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className="border-t border-border-subtle bg-surface-low/60"
      >
        <ul className="divide-y divide-border-subtle">
          {items.map(function (item) {
            return (
              <li key={item.question} className="px-5 py-4">
                <p className="font-label-md text-label-md text-text-primary leading-relaxed">
                  {item.question}
                </p>
                <p className="mt-1.5 text-body-sm text-text-secondary leading-relaxed">
                  {item.answer}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
