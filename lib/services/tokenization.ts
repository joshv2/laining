import { TokenizationEventType, type Prisma, type PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/db/client";

const DEFAULT_RULES: Array<{ eventType: TokenizationEventType; tokenDelta: number }> = [
  { eventType: TokenizationEventType.MODERATION_APPROVED, tokenDelta: 20 },
  { eventType: TokenizationEventType.MODERATION_REJECTED, tokenDelta: -5 },
  { eventType: TokenizationEventType.ASSIGNMENT_CREATED, tokenDelta: 8 },
  { eventType: TokenizationEventType.ASSIGNMENT_UPDATED, tokenDelta: 2 },
  { eventType: TokenizationEventType.ASSIGNMENT_DELETED, tokenDelta: -2 },
];

export type TokenizationTriggerInput = {
  eventType: TokenizationEventType;
  recipientUserId: string;
  sourceType: string;
  sourceId: string;
  metadata?: Prisma.InputJsonValue;
};

async function ensureDefaultTokenizationRules(tx: Prisma.TransactionClient) {
  await tx.tokenizationRule.createMany({
    data: DEFAULT_RULES,
    skipDuplicates: true,
  });
}

export async function triggerTokenization(input: TokenizationTriggerInput, db: PrismaClient = prisma) {
  return db.$transaction(async (tx) => {
    await ensureDefaultTokenizationRules(tx);

    const rule = await tx.tokenizationRule.findUnique({
      where: {
        eventType: input.eventType,
      },
      select: {
        eventType: true,
        tokenDelta: true,
        enabled: true,
      },
    });

    if (!rule?.enabled || rule.tokenDelta === 0) {
      return null;
    }

    return tx.tokenLedgerEntry.create({
      data: {
        recipientId: input.recipientUserId,
        eventType: input.eventType,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        tokenDelta: rule.tokenDelta,
        metadata: input.metadata,
      },
    });
  });
}

export async function triggerTokenizationSafely(input: TokenizationTriggerInput) {
  try {
    await triggerTokenization(input);
  } catch (error) {
    console.error("Tokenization trigger failed", {
      eventType: input.eventType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      error,
    });
  }
}
