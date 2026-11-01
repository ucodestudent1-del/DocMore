import { Toaster as SonnerToaster, toast as sonnerToast } from "sonner";

export { SonnerToaster as Toaster };

type ToastProps = {
  title?: string;
  description?: string;
  action?: React.ReactNode;
};

export function toast({ title, description, action }: ToastProps) {
  return sonnerToast(title, {
    description,
    action,
    className: "z-50",
  });
}
