'use client';

import { useEffect } from 'react';
import { MessageCircle } from 'lucide-react';

export default function HelpPage() {
  useEffect(() => {
    const loadTallyScript = () => {
      const d = document;
      const w = "https://tally.so/widgets/embed.js";
      const v = function() {
        if (typeof (window as any).Tally !== "undefined") {
          (window as any).Tally.loadEmbeds();
        } else {
          d.querySelectorAll("iframe[data-tally-src]:not([src])").forEach((e: any) => {
            e.src = e.dataset.tallySrc;
          });
        }
      };
      
      if (typeof (window as any).Tally !== "undefined") {
        v();
      } else if (d.querySelector(`script[src="${w}"]`) == null) {
        const s = d.createElement("script");
        s.src = w;
        s.onload = v;
        s.onerror = v;
        d.body.appendChild(s);
      }
    };

    loadTallyScript();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-start pt-12 px-24">
      <div className="flex items-center gap-3 mb-8">
        <MessageCircle className="h-8 w-8 text-neutral-700" />
        <h1 className="text-3xl font-bold">Contact Kimmy</h1>
      </div>
      <div className="w-full max-w-4xl">
        <iframe 
          data-tally-src="https://tally.so/embed/nGaJ8p?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1" 
          loading="lazy" 
          width="800" 
          height="300" 
          frameBorder="0" 
          marginHeight={0} 
          marginWidth={0} 
          title="Contact form"
        />
      </div>
    </main>
  );
} 