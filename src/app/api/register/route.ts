import { toErrorResponse, ValidationError } from "@/lib/api/errors";
import { registerSchema } from "@/features/auth/schema";
import { registerUser } from "@/features/auth/register";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    const { userId } = await registerUser(parsed.data);
    return Response.json({ userId }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
