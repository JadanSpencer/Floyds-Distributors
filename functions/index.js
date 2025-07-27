/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Auto-set role when a user doc is created in Firestore
exports.setUserRole = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snap, context) => {
    const userData = snap.data();
    const uid = context.params.userId;

    // Set 'admin' if email ends with "@admin.com"
    if (userData.email.endsWith('@admin.com')) {
      await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
    }
    // Default to 'driver' for others (customize as needed)
    else {
      await admin.auth().setCustomUserClaims(uid, { role: 'driver' });
    }
  });

  // HTTP endpoint to promote users (call from your admin panel)
exports.makeAdmin = functions.https.onCall(async (data, context) => {
  // Only allow admins to call this
  if (!context.auth || context.auth.token.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can assign roles.');
  }

  const uid = data.uid; // Pass UID from frontend
  await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
  return { success: true };
});
