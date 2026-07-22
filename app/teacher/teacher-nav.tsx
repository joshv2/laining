import Link from "next/link";

type TeacherNavProps = {
  current:
    | "dashboard"
    | "invite"
    | "create-assignment"
    | "students"
    | "student-detail"
    | "classes"
    | "class-detail";
};

type NavSection = "dashboard" | "students" | "classes";

function sectionForCurrent(current: TeacherNavProps["current"]): NavSection {
  if (current === "students" || current === "student-detail") {
    return "students";
  }

  if (current === "classes" || current === "class-detail") {
    return "classes";
  }

  return "dashboard";
}

function itemClass(section: NavSection, activeSection: NavSection): string {
  const base = "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold";
  const active = section === activeSection;

  if (section === "dashboard") {
    return active
      ? `${base} bg-zinc-900 text-white`
      : `${base} border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100`;
  }

  if (section === "students") {
    return active
      ? `${base} bg-emerald-700 text-white`
      : `${base} border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100`;
  }

  return active
    ? `${base} bg-sky-700 text-white`
    : `${base} border border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100`;
}

export function TeacherNav({ current }: TeacherNavProps) {
  const activeSection = sectionForCurrent(current);

  return (
    <nav className="mb-4 flex flex-wrap gap-2" aria-label="Teacher navigation">
      <Link className={itemClass("dashboard", activeSection)} href="/teacher">
        <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <path d="M3 13h8V3H3v10Zm10 8h8V11h-8v10ZM3 21h8v-6H3v6Zm10-18v6h8V3h-8Z" fill="currentColor" />
        </svg>
        Dashboard
      </Link>
      <Link className={itemClass("students", activeSection)} href="/teacher/students">
        <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <path d="M16 11a4 4 0 1 0-3.999-4A4 4 0 0 0 16 11ZM8 13a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 2c-3.314 0-6 1.567-6 3.5V21h12v-2.5c0-1.933-2.686-3.5-6-3.5ZM8 15c-2.67 0-5 1.17-5 2.8V21h5v-2.5c0-1.3.72-2.45 1.96-3.3A6.7 6.7 0 0 0 8 15Z" fill="currentColor" />
        </svg>
        Students
      </Link>
      <Link className={itemClass("classes", activeSection)} href="/teacher/classes">
        <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <path d="M4 4h16v4H4V4Zm0 6h16v10H4V10Zm3 2v6h3v-6H7Zm5 0v6h3v-6h-3Z" fill="currentColor" />
        </svg>
        Classes
      </Link>
    </nav>
  );
}
