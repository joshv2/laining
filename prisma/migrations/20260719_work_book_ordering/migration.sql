-- Add explicit ordering columns for library navigation
ALTER TABLE "Work" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Book" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Backfill work ordering to canonical Hebrew Bible grouping
UPDATE "Work"
SET "order" = CASE "kind"
  WHEN 'TORAH' THEN 1
  WHEN 'NEVIIM' THEN 2
  WHEN 'KETUVIM' THEN 3
  ELSE 999
END;

-- Backfill book ordering per work with a deterministic fallback
WITH ranked_books AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "workId"
      ORDER BY "titleEn" ASC, "createdAt" ASC, "id" ASC
    ) AS row_num
  FROM "Book"
)
UPDATE "Book" b
SET "order" = rb.row_num
FROM ranked_books rb
WHERE b."id" = rb."id";

CREATE INDEX "Work_order_titleEn_idx" ON "Work"("order", "titleEn");
CREATE INDEX "Book_workId_order_titleEn_idx" ON "Book"("workId", "order", "titleEn");
