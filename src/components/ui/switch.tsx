"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, checked, onChange, disabled, ...props }, ref) => {
    return (
      <label
        className={cn(
          "inline-flex items-center gap-2 cursor-pointer",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <div className="relative">
          <input
            type="checkbox"
            className="sr-only peer"
            ref={ref}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            {...props}
          />
          <div
            className={cn(
              "w-11 h-6 bg-zinc-200 rounded-full peer peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-focus-visible:ring-offset-2 transition-colors dark:bg-zinc-700",
              className
            )}
          />
          <div className="absolute left-[2px] top-[2px] bg-white w-5 h-5 rounded-full transition-transform peer-checked:translate-x-5 shadow" />
        </div>
        {label && (
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            {label}
          </span>
        )}
      </label>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
