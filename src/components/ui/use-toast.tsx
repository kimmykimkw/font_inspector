// Adapted from shadcn/ui toast component
import { toast as sonnerToast } from "sonner";

const TOAST_LIMIT = 5;
type ToasterToast = {
  id: string;
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
};

const toastVariants = {
  default: {
    className: "bg-background border",
  },
  destructive: {
    className: "bg-destructive text-destructive-foreground border-0",
  },
};

const actionHandler = (toast: ToasterToast) => {
  const { variant = "default" } = toast;
  const variantStyles = toastVariants[variant as keyof typeof toastVariants].className;
  return sonnerToast(toast.title, {
    id: toast.id,
    description: toast.description,
    className: variantStyles,
  });
};

export function useToast() {
  return {
    toast: ({ variant, title, description }: Omit<ToasterToast, "id">) => {
      actionHandler({
        id: crypto.randomUUID(),
        title,
        description,
        variant,
      });
    },
    dismiss: (toastId?: string) => {
      sonnerToast.dismiss(toastId);
    },
  };
} 