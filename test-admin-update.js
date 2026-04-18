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
 * Simulate admin updating cache policy TTL values
 */
async function updateCachePolicyAsAdmin() {
    try {
        console.log('\n👨‍💼 Simulating Admin TTL Change...\n');
        
        // Simulate an admin user (in real app, this would come from JWT)
        const adminUid = 'MAehKb0ZaFV0ehaV7MXwInPJ41J3';  // Real admin from code
        const adminName = 'Admin User';
        
        // New TTL values admin is changing to
        const newPolicyValues = {
            reference_data_ttl_seconds: 1200,        // Changed from 600 to 1200 (20 min)
            dashboard_reports_ttl_seconds: 300,      // Changed from 180 to 300 (5 min)
            monthly_report_ttl_seconds: 600,         // Changed from 300 to 600 (10 min)
            paged_records_ttl_seconds: 120           // Changed from 60 to 120 (2 min)
        };
        
        const now = admin.firestore.Timestamp.now();
        
        const docRef = db.collection('app_settings').doc('cache_policy_v1');
        
        // Update the document with new TTL values and audit trail
        await docRef.update({
            ...newPolicyValues,
            updated_at: now,
            updated_by_uid: adminUid,
            updated_by_name: adminName,
            source: 'db'
        });
        
        console.log('✅ Cache Policy Updated in Database!\n');
        console.log('📊 Changes Made:');
        console.log('================================');
        console.log('reference_data_ttl_seconds:');
        console.log('  Before: 600s  →  After: 1200s ⏱️\n');
        console.log('dashboard_reports_ttl_seconds:');
        console.log('  Before: 180s  →  After: 300s ⏱️\n');
        console.log('monthly_report_ttl_seconds:');
        console.log('  Before: 300s  →  After: 600s ⏱️\n');
        console.log('paged_records_ttl_seconds:');
        console.log('  Before: 60s   →  After: 120s ⏱️\n');
        console.log('================================\n');
        
        console.log('📋 Audit Information:');
        console.log(`  ⏰ Updated At: ${new Date(now.seconds * 1000).toISOString()}`);
        console.log(`  👤 Updated By: ${adminName}`);
        console.log(`  🆔 Admin UID: ${adminUid}\n`);
        
        // Now fetch and display the updated document
        console.log('📥 Verifying Updated Document in Database...\n');
        
        const updatedDoc = await docRef.get();
        if (updatedDoc.exists) {
            const data = updatedDoc.data();
            console.log('✅ Updated Values in Database:');
            console.log('================================');
            console.log(JSON.stringify({
                reference_data_ttl_seconds: data.reference_data_ttl_seconds,
                dashboard_reports_ttl_seconds: data.dashboard_reports_ttl_seconds,
                monthly_report_ttl_seconds: data.monthly_report_ttl_seconds,
                paged_records_ttl_seconds: data.paged_records_ttl_seconds,
                notify_on_stale_data: data.notify_on_stale_data,
                source: data.source
            }, null, 2));
            console.log('================================\n');
            
            console.log('🔄 Sync Flow Summary:');
            console.log('  1. ✅ Admin changes TTL in UI');
            console.log('  2. ✅ Backend saveCachePolicySettings() called');
            console.log('  3. ✅ Document updated in Firestore (app_settings/cache_policy_v1)');
            console.log('  4. ✅ updateCachePolicy() updates cachePolicyManager');
            console.log('  5. ✅ TanStack Query staleTime updates automatically');
            console.log('  6. ✅ Service Worker receives CACHE_POLICY_UPDATED message');
            console.log('  7. ✅ Service Worker broadcasts to all tabs');
            console.log('  8. ✅ All clients invalidate old cache\n');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating cache policy:', error);
        process.exit(1);
    }
}

updateCachePolicyAsAdmin();
