const { httpError } = require("./httpError");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Deliberately permissive: the UI accepts local formats such as 01012345678
// and international ones such as +20 112 345 6789. E.164 normalisation is an
// open decision, so the API validates shape rather than rewriting the value.
const PHONE_REGEX = /^[+()\d][\d\s()-]{6,}$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accumulates field errors so one request can report every problem at once,
 * then throws a single 400 whose `errors` array the client can map to inputs.
 */
class Validator {
  constructor() {
    this.errors = [];
  }

  fail(field, message) {
    this.errors.push({ field, message });
  }

  get hasErrors() {
    return this.errors.length > 0;
  }

  done() {
    if (this.hasErrors) {
      throw httpError(
        400,
        "validation_error",
        "Please correct the highlighted fields.",
        this.errors
      );
    }
  }

  text(value, field, { required = false, min = 0, max = 255, label } = {}) {
    const name = label || field;

    if (value === undefined || value === null || value === "") {
      if (required) this.fail(field, `${name} is required.`);
      return null;
    }

    if (typeof value !== "string") {
      this.fail(field, `${name} must be text.`);
      return null;
    }

    const trimmed = value.trim();

    if (trimmed.length < min) {
      this.fail(field, `${name} must be at least ${min} characters.`);
      return null;
    }

    if (trimmed.length > max) {
      this.fail(field, `${name} must not exceed ${max} characters.`);
      return null;
    }

    return trimmed;
  }

  email(value, field = "email", { required = true } = {}) {
    const text = this.text(value, field, { required, max: 255, label: "Email" });
    if (text === null) return null;

    if (!EMAIL_REGEX.test(text)) {
      this.fail(field, "Enter a valid email address.");
      return null;
    }

    return text.toLowerCase();
  }

  phone(value, field = "phone") {
    const text = this.text(value, field, { max: 32, label: "Phone number" });
    if (text === null) return null;

    if (!PHONE_REGEX.test(text)) {
      this.fail(field, "Enter a valid phone number.");
      return null;
    }

    return text;
  }

  /** Accepts YYYY-MM-DD only; rejects impossible dates and future dates. */
  date(value, field = "date_of_birth") {
    const text = this.text(value, field, { max: 10, label: "Date of birth" });
    if (text === null) return null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      this.fail(field, "Use the YYYY-MM-DD format.");
      return null;
    }

    const parsed = new Date(`${text}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
      this.fail(field, "Enter a real calendar date.");
      return null;
    }

    if (text <= "1900-01-01") {
      this.fail(field, "Date of birth must be after 1 January 1900.");
      return null;
    }

    if (text > new Date().toISOString().slice(0, 10)) {
      this.fail(field, "Date of birth cannot be in the future.");
      return null;
    }

    return text;
  }

  integer(value, field, { min = 0, max = 100, label } = {}) {
    if (value === undefined || value === null || value === "") return null;

    const parsed = Number(value);
    if (!Number.isInteger(parsed)) {
      this.fail(field, `${label || field} must be a whole number.`);
      return null;
    }

    if (parsed < min || parsed > max) {
      this.fail(field, `${label || field} must be between ${min} and ${max}.`);
      return null;
    }

    return parsed;
  }

  uuid(value, field, { required = false } = {}) {
    const text = this.text(value, field, { required, max: 36, label: field });
    if (text === null) return null;

    if (!UUID_REGEX.test(text)) {
      this.fail(field, `${field} is not a valid identifier.`);
      return null;
    }

    return text;
  }

  oneOf(value, field, allowed, { required = true, label } = {}) {
    const text = this.text(value, field, { required, max: 50, label: label || field });
    if (text === null) return null;

    if (!allowed.includes(text)) {
      this.fail(field, `${label || field} must be one of: ${allowed.join(", ")}.`);
      return null;
    }

    return text;
  }

  /** Same policy as public registration, so activation cannot weaken it. */
  password(value, field = "password") {
    if (!value || typeof value !== "string") {
      this.fail(field, "Password is required.");
      return null;
    }

    if (value.length < 8) {
      this.fail(field, "Password must be at least 8 characters long.");
      return null;
    }

    if (value.length > 200) {
      this.fail(field, "Password must not exceed 200 characters.");
      return null;
    }

    if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
      this.fail(
        field,
        "Password must include at least one uppercase letter, one lowercase letter, and one number."
      );
      return null;
    }

    return value;
  }
}

module.exports = { Validator, EMAIL_REGEX, UUID_REGEX };
