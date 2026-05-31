export type DataProvider = "mock" | "supabase";

export interface ApiError {
  code: string;
  message: string;
}

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
      source: DataProvider;
      generatedAt: string;
    }
  | {
      ok: false;
      error: ApiError;
      source: DataProvider;
      generatedAt: string;
    };
