import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "STUDENT") return forbidden("Only students can upload files");

    const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
    if (!BLOB_TOKEN) return serverError("File uploads not configured. Set BLOB_READ_WRITE_TOKEN in .env.local");

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return badRequest("No file provided");

    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) return badRequest(`File must be under ${MAX_MB} MB`);

    const { put } = await import("@vercel/blob");
    const blob = await put(`submissions/${session.user.id}/${Date.now()}-${file.name}`, file, {
      access: "public",
      token:  BLOB_TOKEN,
    });

    return ok({
      url:          blob.url,
      fileName:     blob.pathname.split("/").pop(),
      originalName: file.name,
      fileType:     file.type,
      fileSizeBytes: file.size,
    });
  } catch (e) { return handleApiError(e); }
}
