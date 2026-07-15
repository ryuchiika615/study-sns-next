"use client";

import { useEffect, useRef } from "react";
import katex from "katex";

function renderLatexInElement(el: HTMLElement) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  for (const node of textNodes) {
    const text = node.textContent || "";
    const regex = /\$\$(.+?)\$\$|\$(.+?)\$/g;
    if (!regex.test(text)) continue;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    regex.lastIndex = 0;

    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }
      const span = document.createElement("span");
      try {
        katex.render(match[1] || match[2], span, {
          throwOnError: false,
          displayMode: match[1] !== undefined,
        });
      } catch {
        span.textContent = match[0];
      }
      frag.appendChild(span);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode?.replaceChild(frag, node);
  }
}

export default function LatexText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = text;
      renderLatexInElement(ref.current);
    }
  }, [text]);

  return (
    <div ref={ref} className={`whitespace-pre-wrap ${className}`}>
      {text}
    </div>
  );
}
