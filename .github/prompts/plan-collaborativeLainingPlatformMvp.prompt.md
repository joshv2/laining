## Plan: Collaborative Laining Platform MVP
Build a Next.js 16 app for collaborative Torah/Neviim/Ketuvim recordings centered on pasuk-level navigation, strict moderation-before-publish, Google auth with roles, bilingual English/Hebrew UI, and Sefaria-first text import. Use a SOLID service architecture so storage and payments can evolve without rewrites, with paywall/revenue-share designed now and deferred from MVP implementation.

**Steps**
1. Phase 1: Foundation and architecture setup
2. Define domain modules and interfaces following SOLID boundaries: Auth, Text Catalog, Recording Ingestion, Playback, Moderation, Voting, Internationalization, Billing-Readiness. This is a structural step that blocks all feature implementation.
3. Adopt infrastructure choices aligned to deployment goals: Next.js App Router route handlers + server actions, PostgreSQL, Prisma ORM, NextAuth with Google provider, object storage abstraction (local for dev and S3-compatible for cloud), and background job layer for async alignment tasks. This blocks data model and API work.
4. Establish role-based access rules (User, Moderator, Superuser) and moderation-first visibility policy where only approved recordings appear in public discovery. Depends on auth design.
5. Phase 2: Data model and persistence
6. Create schema for Tanakh hierarchy and references: Work, Book, Chapter, Pasuk, Portion, and PortionPasuk ordering for sequence-aware playback. Parallel with role/permissions table setup.
7. Create schema for collaborative recordings: Recording, RecordingSource (uploaded vs browser-recorded), RecordingNussach (controlled enum + optional custom label), PasukBoundary markers, RecordingStatus history, and ModerationDecision audit log. Depends on step 6.
8. Create schema for community signals: Vote table with unique constraint on user + recording to enforce one vote per recording per user, plus optional Flag/Report entity for future trust tooling. Parallel with step 7.
9. Add forward-compatible commerce schema only (no payment execution in MVP): Entitlement, PaywalledAsset, RevenueShareRule, PayoutLedger placeholder, RecorderOwnership mapping. Depends on step 7.
10. Phase 3: Ingestion and text services
11. Implement Sefaria-first import pipeline for Torah/Neviim/Ketuvim text and metadata, with Wikitext adapter as fallback strategy if Sefaria endpoint limitations are encountered. Include provenance and import-run logging. Depends on step 6.
12. Normalize imported text into canonical pasuk records with stable identifiers and bilingual fields (Hebrew, English), preserving cantillation and punctuation variants needed for chanting workflows. Depends on step 11.
13. Build idempotent importer behavior and re-sync strategy (upsert by canonical ids), so content can be refreshed without duplication. Parallel with admin tooling for import monitoring.
14. Phase 4: Recording submission and moderation workflow
15. Implement recording submission paths: direct browser recording and file upload, both producing a common ingestion artifact with metadata validation. Depends on step 7.
16. Implement manual pasuk boundary editor required for submitters to mark where each pasuk starts/ends, with validation against selected pasuk range and audio duration. Depends on step 15.
17. Build moderation queue and review actions (approve, reject, request changes), with status transitions and immutable decision history. Public APIs/pages must filter to approved items only. Depends on steps 4 and 7.
18. Add nussach capture UX with controlled list and optional custom label, and enforce searchable indexing for filtering recordings by nussach. Parallel with moderation UI completion.
19. Phase 5: Playback and learner experience
20. Implement playback engine supporting seek within a pasuk, next/previous pasuk navigation, and full-portion continuous playback assembled by ordered pasuk boundaries. Depends on steps 12 and 16.
21. Implement waveform + marker timeline so users can scrub precisely and jump by pasuk boundaries. Depends on step 20.
22. Implement voting UX and API (up/down vote once per user per recording), including vote update semantics and aggregate score queries. Parallel with step 21.
23. Implement optional advanced audio pipeline for MVP nice-to-haves selected by user: automatic alignment and word-level highlighting. Run as asynchronous jobs that generate timestamped token/pasuk alignments; fall back gracefully to manual markers when confidence is low. Depends on steps 16 and 20.
24. Phase 6: Internationalization and design system
25. Implement bilingual interface with locale routing/content dictionaries for English and Hebrew, including right-to-left support and typography choices suitable for Hebrew liturgical text rendering. Parallel with playback pages and moderation pages.
26. Apply vibrant visual system with explicit color tokens and non-blue/non-purple primary palette, ensuring accessibility contrast, mobile responsiveness, and a distinct visual identity. Parallel with step 25.
27. Add Torah-style text presentation mode for canonical Hebrew passages (font stack and layout tuned for readability and taamim), while preserving fallback fonts and performance. Depends on step 25.
28. Phase 7: Security, operations, and verification
29. Add authorization guards for role-specific actions across APIs and server actions, including ownership checks for recording edits and strict moderator permissions for publication. Depends on steps 4 and 17.
30. Add observability and abuse protections: upload constraints, content-type checks, rate limits on voting and submission, and audit logs for moderator actions. Parallel with step 29.
31. Validate end-to-end workflows using automated tests and manual scripts: import text, submit recording, mark pasuk boundaries, moderate, browse approved recordings, vote limits, and bilingual navigation. Depends on all feature phases.

**Relevant files**
- c:/Users/Josh/laining/app/layout.tsx — establish global providers for session, i18n, and theme tokens.
- c:/Users/Josh/laining/app/page.tsx — landing/discovery entry and approved-content-only default queries.
- c:/Users/Josh/laining/app/globals.css — vibrant design tokens, RTL helpers, Hebrew typography utility classes.
- c:/Users/Josh/laining/app/api/auth/[...nextauth]/route.ts — Google auth handlers and session strategy.
- c:/Users/Josh/laining/middleware.ts — locale routing and role-based route protection.
- c:/Users/Josh/laining/app/api/import/sefaria/route.ts — Sefaria import trigger and status handling.
- c:/Users/Josh/laining/app/api/recordings/route.ts — create/list recordings with moderation-state filtering.
- c:/Users/Josh/laining/app/api/recordings/[id]/boundaries/route.ts — pasuk boundary creation and validation.
- c:/Users/Josh/laining/app/api/recordings/[id]/vote/route.ts — one-vote-per-user endpoint behavior.
- c:/Users/Josh/laining/app/api/moderation/queue/route.ts — moderator queue retrieval and claim/review actions.
- c:/Users/Josh/laining/lib/db/schema.prisma — canonical schema for users, text corpus, recordings, moderation, votes, and future billing tables.
- c:/Users/Josh/laining/lib/services/text-catalog.ts — import normalization and canonical pasuk lookup services.
- c:/Users/Josh/laining/lib/services/recording-ingestion.ts — upload/recording ingestion orchestration.
- c:/Users/Josh/laining/lib/services/alignment.ts — async automatic alignment and token timing confidence handling.
- c:/Users/Josh/laining/lib/services/playback.ts — pasuk and portion playback sequencing logic.
- c:/Users/Josh/laining/lib/services/revenue-model.ts — deferred commerce domain interfaces and split logic contracts only.
- c:/Users/Josh/laining/lib/storage/provider.ts — storage abstraction for local and cloud object storage.
- c:/Users/Josh/laining/lib/auth/roles.ts — centralized authorization rules and policy helpers.
- c:/Users/Josh/laining/messages/en.json — English UI strings.
- c:/Users/Josh/laining/messages/he.json — Hebrew UI strings.

**Verification**
1. Run lint and type checks for every phase gate to ensure architecture remains strict and maintainable.
2. Run migration and seed validations on local PostgreSQL and confirm idempotent re-runs of import pipeline.
3. Execute API integration tests for recording creation, boundary validation, moderation transitions, and unique vote constraints.
4. Run role authorization tests for User, Moderator, and Superuser route/action access.
5. Perform manual UX tests on desktop and mobile for recording, seeking, pasuk navigation, full-portion playback, and bilingual switching.
6. Validate moderation-first visibility by asserting that pending/rejected items never appear in public feeds.
7. Validate automatic alignment confidence fallback: when confidence is below threshold, manual boundary data remains authoritative.
8. Run accessibility checks including Hebrew RTL pages, contrast, keyboard navigation, and screen-reader labels for audio controls.
9. Smoke test deployment path on Vercel with managed Postgres and object storage, verifying environment-specific storage provider switching.

**Decisions**
- Included scope: strict pre-approval moderation, controlled nussach with optional custom label, direct recording/upload, manual boundary editor, waveform seek/markers, automatic alignment, word highlighting, voting limits, EN/HE UI, Sefaria-first import.
- Deferred implementation: payment checkout/payout execution. Included only as forward-compatible schema and service interfaces.
- Canonical text source decision: Sefaria first; if technical or licensing constraints emerge, activate Wikitext adapter fallback without changing downstream schema.
- Public visibility rule: approved recordings only.

**Further Considerations**
1. Automatic alignment engine choice recommendation: start with a managed speech-to-text/alignment provider for speed, then evaluate custom alignment once usage/data volume justify cost optimization.
2. Torah-style Hebrew text rendering recommendation: validate 2-3 candidate Hebrew fonts with taamim support early, because font quality directly affects learner trust and readability.
3. Moderation throughput recommendation: add bulk actions and queue prioritization early if launch expects many submissions per portion.