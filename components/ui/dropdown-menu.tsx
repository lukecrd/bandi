"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const DropdownMenu = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { open?: boolean; onOpenChange?: (open: boolean) => void }
>(({ className, children, open, onOpenChange, ...props }, ref) => {
  const [isOpen, setIsOpen] = React.useState(open ?? false);
  const contextValue = React.useMemo(() => ({ open: isOpen, setOpen: setIsOpen }), [isOpen]);

  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  if (!isOpen) return null;

  return (
    <div ref={ref} className={cn("", className)} {...props}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === DropdownMenuTrigger) {
            return React.cloneElement(child as React.ReactElement<any>, {
              setOpen: setIsOpen,
            });
          }
          if (child.type === DropdownMenuContent) {
            return React.cloneElement(child as React.ReactElement<any>, {
              onClose: () => setIsOpen(false),
            });
          }
        }
        return child;
      })}
    </div>
  );
});
DropdownMenu.displayName = "DropdownMenu";

const DropdownMenuTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean; setOpen?: (open: boolean) => void }
>(({ className, children, asChild, setOpen, onClick, ...props }, ref) => {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(e);
    setOpen?.(true);
  };
  return (
    <div ref={ref} className={cn("cursor-pointer", className)} onClick={handleClick} {...props}>
      {children}
    </div>
  );
});
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { align?: "start" | "center" | "end"; onClose?: () => void }
>(({ className, children, align = "end", onClose, ...props }, ref) => {
  const alignment = align === "end" ? "right-0" : align === "start" ? "left-0" : "left-1/2 -translate-x-1/2";
  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 text-gray-900 shadow-md dark:border-gray-700 dark:bg-gray-950 dark:text-gray-50",
        alignment,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { onSelect?: () => void }
>(({ className, children, onSelect, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:focus:bg-gray-800 dark:focus:text-gray-50",
        className
      )}
      onClick={() => onSelect?.()}
      {...props}
    >
      {children}
    </div>
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
