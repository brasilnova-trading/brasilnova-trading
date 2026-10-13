const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

/**
 * Authenticated diagnostic endpoint.
 * Confirms the caller is signed in without exposing account data.
 */
exports.checkBackend = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Please sign in first."
    );
  }

  return {
    success: true,
    message: "Backend initialized successfully."
  };
});
