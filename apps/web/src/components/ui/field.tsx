"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> &
    VariantProps<typeof labelVariants>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(labelVariants(), className)}
    {...props}
  />
))
Label.displayName = LabelPrimitive.Root.displayName

const labelVariants = cva(
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
)

const Field = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("space-y-2", className)}
    {...props}
  />
))
Field.displayName = "Field"

const FieldLabel = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
))
FieldLabel.displayName = "FieldLabel"

interface FieldErrorProps extends React.HTMLAttributes<HTMLParagraphElement> {
  errors?: (any)[];
}

const FieldError = React.forwardRef<
  HTMLParagraphElement,
  FieldErrorProps
>(({ className, errors, children, ...props }, ref) => {
  const errorMessages = errors
    ?.map((error) => {
      if (!error) return null;
      if (typeof error === 'string') return error;
      if (typeof error === 'object' && 'message' in error) {
        return error.message;
      }
      return null;
    })
    .filter(Boolean);
  
  const content = errorMessages?.join(' ') || children;
  return (
    <p
      ref={ref}
      className={cn("text-sm text-destructive", className)}
      {...props}
    >
      {content}
    </p>
  );
})
FieldError.displayName = "FieldError"

const FieldGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("space-y-2", className)}
    {...props}
  />
))
FieldGroup.displayName = "FieldGroup"

export { Label, Field, FieldLabel, FieldError, FieldGroup }