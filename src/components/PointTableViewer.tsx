import { useCallback, useRef, useState, type WheelEvent, type MouseEvent } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Download, Maximize2, RotateCcw } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  imageUrl: string;
  title?: string;
};

/** Full-screen point table viewer with zoom, pan, fullscreen and download. */
export function PointTableViewer({ open, onOpenChange, imageUrl, title = "Final Point Table" }: Props) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clampScale = (s: number) => Math.min(6, Math.max(0.5, s));

  const zoom = useCallback(
    (delta: number) => setScale((s) => clampScale(s + delta)),
    [],
  );

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    setScale((s) => clampScale(s * (e.deltaY < 0 ? 1.1 : 0.9)));
  };

  const onMouseDown = (e: MouseEvent) => {
    drag.current = { startX: e.clientX, startY: e.clientY, baseX: pos.x, baseY: pos.y };
  };
  const onMouseMove = (e: MouseEvent) => {
    if (!drag.current) return;
    setPos({
      x: drag.current.baseX + (e.clientX - drag.current.startX),
      y: drag.current.baseY + (e.clientY - drag.current.startY),
    });
  };
  const onMouseUp = () => (drag.current = null);

  const reset = () => {
    setScale(1);
    setPos({ x: 0, y: 0 });
  };

  const fullscreen = () => {
    if (containerRef.current?.requestFullscreen) containerRef.current.requestFullscreen();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="glass-strong flex h-[90vh] max-w-5xl flex-col border-border p-0">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="font-display text-sm font-bold tracking-[0.2em]">{title.toUpperCase()}</p>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="icon" onClick={() => zoom(-0.25)} aria-label="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
            <Button variant="outline" size="icon" onClick={() => zoom(0.25)} aria-label="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={reset} aria-label="Reset view">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={fullscreen} aria-label="Fullscreen">
              <Maximize2 className="h-4 w-4" />
            </Button>
            <a href={imageUrl} download target="_blank" rel="noreferrer">
              <Button size="icon" className="bg-[hsl(var(--tsg-blue))]" aria-label="Download point table">
                <Download className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
        <div
          ref={containerRef}
          className="relative flex-1 cursor-grab overflow-hidden bg-black/60 active:cursor-grabbing"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <img
            src={imageUrl}
            alt={title}
            draggable={false}
            className="absolute left-1/2 top-1/2 max-h-[80%] max-w-[90%] select-none object-contain"
            style={{ transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) scale(${scale})` }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
