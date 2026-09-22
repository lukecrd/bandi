"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./select";
import { Button } from "./button";

interface SheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const SheetContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

export const Sheet = ({ open, onOpenChange, children }: SheetProps) => {
  const [isOpen, setIsOpen] = React.useState(open ?? false);

  const contextValue = React.useMemo(
    () => ({ open: isOpen, setOpen: setIsOpen }),
    [isOpen]
  );

  React.useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <SheetContext.Provider value={contextValue}>
      <div className="fixed inset-0 z-50" onClick={() => setIsOpen(false)}>
        <div className="fixed inset-0 bg-black/60" />
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
      </div>
    </SheetContext.Provider>
  );
};

export const SheetContent = ({
  side = "left",
  children,
  className,
}: {
  side?: "left" | "right";
  children: React.ReactNode;
  className?: string;
}) => {
  const { setOpen } = React.useContext(SheetContext);
  const position =
    side === "left" ? "left-0 top-0 h-full w-64" : "right-0 top-0 h-full w-64";

  return (
    <div
      className={cn(
        "fixed z-50 bg-white shadow-lg dark:bg-gray-950",
        position,
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-end p-4">
        <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
          ✕
        </Button>
      </div>
      {children}
    </div>
  );
};

export const SheetTrigger = ({
  children,
  className,
  ...props
}: {
  children: React.ReactNode;
  className?: string;
  [key: string]: any;
}) => {
  const { setOpen } = React.useContext(SheetContext);
  return (
    <div className={cn("cursor-pointer", className)} onClick={() => setOpen(true)} {...props}>
      {children}
    </div>
  );
};
