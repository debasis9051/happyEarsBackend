#!/usr/bin/env node

/**
 * Verify Admin UIDs Configuration
 * 
 * Checks:
 * - admin_uids_v1 document exists
 * - Current admin list matches expectations
 * - Comparison with environment defaults
 * - Audit trail is present
 */

require('dotenv').config();

const admin = require('firebase-admin');

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

const AdminUidModel = require('./models/adminUidModel');

async function verifyAdminUids() {
    console.log('\n========================================');
    console.log('VERIFICATION: Admin UIDs Configuration');
    console.log('========================================\n');

    try {
        // Get from database
        console.log('📋 Admin UIDs from Database (app_settings/admin_uids_v1):');
        const dbList = await AdminUidModel.getAdminUidList();
        
        console.log(`   Source: ${dbList.source}`);
        console.log(`   Total Admins: ${dbList.total_admins}\n`);
        
        console.log('   Authorized Admin UIDs:');
        dbList.uids.forEach((uid, index) => {
            console.log(`     ${index + 1}. ${uid}`);
        });
        
        if (dbList.updated_at) {
            const updateDate = new Date(dbList.updated_at.seconds * 1000);
            console.log(`\n   Seeded at: ${updateDate.toISOString()}`);
            console.log(`   By: ${dbList.updated_by_name || 'System'}`);
        }

        // Get from environment
        console.log('\n📋 Admin UIDs from Environment (.env):');
        const envUids = AdminUidModel.getDefaultAdminUids();
        
        console.log(`   Total Admins: ${envUids.length}\n`);
        console.log('   Environment Admin UIDs:');
        envUids.forEach((uid, index) => {
            console.log(`     ${index + 1}. ${uid}`);
        });

        // Compare
        console.log('\n📊 Comparison:\n');
        
        const match = JSON.stringify(dbList.uids.sort()) === JSON.stringify(envUids.sort());
        
        if (match) {
            console.log('   ✅ Database admin list MATCHES environment defaults');
        } else {
            console.log('   ⚠️  Database admin list DIFFERS from environment defaults');
            
            const inDbOnly = dbList.uids.filter(uid => !envUids.includes(uid));
            const inEnvOnly = envUids.filter(uid => !dbList.uids.includes(uid));
            
            if (inDbOnly.length > 0) {
                console.log('\n   Only in Database:');
                inDbOnly.forEach(uid => console.log(`     - ${uid}`));
            }
            
            if (inEnvOnly.length > 0) {
                console.log('\n   Only in Environment:');
                inEnvOnly.forEach(uid => console.log(`     - ${uid}`));
            }
        }

        // Check authorization for specific users
        console.log('\n🔐 Authorization Check:\n');
        
        for (const uid of dbList.uids) {
            const isAuthorized = await AdminUidModel.isAdminUid(uid);
            const status = isAuthorized ? '✅ AUTHORIZED' : '❌ NOT AUTHORIZED';
            console.log(`   ${uid}: ${status}`);
        }

        // Get audit history
        console.log('\n📝 Audit Trail:\n');
        const history = await AdminUidModel.getAuditHistory();
        
        if (history) {
            if (history.last_change) {
                console.log(`   Last Change: ${history.last_change}`);
            }
            if (history.updated_by_name) {
                console.log(`   Modified By: ${history.updated_by_name}`);
            }
            if (history.updated_at) {
                const updateDate = new Date(history.updated_at.seconds * 1000);
                console.log(`   Modified At: ${updateDate.toISOString()}`);
            }
        }

        console.log('\n========================================');
        console.log('✅ VERIFICATION COMPLETE');
        console.log('========================================\n');

        return true;
    } catch (error) {
        console.error('\n❌ Verification Error:', error.message);
        console.error('\nPlease ensure admin_uids_v1 document exists.');
        console.error('Run: node create-admin-uids-seed.js\n');
        process.exit(1);
    }
}

verifyAdminUids();
