"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { Check, Eraser } from "lucide-react";

export type SignatureState = { error: string | null };
type Point = { x: number; y: number };

const INK = "#111827";

/**
 * Pad de signature au doigt (Canvas 2D + Pointer Events, sans dépendance).
 * Les tracés sont gardés en mémoire pour être redessinés si l'écran pivote.
 */
export function SignatureForm({
  action,
  fields,
}: {
  action: (prev: SignatureState, formData: FormData) => Promise<SignatureState>;
  fields: Record<string, string>;
}) {
  const [state, dispatch, pending] = useActionState(action, { error: null });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = INK;
      ctx.fillStyle = INK;
      strokes.current.forEach((s) => drawStroke(ctx, s));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const point = (e: React.PointerEvent | PointerEvent): Point => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    strokes.current.push([point(e)]);
    drawStroke(e.currentTarget.getContext("2d")!, strokes.current.at(-1)!);
    setEmpty(false);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const stroke = strokes.current.at(-1)!;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const ctx = e.currentTarget.getContext("2d")!;
    for (const ev of events) {
      stroke.push(point(ev));
      drawTail(ctx, stroke);
    }
  };

  const onUp = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    strokes.current = [];
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  };

  const submit = () => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
    fd.set("signature", exportPng(strokes.current));
    startTransition(() => dispatch(fd));
  };

  return (
    <>
      <div className="relative mx-4 h-[42dvh] min-h-56 rounded-md border border-line bg-white">
        <canvas
          ref={canvasRef}
          aria-label="Zone de signature"
          className="absolute inset-0 h-full w-full touch-none select-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        {/* Ligne de signature */}
        <div className="pointer-events-none absolute inset-x-6 bottom-12 border-b border-line" />
        {empty && (
          <p className="pointer-events-none absolute inset-x-0 bottom-4 text-center text-[14px] text-muted">
            Signez avec le doigt
          </p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-lg space-y-2">
          {state.error && <p role="alert" className="text-[14px] text-late">{state.error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={clear} disabled={empty || pending}
              className="flex h-13 flex-1 items-center justify-center gap-2 rounded-md border border-line text-[15px] font-medium active:bg-canvas disabled:opacity-40">
              <Eraser size={18} strokeWidth={1.75} aria-hidden />
              Effacer
            </button>
            <button type="button" onClick={submit} disabled={empty || pending}
              className="flex h-13 flex-[2] items-center justify-center gap-2 rounded-md bg-ink text-[16px] font-medium text-white active:bg-black disabled:opacity-40">
              <Check size={20} strokeWidth={2} aria-hidden />
              {pending ? "Validation…" : "Valider la signature"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// Courbes lissées : quadratiques passant par les milieux des segments.
function drawStroke(ctx: CanvasRenderingContext2D, s: Point[]) {
  if (s.length === 1) {
    ctx.beginPath();
    ctx.arc(s[0].x, s[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(s[0].x, s[0].y);
  for (let i = 1; i < s.length - 1; i++) {
    ctx.quadraticCurveTo(s[i].x, s[i].y, (s[i].x + s[i + 1].x) / 2, (s[i].y + s[i + 1].y) / 2);
  }
  ctx.lineTo(s.at(-1)!.x, s.at(-1)!.y);
  ctx.stroke();
}

function drawTail(ctx: CanvasRenderingContext2D, s: Point[]) {
  const n = s.length;
  if (n < 3) return drawStroke(ctx, s);
  const [a, b, c] = [s[n - 3], s[n - 2], s[n - 1]];
  ctx.beginPath();
  ctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
  ctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
  ctx.stroke();
}

/** PNG recadré sur la signature, fond transparent, résolution x2. */
function exportPng(strokes: Point[][]) {
  const pts = strokes.flat();
  const pad = 8;
  const minX = Math.max(0, Math.min(...pts.map((p) => p.x)) - pad);
  const minY = Math.max(0, Math.min(...pts.map((p) => p.y)) - pad);
  const w = Math.max(...pts.map((p) => p.x)) + pad - minX;
  const h = Math.max(...pts.map((p) => p.y)) + pad - minY;

  const scale = 2;
  const out = document.createElement("canvas");
  out.width = Math.ceil(w * scale);
  out.height = Math.ceil(h * scale);
  const ctx = out.getContext("2d")!;
  ctx.setTransform(scale, 0, 0, scale, -minX * scale, -minY * scale);
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  strokes.forEach((s) => drawStroke(ctx, s));
  return out.toDataURL("image/png");
}
