import { NextResponse } from "next/server";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, string[]>,
  ref?: string
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        ...(ref ? { ref } : {}),
      },
    },
    { status }
  );
}
