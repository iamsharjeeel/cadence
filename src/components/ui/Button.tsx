"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { buttonStyles, type ButtonVariant, type ButtonSize } from "./buttonStyles";

export interface ButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    | "onDrag"
    | "onDragStart"
    | "onDragEnd"
    | "onDragEnter"
    | "onDragLeave"
    | "onDragOver"
    | "onDrop"
    | "onAnimationStart"
    | "onAnimationEnd"
    | "onAnimationIteration"
  > {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const MotionButton = motion.button;

function Spinner() {
  return (
    <svg
      className="h-4 w-4 shrink-0 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.37 0 0 5.37 0 12h4z"
      />
    </svg>
  );
}

export { buttonStyles } from "./buttonStyles";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      type,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <MotionButton
        ref={ref}
        type={type ?? "button"}
        disabled={disabled || loading}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.08 }}
        className={buttonStyles(variant, size, className)}
        {...props}
      >
        {loading && <Spinner />}
        {children}
      </MotionButton>
    );
  },
);
Button.displayName = "Button";
