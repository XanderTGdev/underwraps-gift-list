/**
 * Masks an email address for privacy
 * Example: john.doe@example.com -> j***@example.com
 */
export function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;
  
  if (localPart.length <= 1) {
    return `${localPart}***@${domain}`;
  }
  
  return `${localPart[0]}***@${domain}`;
}
