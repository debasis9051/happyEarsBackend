/**
 * firebaseAdmin — Initializes and exports the Firebase Admin SDK singleton.
 *
 * All Firebase service credentials are loaded from environment variables
 * (set in .env locally, or via Vercel/hosting platform env config in production).
 * This module must be required before any Firestore/Storage operations are performed.
 */
const admin = require('firebase-admin')

// Assemble the service account object from individual env vars so no JSON file is needed at runtime
const serviceAccount = {
    "type": process.env.type,
    "project_id": process.env.project_id,
    "private_key_id": process.env.private_key_id,
    "private_key": process.env.private_key,
    "client_email": process.env.client_email,
    "client_id": process.env.client_id,
    "auth_uri": process.env.auth_uri,
    "token_uri": process.env.token_uri,
    "auth_provider_x509_cert_url": process.env.auth_provider_x509_cert_url,
    "client_x509_cert_url": process.env.client_x509_cert_url,
    "universe_domain": process.env.universe_domain
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.default_bucket
});

module.exports = admin