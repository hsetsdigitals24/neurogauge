import { toast } from "sonner";

/**
 * App-wide notification helper. All in-app errors, warnings, and success messages
 * should go through this so styling and behaviour stay consistent. Backed by sonner
 * (mounted via <AppToaster> in the root layout).
 */
export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  warning: (message: string) => toast.warning(message),
  info: (message: string) => toast.message(message),
};

export { toast };
