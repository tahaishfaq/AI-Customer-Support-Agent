import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getAgentForUser } from "@/lib/services/agent.service";
import { mergeCustomization } from "@/lib/customization/defaults";
import { extractUploadedFileText } from "@/lib/services/chat-attachment.service";
import { buildAttachmentMessage } from "@/lib/utils/chat-attachments";
import { uploadChatAttachment } from "@/lib/utils/cloudinary-chat";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const agent = await getAgentForUser(id, authResult.user.id);
    if (!mergeCustomization(agent.customization).features.fileUpload) {
      return NextResponse.json(
        { error: { message: "File upload is disabled for this agent", details: {} } },
        { status: 403 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            details: { file: "A file is required" },
          },
        },
        { status: 400 }
      );
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
    return NextResponse.json(
      {
        ...uploaded,
        extracted: Boolean(extracted),
        message: buildAttachmentMessage({ ...uploaded, extracted }),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.status) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/agents/[id]/files", error);
    return NextResponse.json(
      { error: { message: "Unable to upload file", details: {} } },
      { status: 500 }
    );
  }
}
