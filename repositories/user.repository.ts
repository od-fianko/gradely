import { prisma } from "@/lib/db/prisma";
import type { Role } from "@prisma/client";

export const userRepository = {
  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, image: true, isActive: true },
    });
  },

  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  findAll(role?: Role) {
    return prisma.user.findMany({
      where: role ? { role } : undefined,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  },

  create(data: { email: string; name: string; password: string; role: Role }) {
    return prisma.user.create({ data });
  },

  update(id: string, data: Partial<{ name: string; image: string; isActive: boolean }>) {
    return prisma.user.update({ where: { id }, data });
  },

  deactivate(id: string) {
    return prisma.user.update({ where: { id }, data: { isActive: false } });
  },
};
