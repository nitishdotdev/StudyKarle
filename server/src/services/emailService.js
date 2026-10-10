const { Resend } = require("resend");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

const GENERIC_UNAVAILABLE =
  "Unable to send verification email. Please try again later.";

if (!env.resendApiKey) {
  console.error("WARNING: RESEND_API_KEY is not set. Email service will fail.");
}

const resend = new Resend(env.resendApiKey || "re_missing");

function unavailable(providerName, providerStatus) {
  logger.error(
    "Email provider send failed name=" +
      (providerName || "unknown") +
      " status=" +
      (providerStatus == null ? "none" : String(providerStatus))
  );
  return new ApiError(503, GENERIC_UNAVAILABLE);
}

async function sendEmail({ to, subject, html, text }) {
  if (!env.resendApiKey) {
    throw unavailable("missing_api_key", null);
  }

  let data;
  let error;
  try {
    const result = await resend.emails.send({
      from: env.emailFrom,
      to: [to],
      subject,
      html,
      text,
    });
    data = result.data;
    error = result.error;
  } catch (err) {
    throw unavailable(err && err.name, null);
  }

  if (error) {
    throw unavailable(error.name, error.statusCode);
  }

  return data;
}

module.exports = { sendEmail };
