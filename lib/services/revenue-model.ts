export type RevenueSplit = {
  recorderPercent: number;
  platformPercent: number;
};

export type EntitlementCheckInput = {
  userId: string;
  recordingId: string;
};

export interface RevenueModelService {
  resolveSplit(recordingId: string, when: Date): Promise<RevenueSplit>;
  userHasEntitlement(input: EntitlementCheckInput): Promise<boolean>;
}
