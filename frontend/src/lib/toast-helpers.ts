import { toast } from "sonner";

export function showApiError(title: string, error: unknown) {
  const message = (() => {
    if (!error) return "";
    if (typeof error === "string") return error;
    if (error instanceof Error) return error.message;
    const maybe = error as { response?: { data?: unknown; status?: unknown } };
    if (maybe?.response?.data) {
      try {
        return JSON.stringify(maybe.response.data);
      } catch {
        return String(maybe.response.data);
      }
    }
    return String(error);
  })();
  toast.error(title, { description: message });
}

