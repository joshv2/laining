import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Role } from "@prisma/client";
import localFont from "next/font/local";
import { Geist_Mono, Noto_Serif_Hebrew, Rubik } from "next/font/google";

import { SignOutButton } from "@/app/signout-button";
import { auth } from "@/lib/auth";
import { isModeratorOrAbove, isSuperuser, isTeacher } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/client";
import { countUnreadSuperuserNotifications } from "@/lib/services/notifications";

import "./globals.css";

const rubik = Rubik({
  variable: "--font-geist-sans",
  subsets: ["latin", "hebrew"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerifHebrew = Noto_Serif_Hebrew({
  variable: "--font-hebrew",
  subsets: ["hebrew", "latin"],
  weight: ["400", "600", "700"],
});

const shlomoStam = localFont({
  src: "../ShlomoStam.woff2",
  variable: "--font-hebrew-pasuk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Laining Collaborative",
  description: "A collaborative platform for learning and sharing Torah, Neviim, and Ketuvim chanting recordings.",
};

function initialsForUser(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name?.trim() || email?.trim() || "U").toUpperCase();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "U";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2);
  }

  return `${words[0][0]}${words[1][0]}`;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const role = (session?.user?.role ?? Role.USER) as Role;

  const assignmentCount = session?.user
    ? await prisma.practiceAssignment.count({
        where: {
          group: {
            enrollments: {
              some: {
                studentId: session.user.id,
              },
            },
          },
        },
      })
    : 0;

  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
  const unreadSuperuserNotifications =
    session?.user && isSuperuser(role) ? await countUnreadSuperuserNotifications() : 0;

  return (
    <html
      lang="en"
      className={`${rubik.variable} ${geistMono.variable} ${notoSerifHebrew.variable} ${shlomoStam.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {gaMeasurementId ? (
          <>
            <Script async src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${gaMeasurementId}');`}
            </Script>
          </>
        ) : null}

        <header className="sticky top-0 z-50 border-b border-orange-900/15 bg-white/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3 md:px-12">
            <div className="flex items-center gap-3">
              <Link className="text-sm font-bold uppercase tracking-[0.14em] text-orange-950" href="/">
                Laining Collaborative
              </Link>
              <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-orange-900 md:text-sm">
                <Link className="rounded-full border border-orange-900/20 px-3 py-1.5 hover:bg-orange-100" href="/learn">
                  Learn
                </Link>
                <Link className="rounded-full border border-orange-900/20 px-3 py-1.5 hover:bg-orange-100" href="/submit">
                  Submit
                </Link>
                {isTeacher(role) ? (
                  <Link className="rounded-full border border-orange-900/20 px-3 py-1.5 hover:bg-orange-100" href="/teacher">
                    Teacher
                  </Link>
                ) : null}
                {isModeratorOrAbove(role) ? (
                  <Link className="rounded-full border border-orange-900/20 px-3 py-1.5 hover:bg-orange-100" href="/moderation">
                    Moderation
                  </Link>
                ) : null}
                <Link className="rounded-full border border-orange-900/20 px-3 py-1.5 hover:bg-orange-100" href="/contact">
                  Contact
                </Link>
                {isSuperuser(role) ? (
                  <Link className="rounded-full border border-orange-900/20 px-3 py-1.5 hover:bg-orange-100" href="/superuser/notifications">
                    Superuser Inbox {unreadSuperuserNotifications > 0 ? `(${unreadSuperuserNotifications})` : ""}
                  </Link>
                ) : null}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {session?.user ? (
                <>
                  <div className="flex h-8 items-center gap-2 rounded-full border border-orange-900/20 bg-white px-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-200 text-[10px] font-bold text-orange-900">
                      {initialsForUser(session.user.name, session.user.email)}
                    </span>
                    <span className="max-w-40 truncate text-xs font-semibold leading-none text-orange-950">
                      {session.user.name ?? session.user.email ?? "User"}
                    </span>
                  </div>

                  <Link className="rounded-full border border-orange-900/20 px-3 py-1.5 text-xs font-semibold hover:bg-orange-100 md:text-sm" href="/learn">
                    Assignments {assignmentCount > 0 ? `(${assignmentCount})` : ""}
                  </Link>

                  <SignOutButton />
                </>
              ) : (
                <Link className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]" href="/signin">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="site-footer border-t border-orange-900/15">
          <div className="mx-auto w-full max-w-6xl px-6 py-6 text-xs text-orange-950/85 md:px-12">
            <p>Copyright {new Date().getFullYear()} Laining Collaborative.</p>
            <p>Website code is licensed under MIT. Uploaded recordings remain property of the site.</p>
            <p className="mt-1">
              <Link className="underline decoration-orange-900/40 underline-offset-2 hover:decoration-orange-900" href="/terms">
                Terms of Use
              </Link>
            </p>
            <p className="mt-1">
              <Link className="underline decoration-orange-900/40 underline-offset-2 hover:decoration-orange-900" href="/contact">
                Contact
              </Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
