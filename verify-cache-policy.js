#!/usr/bin/env node

// Load environment variables
require('dotenv').config();

const admin = require('firebase-admin');

// Assemble service account from env vars
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
};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * Query the cache policy document from Firestore
 */
async function verifyCachePolicy() {
    try {
        console.log('\n📋 Fetching Cache Policy from Firestore...\n');
        
        const docRef = db.collection('app_settings').doc('cache_policy_v1');
        const doc = await docRef.get();
        
        if (doc.exists) {
            const data = doc.data();
            console.log('✅ Document Found: app_settings/cache_policy_v1\n');
            console.log('Current Cache Policy Settings:');
            console.log('================================');
            console.log(JSON.stringify(data, null, 2));
            console.log('================================\n');
            
            // Display audit information if available
            if (data.updated_at) {
                const updateDate = new Date(data.updated_at.seconds * 1000);
                console.log(`📅 Last Updated: ${updateDate.toISOString()}`);
            }
            if (data.updated_by_uid) {
                console.log(`👤 Updated By UID: ${data.updated_by_uid}`);
            }
            if (data.updated_by_name) {
                console.log(`👤 Updated By Name: ${data.updated_by_name}`);
            }
        } else {
            console.log('⚠️  Document not found in Firestore');
            console.log('📌 System will use hardcoded DEFAULT_POLICY values:');
            console.log('================================');
            console.log({
                reference_data_ttl_seconds: 600,
                dashboard_reports_ttl_seconds: 180,
                monthly_report_ttl_seconds: 300,
                paged_records_ttl_seconds: 60,
                notify_on_stale_data: true,
                source: 'default'
            });
            console.log('================================\n');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error querying Firestore:', error);
        process.exit(1);
    }
}

verifyCachePolicy();
