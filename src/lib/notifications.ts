import prisma from "@/lib/prisma";

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      link,
    },
  });
}
