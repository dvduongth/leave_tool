import prisma from "@/lib/prisma";

export type AuditAction =
  | "REPORT_VIEW"
  | "REPORT_EXPORT"
  | "PASSWORD_CHANGE"
  | "PROFILE_UPDATE"
  | "SHIFT_CHANGE_APPROVE"
  | "SHIFT_CHANGE_REJECT"
  | "CHILD_DECLARE_APPROVE"
  | "CHILD_DECLARE_REJECT"
  | "MATERNITY_LEAVE_APPROVE"
  | "MATERNITY_LEAVE_REJECT";

export async function logAudit(params: {
  userId: string | null;
  action: AuditAction;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        metadata: params.metadata as never,
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}

export function getRequestIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}
