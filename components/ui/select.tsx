import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
  contentRef: React.RefObject<HTMLDivElement | null>;
  registerItem: (value: string, label: React.ReactNode) => void;
  unregisterItem: (value: string) => void;
  items: Record<string, React.ReactNode>;
}

const SelectContext = React.createContext<SelectContextType | null>(null);

function useSelectContext() {
  const ctx = React.useContext(SelectContext);
  if (!ctx) throw new Error("Select components must be used within Select");
  return ctx;
}

interface SelectProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ className, children, value, onValueChange, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const triggerRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const itemsRef = React.useRef<Record<string, React.ReactNode>>({});
    const [items, setItems] = React.useState<Record<string, React.ReactNode>>({});

    const registerItem = React.useCallback((val: string, label: React.ReactNode) => {
      itemsRef.current[val] = label;
      setItems({ ...itemsRef.current });
    }, []);

    const unregisterItem = React.useCallback((val: string) => {
      delete itemsRef.current[val];
      setItems({ ...itemsRef.current });
    }, []);

    React.useEffect(() => {
      function handleClickOutside(e: MouseEvent) {
        if (
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node) &&
          !contentRef.current?.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      }
      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
      }
    }, [isOpen]);

    return (
      <SelectContext.Provider
        value={{
          value: value ?? "",
          onValueChange: onValueChange ?? (() => {}),
          isOpen,
          setIsOpen,
          triggerRef,
          contentRef,
          registerItem,
          unregisterItem,
          items,
        }}
      >
        <div ref={ref} className={cn("relative inline-block", className)} {...props}>
          {children}
        </div>
      </SelectContext.Provider>
    );
  }
);
Select.displayName = "Select";

const SelectTrigger = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: string }
>(({ className, children, ...props }, ref) => {
  const { isOpen, setIsOpen, triggerRef } = useSelectContext();

  const setRef = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (typeof ref === "function") {
        ref(node);
      } else if (ref) {
        ref.current = node;
      }
      triggerRef.current = node;
    },
    [ref, triggerRef]
  );

  return (
    <div
      ref={setRef}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-white cursor-pointer",
        className
      )}
      onClick={() => setIsOpen(!isOpen)}
      {...props}
    >
      {children}
    </div>
  );
});
SelectTrigger.displayName = "SelectTrigger";

const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }
>(({ className, children, placeholder, ...props }, ref) => {
  const { value, items } = useSelectContext();
  const selectedLabel = value ? items[value] : undefined;

  return (
    <span
      ref={ref}
      className={cn(
        "text-sm text-gray-900 dark:text-gray-50",
        !selectedLabel && !children && placeholder && "text-gray-400",
        className
      )}
      {...props}
    >
      {selectedLabel || children || placeholder}
    </span>
  );
});
SelectValue.displayName = "SelectValue";

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { isOpen, contentRef } = useSelectContext();
  if (!isOpen) return null;
  const setRef = (node: HTMLDivElement | null) => {
    contentRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  };
  return (
    <div
      ref={setRef}
      className={cn(
        "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border border-gray-200 bg-white p-1 shadow-md dark:border-gray-700 dark:bg-gray-950",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
SelectContent.displayName = "SelectContent";

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, children, ...props }, ref) => {
  const { value, onValueChange, setIsOpen, registerItem, unregisterItem } = useSelectContext();

  React.useEffect(() => {
    registerItem(props.value as string, children);
    return () => unregisterItem(props.value as string);
  }, [props.value as string, children, registerItem, unregisterItem]);

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-gray-100 focus:text-gray-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:focus:bg-gray-800 dark:focus:text-gray-50",
        value === (props as { value: string }).value ? "bg-gray-100 dark:bg-gray-800" : "",
        className
      )}
      onClick={() => {
        onValueChange((props as { value: string }).value);
        setIsOpen(false);
      }}
      {...props}
    >
      {children}
    </div>
  );
});
SelectItem.displayName = "SelectItem";

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
