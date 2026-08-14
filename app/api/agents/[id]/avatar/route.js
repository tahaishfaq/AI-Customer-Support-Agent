import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getAgentForUser } from "@/lib/services/agent.service";
import { uploadImageBuffer } from "@/lib/utils/cloudinary-image";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    await getAgentForUser(id, authResult.user.id);

    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            details: { file: "Image file is required" },
          },
        },
        { status: 400 }
      );
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            details: { file: "Image must be 2MB or smaller" },
          },
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadImageBuffer(buffer, {
      fileName: file.name,
      mimeType: file.type,
    });

    return NextResponse.json(
      { avatarUrl: uploaded.fileUrl, publicId: uploaded.publicId },
      { status: 201 }
    );
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    if (error.status === 400 || error.status === 502) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            details: error.details || {},
          },
        },
        { status: error.status }
      );
    }
    console.error("POST /api/agents/[id]/avatar", error);
    return NextResponse.json(
      { error: { message: "Unable to upload avatar", details: {} } },
      { status: 500 }
    );
  }
}
