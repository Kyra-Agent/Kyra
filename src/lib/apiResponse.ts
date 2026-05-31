import type { ApiError, ApiResponse, DataProvider } from "../types/api";

export function createApiSuccess<T>(data: T, source: DataProvider): ApiResponse<T> {
  return {
    ok: true,
    data,
    source,
    generatedAt: new Date().toISOString(),
  };
}

export function createApiError(error: ApiError, source: DataProvider): ApiResponse<never> {
  return {
    ok: false,
    error,
    source,
    generatedAt: new Date().toISOString(),
  };
}

export function unwrapApiResponse<T>(response: ApiResponse<T>): T {
  if (response.ok) {
    return response.data;
  }

  throw new Error(`${response.error.code}: ${response.error.message}`);
}
