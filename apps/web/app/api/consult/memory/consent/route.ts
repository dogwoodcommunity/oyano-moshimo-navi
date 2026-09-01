import { NextResponse, type NextRequest } from "next/server";
import {
  CONSULT_MEMORY_NOT_READY_MESSAGE,
  ConsultMemoryAccessError,
  ConsultMemoryConsentConflictError,
  ConsultMemoryConsentRequiredError,
  ConsultMemoryNotReadyError,
  authorizeConsultPerson,
  canEditSharedConsultMemory,
  canManageSharedConsultMemory,
  isConsultMemorySchemaMissing,
  readConsultMemoryConsent,
  setConsultMemoryConsent
} from "@/lib/consultMemory";

export const dynamic = "force-dynamic";

function jsonError(error: string, message: string, status: number) {
  return NextResponse.json({ error, message }, { status });
}

function handleError(error: unknown) {
  if (error instanceof ConsultMemoryAccessError) return jsonError(error.code, error.message, error.status);
  if (error instanceof ConsultMemoryConsentConflictError) return jsonError(error.code, error.message, error.status);
  if (error instanceof ConsultMemoryConsentRequiredError) return jsonError(error.code, error.message, error.status);
  if (error instanceof ConsultMemoryNotReadyError || isConsultMemorySchemaMissing(error)) {
    return jsonError("memory_not_ready", CONSULT_MEMORY_NOT_READY_MESSAGE, 503);
  }
  console.error("[consult-memory-consent] request failed", error);
  return jsonError("consent_failed", "長期記憶の同意状態を確認できませんでした。時間をおいてお試しください。", 500);
}

function identifierFromUrl(request: NextRequest) {
  return {
    personId: request.nextUrl.searchParams.get("personId") ?? undefined,
    localCaseId: request.nextUrl.searchParams.get("localCaseId") ?? undefined,
    familyId: request.nextUrl.searchParams.get("familyId") ?? undefined
  };
}

export async function GET(request: NextRequest) {
  try {
    const authorized = await authorizeConsultPerson(request, identifierFromUrl(request));
    const consent = await readConsultMemoryConsent(authorized);
    return NextResponse.json({
      personId: authorized.personId,
      consent,
      canEditSharedMemory: canEditSharedConsultMemory(authorized),
      canManageSharedMemory: canManageSharedConsultMemory(authorized)
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return jsonError("invalid_request", "同意内容を読み取れませんでした。", 400);
    const action = body.action === "accept" || body.action === "revoke" ? body.action : null;
    if (!action) return jsonError("invalid_request", "同意するか取り消すかを指定してください。", 400);
    const expectedRevision = typeof body.revision === "number"
      && Number.isInteger(body.revision)
      && body.revision >= 0
      ? body.revision
      : null;
    if (expectedRevision === null) {
      return jsonError("invalid_request", "最新の同意状態を読み直してからお試しください。", 400);
    }
    const authorized = await authorizeConsultPerson(request, {
      personId: typeof body.personId === "string" ? body.personId : undefined,
      localCaseId: typeof body.localCaseId === "string" ? body.localCaseId : undefined,
      familyId: typeof body.familyId === "string" ? body.familyId : undefined
    });
    const acceptedVia = body.acceptedVia === "web" || body.acceptedVia === "mobile"
      ? body.acceptedVia
      : "unknown";
    const consent = await setConsultMemoryConsent(
      authorized,
      action,
      typeof body.version === "string" ? body.version : "",
      acceptedVia,
      expectedRevision
    );
    return NextResponse.json({
      personId: authorized.personId,
      consent,
      canEditSharedMemory: canEditSharedConsultMemory(authorized),
      canManageSharedMemory: canManageSharedConsultMemory(authorized)
    });
  } catch (error) {
    return handleError(error);
  }
}
