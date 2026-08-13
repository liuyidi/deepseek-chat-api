export class AuthSdkError extends Error {
  status?: number;
  payload?: unknown;

  constructor(message: string, options?: { status?: number; payload?: unknown }) {
    super(message);
    this.name = "AuthSdkError";
    this.status = options?.status;
    this.payload = options?.payload;
  }
}

type FastApiErrorBody = {
  detail?: string | { msg?: string }[];
};

export function normalizeAuthError(error: unknown, fallback: string): Error {
  if (error instanceof AuthSdkError) {
    return error;
  }

  if (error instanceof Error) {
    return new Error(error.message || fallback);
  }

  return new Error(fallback);
}

export function readFastApiError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: FastApiErrorBody; status?: number } }).response;
    const detail = response?.data?.detail;

    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }

    if (Array.isArray(detail) && detail.length > 0 && detail[0]?.msg) {
      return detail[0].msg as string;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

