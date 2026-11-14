"use client";
import { useEffect, useRef } from "react";
import { X, ArrowUpRight, FileText } from "lucide-react";
import type { Citation } from "@/types";
export function Drawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="drawer"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-inner">
        <header>
          <span className="eyebrow">FINN / EVIDENCE DESK</span>
          <button
            className="icon-button"
            aria-label="Close panel"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <h2>{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
export function Source({
  citation,
  onClick,
}: {
  citation: Citation;
  onClick?: (c: Citation) => void;
}) {
  return (
    <button
      className="source-button"
      onClick={() =>
        onClick
          ? onClick(citation)
          : window.open(
              citation.url + (citation.page ? `#page=${citation.page}` : ""),
              "_blank",
              "noopener,noreferrer",
            )
      }
    >
      <FileText size={14} />
      <span>
        {citation.title}
        {citation.page ? ` · p. ${citation.page}` : " · document level"}
      </span>
      <ArrowUpRight size={14} />
    </button>
  );
}
export function Sparkline({
  values,
  positive = true,
}: {
  values: number[];
  positive?: boolean;
}) {
  if (values.length < 2) return <span className="muted">—</span>;
  const lo = Math.min(...values),
    hi = Math.max(...values),
    points = values
      .map(
        (v, i) =>
          `${(i / (values.length - 1)) * 100},${27 - ((v - lo) / (hi - lo || 1)) * 23}`,
      )
      .join(" ");
  return (
    <svg
      className={positive ? "spark positive" : "spark negative"}
      viewBox="0 0 100 32"
      role="img"
      aria-label="Recent closing-price trend"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
export const formatDate = (date: string, short = false) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    ...(!short ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(date));
export const number = (value: number | null | undefined, digits = 0) =>
  value == null
    ? "—"
    : value.toLocaleString("en-IN", { maximumFractionDigits: digits });
export const pct = (value: number | null | undefined) =>
  value == null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
