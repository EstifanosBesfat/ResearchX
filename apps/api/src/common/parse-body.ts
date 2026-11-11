import { BadRequestException } from "@nestjs/common";

interface ParseSuccess<T> {
  success: true;
  data: T;
}

interface ParseFailure {
  success: false;
  error: { issues: Array<{ message: string }> };
}

export function parseBody<T>(schema: { safeParse: (value: unknown) => ParseSuccess<T> | ParseFailure }, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
}
