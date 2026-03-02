import { clsx } from "clsx";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}

const variants = {
  default: "bg-gray-100 text-gray-600",
  success: "bg-green-50 text-green-700",
  warning: "bg-orange-50 text-orange-700",
  error: "bg-red-50 text-red-700",
  info: "bg-primary-50 text-primary-700",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={clsx(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
      variants[variant],
      className,
    )}>
      {children}
    </span>
  );
}
