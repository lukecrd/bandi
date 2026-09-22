import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "outline" | "destructive";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        variant === "default" && "border-transparent bg-blue-600 text-white hover:bg-blue-700",
        variant === "secondary" && "border-transparent bg-gray-100 text-gray-800 hover:bg-gray-200",
        variant === "outline" && "border-gray-300 bg-white text-gray-700",
        variant === "destructive" && "border-transparent bg-red-600 text-white hover:bg-red-700",
        className
      )}
    >
      {children}
    </span>
  );
}
