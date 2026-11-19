/**
 * Tenant bank details resolution.
 * The seed ships placeholder bank values so the demo works out of the box;
 * those placeholders must never reach a real customer-facing reminder.
 */

export const PLACEHOLDER_BANK_ACCOUNT = '50200012345678';

export interface ResolvedBankDetails {
  /** Formatted single-line bank details, or '' when not configured. */
  text: string;
  /** False while the tenant still has the seeded placeholder (or no) account number. */
  configured: boolean;
}

export function resolveTenantBankDetails(
  tenant?: {
    bankName?: string | null;
    bankAccountNo?: string | null;
    bankIfscCode?: string | null;
  } | null
): ResolvedBankDetails {
  const accountNo = (tenant?.bankAccountNo || '').trim();
  const configured = Boolean(accountNo) && accountNo !== PLACEHOLDER_BANK_ACCOUNT;

  if (!configured) {
    return { text: '', configured: false };
  }

  const parts = [tenant?.bankName?.trim() || 'Bank', `A/C: ${accountNo}`];
  if (tenant?.bankIfscCode?.trim()) {
    parts.push(`IFSC: ${tenant.bankIfscCode.trim()}`);
  }
  return { text: parts.join(', '), configured: true };
}
