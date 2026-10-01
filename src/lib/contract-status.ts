/**
 * Shared contract status helper.
 * Compares date-only values to avoid timezone drift.
 */

export interface ContractStatusResult {
  label: string;
  daysRemaining: number | null;
  isEndingSoon: boolean; // <= 30 days remaining and not ended
  isEnded: boolean;
  rawDays: number | null;
}

/**
 * Normalizes a date string (YYYY-MM-DD or ISO timestamp) to a date-only timestamp at UTC midnight.
 */
function toDateOnlyUtc(dateInput: string | Date): number {
  if (typeof dateInput === "string") {
    // If string starts with YYYY-MM-DD, extract components
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return Date.UTC(year, month, day);
    }
  }
  const d = new Date(dateInput);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function getContractStatus(
  leaseEnd?: string | null,
  _leaseStart?: string | null
): ContractStatusResult {
  if (!leaseEnd) {
    return {
      label: "Active",
      daysRemaining: null,
      isEndingSoon: false,
      isEnded: false,
      rawDays: null,
    };
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const endUtc = toDateOnlyUtc(leaseEnd);

  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const diffDays = Math.round((endUtc - todayUtc) / MS_PER_DAY);

  if (diffDays < 0) {
    return {
      label: "Ended",
      daysRemaining: diffDays,
      isEndingSoon: false,
      isEnded: true,
      rawDays: diffDays,
    };
  }

  if (diffDays <= 30) {
    const dayText = diffDays === 1 ? "1 day" : `${diffDays} days`;
    const label = diffDays === 0 ? "Ends today" : `Ends in ${dayText}`;
    return {
      label,
      daysRemaining: diffDays,
      isEndingSoon: true,
      isEnded: false,
      rawDays: diffDays,
    };
  }

  return {
    label: "Active",
    daysRemaining: diffDays,
    isEndingSoon: false,
    isEnded: false,
    rawDays: diffDays,
  };
}
