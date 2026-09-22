"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn, en, fa } from "@/lib/utils";

export const MAX_PURITY = 999.9;

export type StepFn = (current: number, direction: "up" | "down") => number;

/**
 * Purity step logic:
 * - Up to 999: steps by 1 integer (e.g. 750 -> 751, 998 -> 999).
 * - Above 999: steps by 0.1 up to 999.9 (e.g. 999 -> 999.1 -> ... -> 999.9).
 * - Decrementing above 999 steps by 0.1 down to 999, then by 1 down from 999.
 */
export function purityStep(current: number, direction: "up" | "down"): number {
  if (direction === "up") {
    if (current < 999) {
      const next = Math.floor(current) + 1;
      return next > 999 ? 999 : next;
    }
    return Number(Math.min(MAX_PURITY, current + 0.1).toFixed(1));
  } else {
    if (current > 999) {
      const next = Number((current - 0.1).toFixed(1));
      return next < 999 ? 999 : next;
    }
    return Math.ceil(current) - 1;
  }
}

export interface NumberFieldProps {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number | "purity" | StepFn;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  "aria-label"?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  placeholder?: string;
  id?: string;
  title?: string;
}

/** عدد. Plus sits at the inline-start (right in RTL), display uses Persian digits. */
export function NumberField({
  value,
  defaultValue = 0,
  onChange,
  min = -Infinity,
  max: propMax,
  step = 1,
  disabled,
  readOnly,
  className,
  onKeyDown,
  placeholder = "۰",
  id,
  title,
  ...aria
}: NumberFieldProps) {
  const [internal, setInternal] = React.useState(defaultValue);
  const n = value ?? internal;
  const [typed, setTyped] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTyped(null);
  }, [value]);

  const isInteractive = !disabled && !readOnly;
  const max = step === "purity" ? Math.min(propMax ?? MAX_PURITY, MAX_PURITY) : (propMax ?? Infinity);

  function getStepDecimals(s: number): number {
    const sStr = s.toString();
    const dot = sStr.indexOf(".");
    return dot === -1 ? 0 : sStr.length - dot - 1;
  }

  function set(next: number) {
    const clamped = Math.min(max, Math.max(min, next));
    if (value === undefined) setInternal(clamped);
    onChange?.(clamped);
  }

  function stepBy(direction: "up" | "down") {
    if (!isInteractive) return;
    setTyped(null);
    let next: number;
    if (typeof step === "function") {
      next = step(n, direction);
    } else if (step === "purity") {
      next = purityStep(n, direction);
    } else {
      const stepNum = typeof step === "number" ? step : 1;
      const amount = direction === "up" ? stepNum : -stepNum;
      const decimals = Math.max(getStepDecimals(stepNum), getStepDecimals(n));
      next = Number((n + amount).toFixed(decimals));
    }
    set(next);
  }

  const btn =
    "flex w-10 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

  const displayVal = typed !== null ? typed : fa(n);

  return (
    <div
      className={cn(
        "number-field inline-flex h-10 items-stretch overflow-hidden rounded-lg border border-input bg-background/60",
        className
      )}
      role="group"
      aria-label={aria["aria-label"]}
      title={title}
    >
      <button
        type="button"
        aria-label="افزایش"
        disabled={!isInteractive || n >= max}
        onClick={() => stepBy("up")}
        className={btn}
      >
        <Plus className="size-4" />
      </button>
      <input
        id={id}
        inputMode="decimal"
        value={displayVal}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        title={title}
        onKeyDown={onKeyDown}
        onChange={(e) => {
          if (!isInteractive) return;
          const val = e.target.value;
          setTyped(val);
          const raw = en(val).replace(/[^\d.-]/g, "");
          if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
            if (min <= 0 && max >= 0) {
              set(0);
            }
            return;
          }
          const parsed = Number(raw);
          if (!Number.isNaN(parsed)) {
            set(parsed);
          }
        }}
        onBlur={() => {
          setTyped(null);
        }}
        className="w-14 border-x border-input bg-transparent text-center text-sm font-semibold outline-none"
      />
      <button
        type="button"
        aria-label="کاهش"
        disabled={!isInteractive || n <= min}
        onClick={() => stepBy("down")}
        className={btn}
      >
        <Minus className="size-4" />
      </button>
    </div>
  );
}
