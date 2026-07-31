/** RFC 5321 practical max for email local+domain. */
export const EMAIL_MAX_LENGTH = 254;

/** NIST 800-63B baseline minimum for new/reset passwords. */
export const PASSWORD_MIN_LENGTH = 8;

/** Prevents oversized password payloads from reaching auth providers. */
export const PASSWORD_MAX_LENGTH = 128;

/** Matches vendor name / subscription vendorKey limits. */
export const VENDOR_KEY_MAX_LENGTH = 200;

/** Practical display-name limit (prevents UI breakage). */
export const NAME_MAX_LENGTH = 128;

/** Storage path segment — basename only, no directories. */
export const UPLOAD_FILENAME_MAX_LENGTH = 255;

/** File bytes plus multipart framing overhead. */
export const MAX_UPLOAD_REQUEST_BYTES = 16 * 1024 * 1024;

/** Webhook JSON bodies (Lemon Squeezy, AgentMail). */
export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

/** Reject multipart forms with unexpected extra fields. */
export const MAX_UPLOAD_FORM_FIELDS = 1;
