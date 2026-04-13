import { Role } from "@/generated/prisma";

declare module "next-auth" {
  interface User {
    id: string;
    role: Role;
    departmentId: string;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      departmentId: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    departmentId: string;
  }
}
