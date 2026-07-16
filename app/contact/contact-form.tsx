"use client";

import { FormEvent, useState } from "react";

type ContactErrorResponse = {
  error?: string;
  details?: {
    fieldErrors?: Record<string, string[] | undefined>;
  };
};

const CONTACT_LIMITS = {
  name: { min: 2, max: 120 },
  email: { max: 240 },
  subject: { min: 3, max: 180 },
  message: { min: 10, max: 5000 },
};

function formatContactError(data: ContactErrorResponse): string {
  const fieldErrors = data.details?.fieldErrors;
  if (fieldErrors) {
    const formatted = Object.entries(fieldErrors)
      .flatMap(([field, messages]) => (messages ?? []).map((message) => `${field}: ${message}`));
    if (formatted.length > 0) {
      return formatted.join(" ");
    }
  }

  return data.error ?? "Unable to send your message.";
}

export function ContactForm(props: { defaultName?: string; defaultEmail?: string }) {
  const [name, setName] = useState(props.defaultName ?? "");
  const [email, setEmail] = useState(props.defaultEmail ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const trimmed = {
      name: name.trim(),
      email: email.trim(),
      subject: subject.trim(),
      message: message.trim(),
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: trimmed.name,
          email: trimmed.email,
          subject: trimmed.subject,
          message: trimmed.message,
          contextUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });

      const data = (await response.json()) as ContactErrorResponse;
      if (!response.ok) {
        setFeedback(formatContactError(data));
        return;
      }

      setSubject("");
      setMessage("");
      setFeedback("Message sent. A superuser has been notified.");
    } catch {
      setFeedback("Network error while sending message. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <label className="block text-sm font-semibold text-orange-950">
        Name
        <input
          className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2 text-sm"
          maxLength={CONTACT_LIMITS.name.max}
          minLength={CONTACT_LIMITS.name.min}
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </label>

      <label className="block text-sm font-semibold text-orange-950">
        Email
        <input
          className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2 text-sm"
          maxLength={CONTACT_LIMITS.email.max}
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      <label className="block text-sm font-semibold text-orange-950">
        Subject
        <input
          className="mt-1 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2 text-sm"
          maxLength={CONTACT_LIMITS.subject.max}
          minLength={CONTACT_LIMITS.subject.min}
          onChange={(event) => setSubject(event.target.value)}
          required
          value={subject}
        />
      </label>

      <label className="block text-sm font-semibold text-orange-950">
        Message
        <textarea
          className="mt-1 min-h-36 w-full rounded-xl border border-orange-900/20 bg-white px-3 py-2 text-sm"
          maxLength={CONTACT_LIMITS.message.max}
          minLength={CONTACT_LIMITS.message.min}
          onChange={(event) => setMessage(event.target.value)}
          required
          value={message}
        />
      </label>

      <button
        className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? "Sending..." : "Send Message"}
      </button>

      {feedback ? <p className="text-sm text-orange-900">{feedback}</p> : null}
    </form>
  );
}
