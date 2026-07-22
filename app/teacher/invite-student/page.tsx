import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isTeacher } from "@/lib/auth/roles";

import { TeacherNav } from "../teacher-nav";
import { InviteStudentForm } from "./invite-student-form";

export default async function InviteStudentPage() {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  if (!session?.user) {
    redirect("/signin?callbackUrl=/teacher/invite-student");
  }

  if (!isTeacher(role)) {
    redirect("/teacher");
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 md:px-12">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ink-soft)]">Teacher Mode</p>
      <h1 className="mt-2 text-3xl font-bold text-[var(--foreground)]">Invite Student</h1>
      <p className="mt-2 text-sm text-orange-900/80">Send a direct 1-on-1 invite link to a student by email.</p>
      <div className="mt-4">
        <TeacherNav current="invite" />
      </div>
      <InviteStudentForm />
    </main>
  );
}
