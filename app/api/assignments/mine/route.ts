import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assignments = await prisma.practiceAssignment.findMany({
    where: {
      group: {
        enrollments: {
          some: {
            studentId: session.user.id,
          },
        },
      },
    },
    orderBy: [
      {
        dueAt: "asc",
      },
      {
        createdAt: "desc",
      },
    ],
    include: {
      group: {
        select: {
          id: true,
          name: true,
          teacherId: true,
        },
      },
      assignedByTeacher: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      recording: {
        select: {
          id: true,
          nussach: true,
          nussachCustom: true,
          status: true,
          userId: true,
          primaryPasuk: {
            select: {
              id: true,
              ref: true,
              chapterId: true,
              chapter: {
                select: {
                  id: true,
                  number: true,
                  book: {
                    select: {
                      id: true,
                      titleEn: true,
                      work: {
                        select: {
                          id: true,
                          titleEn: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    take: 200,
  });

  const visibleAssignments = assignments.filter((assignment) => {
    if (assignment.recording.status === "APPROVED") {
      return true;
    }

    return assignment.recording.userId === assignment.group.teacherId;
  });

  const responseAssignments = visibleAssignments.map((assignment) => ({
    id: assignment.id,
    dueAt: assignment.dueAt ? assignment.dueAt.toISOString() : null,
    instructions: assignment.instructions,
    createdAt: assignment.createdAt.toISOString(),
    group: assignment.group,
    assignedByTeacher: assignment.assignedByTeacher,
    recording: {
      id: assignment.recording.id,
      nussach: assignment.recording.nussach,
      nussachCustom: assignment.recording.nussachCustom,
      primaryPasuk: {
        id: assignment.recording.primaryPasuk.id,
        ref: assignment.recording.primaryPasuk.ref,
        chapterId: assignment.recording.primaryPasuk.chapterId,
        chapterNumber: assignment.recording.primaryPasuk.chapter.number,
        bookId: assignment.recording.primaryPasuk.chapter.book.id,
        bookTitleEn: assignment.recording.primaryPasuk.chapter.book.titleEn,
        workId: assignment.recording.primaryPasuk.chapter.book.work.id,
        workTitleEn: assignment.recording.primaryPasuk.chapter.book.work.titleEn,
      },
    },
  }));

  return Response.json({ assignments: responseAssignments });
}
