import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const hashedPassword = await bcrypt.hash("password123", 12);

  // Dev accounts bypass the real registration/verification flow, so they're
  // seeded pre-verified and pre-linked to a university.
  const university = await prisma.university.upsert({
    where: { domain: "gradely.edu" },
    update: {},
    create: { domain: "gradely.edu", name: "Gradely University" },
  });

  // Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@gradely.edu" },
    update: { isVerified: true, universityId: university.id },
    create: {
      email: "admin@gradely.edu",
      name: "System Admin",
      password: hashedPassword,
      role: Role.ADMIN,
      isVerified: true,
      universityId: university.id,
    },
  });

  // Lecturer
  const lecturer = await prisma.user.upsert({
    where: { email: "dr.mensah@gradely.edu" },
    update: { isVerified: true, universityId: university.id, program: "Computer Science" },
    create: {
      email: "dr.mensah@gradely.edu",
      name: "Dr. Kwame Mensah",
      password: hashedPassword,
      role: Role.LECTURER,
      isVerified: true,
      universityId: university.id,
      program: "Computer Science",
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
        update: { isVerified: true, universityId: university.id, level: 300, program: "Computer Science" },
        create: { ...s, password: hashedPassword, role: Role.STUDENT, isVerified: true, universityId: university.id, level: 300, program: "Computer Science" },
      })
    )
  );

  // Course
  const course = await prisma.course.upsert({
    where: { code: "CS301" },
    update: { program: "Computer Science" },
    create: {
      code: "CS301",
      title: "Data Structures and Algorithms",
      description: "Fundamental data structures and algorithmic techniques.",
      semester: "2024/2025 Sem 1",
      level: 300,
      program: "Computer Science",
      lecturerId: lecturer.id,
      universityId: university.id,
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
