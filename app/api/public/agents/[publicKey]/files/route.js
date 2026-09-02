import { getPublicAgentByKey } from "@/lib/services/embed.service";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { mergeCustomization } from "@/lib/customization/defaults";
import { extractUploadedFileText } from "@/lib/services/chat-attachment.service";
import {
  buildAttachmentMessage,
  CHAT_UPLOAD_MAX_BYTES,
  formatChatUploadLimit,
} from "@/lib/utils/chat-attachments";
import { uploadChatAttachment } from "@/lib/utils/cloudinary-chat";
import { originFromRequest } from "@/lib/utils/request-origin";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";

export async function POST(request, { params }) {
  const requestId = resolveRequestId(request);

  try {
    const { publicKey } = await params;
    const limited = rateLimit(`pub-file:${publicKey}:${clientIp(request)}`, {
      limit: 10,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return jsonError(
        request,
        429,
        "Too many uploads. Try again shortly.",
        {},
        { "Retry-After": String(limited.retryAfterSec) }
      );
    }

    const agent = await getPublicAgentByKey(publicKey, {
      origin: originFromRequest(request),
    });
    if (!agent) {
      return jsonError(request, 404, "Agent not found");
    }
    if (!mergeCustomization(agent.customization).features.fileUpload) {
      return jsonError(request, 403, "File upload is disabled for this agent");
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return jsonError(request, 400, "Validation failed", {
        file: "A file is required",
      });
    }
    if (file.size > CHAT_UPLOAD_MAX_BYTES) {
      return jsonError(request, 400, "Validation failed", {
        file: `File must be ${formatChatUploadLimit()} or smaller`,
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadChatAttachment(buffer, {
      fileName: file.name,
      mimeType: file.type,
    });
    const extracted = await extractUploadedFileText({
      buffer,
      mimeType: file.type,
      fileName: file.name,
      fileUrl: uploaded.fileUrl,
      kind: uploaded.kind,
    });
    return jsonOk(
      request,
      {
        ...uploaded,
        extracted: Boolean(extracted),
        message: buildAttachmentMessage({ ...uploaded, extracted }),
      },
      201
    );
  } catch (error) {
    if (error.status) {
      return jsonError(
        request,
        error.status,
        error.message,
        error.details || {}
      );
    }
    safeLogError("POST /api/public/agents/[publicKey]/files", {
      requestId,
      route: "public-files",
      status: 500,
    });
    return jsonError(request, 500, "Unable to upload file");
  }
}
