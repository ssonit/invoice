export const UPLOAD_RATE_LIMIT_MAX_REQUESTS = 10
export const UPLOAD_RATE_LIMIT_WINDOW_SECONDS = 60

// Keyed by email — bounds password-guessing attempts against one account.
export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10
export const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 5 * 60

// Keyed by email — bounds signup spam / account-enumeration probing.
export const SIGNUP_RATE_LIMIT_MAX_ATTEMPTS = 5
export const SIGNUP_RATE_LIMIT_WINDOW_SECONDS = 60 * 60

// Keyed by email — bounds password-reset email spam against one address.
export const FORGOT_PASSWORD_RATE_LIMIT_MAX_ATTEMPTS = 5
export const FORGOT_PASSWORD_RATE_LIMIT_WINDOW_SECONDS = 60 * 60
