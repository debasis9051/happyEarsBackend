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
 * Create initial cache policy document in Firestore
 */
async function createCachePolicy() {
    try {
        console.log('\n🚀 Creating Cache Policy Document in Firestore...\n');
        
        const now = admin.firestore.Timestamp.now();
        
        const cachePolicy = {
            // TTL values in seconds
            reference_data_ttl_seconds: 600,        // 10 minutes
            dashboard_reports_ttl_seconds: 180,     // 3 minutes
            monthly_report_ttl_seconds: 300,        // 5 minutes
            paged_records_ttl_seconds: 60,          // 1 minute
            
            // Configuration
            notify_on_stale_data: true,
            
            // Audit trail
            created_at: now,
            updated_at: now,
            updated_by_uid: 'system-init',
            updated_by_name: 'System Initialization',
            source: 'db'
        };
        
        const docRef = db.collection('app_settings').doc('cache_policy_v1');
        
        // Use set with merge: false to create new document
        await docRef.set(cachePolicy, { merge: false });
        
        console.log('✅ Cache Policy Document Created Successfully!\n');
        console.log('📍 Location: app_settings/cache_policy_v1\n');
        console.log('📋 Initial Values:');
        console.log('================================');
        console.log(JSON.stringify({
            reference_data_ttl_seconds: cachePolicy.reference_data_ttl_seconds,
            dashboard_reports_ttl_seconds: cachePolicy.dashboard_reports_ttl_seconds,
            monthly_report_ttl_seconds: cachePolicy.monthly_report_ttl_seconds,
            paged_records_ttl_seconds: cachePolicy.paged_records_ttl_seconds,
            notify_on_stale_data: cachePolicy.notify_on_stale_data
        }, null, 2));
        console.log('================================\n');
        
        console.log(`⏰ Created At: ${new Date(now.seconds * 1000).toISOString()}`);
        console.log(`👤 Created By: ${cachePolicy.updated_by_name}\n`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating cache policy:', error);
        process.exit(1);
    }
}

createCachePolicy();
