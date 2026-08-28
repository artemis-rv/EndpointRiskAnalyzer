/**
 * components/common/Accordion.tsx
 * ───────────────────────────────
 * Disclosure list used by the FAQ.
 *
 * Built on a real <button> with aria-expanded and aria-controls, so it works
 * with a keyboard and announces its state. Panels stay in the DOM and are
 * hidden with the `hidden` attribute, which keeps in-page find working.
 */

import { useId, useState } from 'react';
import { ChevronDownIcon } from './Icons';

export interface AccordionItem {
  id: string;
  question: string;
  answer: string;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** Allow several panels open at once. Defaults to single-open. */
  allowMultiple?: boolean;
}

export function Accordion({ items, allowMultiple = false }: AccordionProps) {
  const [openIds, setOpenIds] = useState<string[]>([]);
  const baseId = useId();

  function toggle(id: string) {
    setOpenIds((current) => {
      const isOpen = current.includes(id);
      if (isOpen) return current.filter((value) => value !== id);
      return allowMultiple ? [...current, id] : [id];
    });
  }

  return (
    <div className="divide-y divide-ink-100 overflow-hidden rounded-card border border-ink-200 bg-white">
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);
        const buttonId = `${baseId}-${item.id}-button`;
        const panelId = `${baseId}-${item.id}-panel`;

        return (
          <div key={item.id}>
            <h3>
              <button
                type="button"
                id={buttonId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-ink-50"
              >
                <span className="text-[0.9375rem] font-semibold text-ink-900">{item.question}</span>
                <ChevronDownIcon
                  className={`h-5 w-5 shrink-0 text-ink-400 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </h3>
            <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!isOpen}>
              <p className="px-5 pb-5 text-sm leading-relaxed text-ink-600">{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
