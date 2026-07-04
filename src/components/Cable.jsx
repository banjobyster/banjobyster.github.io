import { useEffect, useRef, useState } from "react";

// The dashed data cable running down the left gutter, from the hero port to
// the footer socket. It doubles as a scroll progress indicator (railFill
// height follows scroll). The clips are decorative 44px-wide cable clamps
// spaced at most 80px apart with alternating +-8px offsets, distributed
// uniformly so the last one lands 44px above the footer socket. The count is
// forced even so the alternation ends opposite the socket's variant, and the
// hero portJack reads as clip zero.
const MAX_CLIP_SPACING = 80;
const CLIP_W = 44;
const RAIL_CENTER = 36; // inside the 76px gutter
const CLIP_OFFSET = 8;
const FIRST_CLIP_Y = 54; // rail starts at portJack bottom; jack top -> first clip top = 28 + 54 = 82px
const LAST_CLIP_MARGIN = 44; // last clip top sits this far above the socket

function clipPositions(railHeight) {
  const span = railHeight - FIRST_CLIP_Y - LAST_CLIP_MARGIN;
  if (span <= 0) return [];
  let steps = Math.ceil(span / MAX_CLIP_SPACING);
  if (steps % 2 === 1) steps += 1; // even step count -> last clip is a "left" rung
  const spacing = span / steps;
  return Array.from({ length: steps + 1 }, (_, i) => ({
    y: FIRST_CLIP_Y + i * spacing,
    left: RAIL_CENTER + (i % 2 ? CLIP_OFFSET : -CLIP_OFFSET) - CLIP_W / 2,
  }));
}

export default function Cable() {
  const railRef = useRef(null);
  const [rail, setRail] = useState({ top: 0, height: 0 });

  // Measure from the hero portJack to the footer socket. Re-measure on any
  // layout change (fonts, images, live data swapping in, resize).
  useEffect(() => {
    const measure = () => {
      const page = document.getElementById("page");
      const port = document.getElementById("port");
      const end = document.getElementById("cableEnd");
      if (!page || !port || !end) return;
      const p = page.getBoundingClientRect();
      const a = port.getBoundingClientRect();
      const b = end.getBoundingClientRect();
      const top = a.bottom - p.top;
      const height = Math.max(0, b.top - a.bottom);
      setRail((r) =>
        Math.abs(r.top - top) < 1 && Math.abs(r.height - height) < 1
          ? r
          : { top, height }
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);
    window.addEventListener("resize", measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Scroll progress -> --fill on the rail.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = railRef.current;
        if (!el) return;
        const max =
          document.documentElement.scrollHeight - window.innerHeight;
        const t = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        el.style.setProperty("--fill", t.toFixed(4));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const clips = clipPositions(rail.height);

  return (
    <div
      className="rail"
      ref={railRef}
      style={{ top: rail.top, height: rail.height }}
      aria-hidden="true"
    >
      <span className="railLine" />
      <span className="railFill" />
      {clips.map((c) => (
        <span
          key={c.y}
          className="clip"
          style={{ top: c.y, left: c.left }}
        />
      ))}
      <span className="railPlug" />
    </div>
  );
}
