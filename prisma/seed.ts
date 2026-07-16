import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const hashedPassword = await bcrypt.hash("password123", 12);

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@gradely.edu" },
    update: {},
    create: {
      email: "admin@gradely.edu",
      name: "System Admin",
      password: hashedPassword,
      role: Role.ADMIN,
    },
  });

  // Lecturer
  const lecturer = await prisma.user.upsert({
    where: { email: "dr.mensah@gradely.edu" },
    update: {},
    create: {
      email: "dr.mensah@gradely.edu",
      name: "Dr. Kwame Mensah",
      password: hashedPassword,
      role: Role.LECTURER,
    },
  });

  // Students
  const students = await Promise.all(
    [
      { email: "alice@student.gradely.edu", name: "Alice Boateng" },
      { email: "bob@student.gradely.edu", name: "Bob Asante" },
      { email: "carol@student.gradely.edu", name: "Carol Osei" },
    ].map((s) =>
      prisma.user.upsert({
        where: { email: s.email },
        update: {},
        create: { ...s, password: hashedPassword, role: Role.STUDENT },
      })
    )
  );

  // Course
  const course = await prisma.course.upsert({
    where: { code: "CS301" },
    update: {},
    create: {
      code: "CS301",
      title: "Data Structures and Algorithms",
      description: "Fundamental data structures and algorithmic techniques.",
      semester: "2024/2025 Sem 1",
      lecturerId: lecturer.id,
    },
  });

  // Enroll all students
  for (const student of students) {
    await prisma.enrollment.upsert({
      where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
      update: {},
      create: { studentId: student.id, courseId: course.id },
    });
  }

  console.log("Seed complete.");
  console.log("─────────────────────────────────────");
  console.log("Admin     → admin@gradely.edu");
  console.log("Lecturer  → dr.mensah@gradely.edu");
  console.log("Students  → alice / bob / carol @student.gradely.edu");
  console.log("Password  → password123 (all accounts)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
