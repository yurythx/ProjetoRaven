import { toast } from "sonner";

function stringifyError(err: unknown) {
  if (!err) return "";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    // Check for DRF error formats
    if (e.detail) return String(e.detail);
    if (e.error) return String(e.error);
    if (e.message) return String(e.message);
    
    // Check for field-specific errors: {"email": ["..."], "username": ["..."]}
    const keys = Object.keys(e);
    if (keys.length > 0) {
      const firstKey = keys[0];
      const val = e[firstKey];
      if (Array.isArray(val) && val.length > 0) {
        return `${firstKey}: ${val[0]}`;
      }
      if (typeof val === "string") return `${firstKey}: ${val}`;
    }
  }

  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export const notify = {
  success(title: string, description?: string) {
    toast.success(title, { description });
  },
  warning(title: string, description?: string) {
    toast.warning(title, { description });
  },
  error(title: string, error?: unknown) {
    toast.error(title, { description: stringifyError(error) });
  },
};

