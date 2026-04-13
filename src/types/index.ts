export type {
  Role,
  ShiftType,
  LeaveStatus,
  ApprovalAction,
  RecordStatus,
  FlexType,
  FlexMonthStatus,
} from "@/generated/prisma";

import type { Role } from "@/generated/prisma";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  departmentId: string;
}
