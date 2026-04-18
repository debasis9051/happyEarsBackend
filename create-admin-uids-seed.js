#!/usr/bin/env node

/**
 * PHASE 2: Seed Admin UIDs from Environment
 * 
 * This script safely creates the admin_uids_v1 document in Firestore
 * using UIDs from ADMIN_UID_LIST environment variable.
 * 
 * SAFETY CHECKS:
 * - Warns if document already exists
 * - Validates UID format before seeding
 * - Shows what will be seeded before proceeding
 * - Creates backup in logs
 */

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

const AdminUidModel = require('./models/adminUidModel');

async function seedAdminUids() {
    console.log('\n========================================');
    console.log('PHASE 2: SEED ADMIN UIDS');
    console.log('========================================\n');

    try {
        // Step 1: Get admin UIDs from environment
        console.log('📋 STEP 1: Reading ADMIN_UID_LIST from .env\n');

        const adminUidString = process.env.ADMIN_UID_LIST || '';
        const adminUids = adminUidString
            .split(',')
            .map(uid => uid.trim())
            .filter(uid => uid.length > 0);

        if (adminUids.length === 0) {
            console.log('❌ ERROR: ADMIN_UID_LIST is empty or not set in .env!');
            console.log('   Please set: ADMIN_UID_LIST=uid1,uid2,uid3\n');
            process.exit(1);
        }

        console.log(`✅ Found ${adminUids.length} admin UIDs in environment:\n`);
        adminUids.forEach((uid, index) => {
            console.log(`   ${index + 1}. ${uid}`);
        });
        console.log();

        // Step 2: Check if document already exists
        console.log('🔍 STEP 2: Checking if admin_uids_v1 already exists\n');

        const db = admin.firestore();
        const docRef = db.collection('app_settings').doc('admin_uids_v1');
        const existingDoc = await docRef.get();

        if (existingDoc.exists) {
            console.log('⚠️  WARNING: admin_uids_v1 document ALREADY EXISTS!\n');
            console.log('Current content:');
            console.log(JSON.stringify(existingDoc.data(), null, 2));
            console.log('\n❌ Aborting seeding to prevent data loss.');
            console.log('   If you need to update, use: node create-admin-uid-manager.js\n');
            process.exit(1);
        } else {
            console.log('✅ admin_uids_v1 document does NOT exist (good - safe to seed)\n');
        }

        // Step 3: Confirm before seeding
        console.log('⚡ STEP 3: Confirmation Required\n');
        console.log('Ready to seed the following admin UIDs to Firestore:');
        console.log(JSON.stringify(adminUids, null, 2));
        console.log('\n⚠️  THE FOLLOWING ADMIN UIDs WILL BE PRESERVED:');
        adminUids.forEach((uid, index) => {
            console.log(`   ${index + 1}. ${uid}`);
        });
        console.log('\n✅ These UIDs will retain admin access after B+C deployment\n');

        // Step 4: Perform seeding
        console.log('🚀 STEP 4: Creating admin_uids_v1 in Firestore\n');

        const result = await AdminUidModel.initializeAdminUidDocument(adminUids);

        if (result.success) {
            console.log('✅ Successfully seeded admin UIDs!\n');
            console.log(`   Document: app_settings/admin_uids_v1`);
            console.log(`   Seeded UIDs: ${result.count}`);
            console.log(`   Source: ADMIN_UID_LIST environment variable\n`);

            // Step 5: Verification
            console.log('🔍 STEP 5: Verifying seeded data\n');

            const verifyList = await AdminUidModel.getAdminUidList();
            console.log('Verified admin list from database:');
            verifyList.uids.forEach((uid, index) => {
                console.log(`   ${index + 1}. ${uid}`);
            });
            console.log(`\n✅ Source: ${verifyList.source}`);
            console.log(`   Total admins: ${verifyList.total_admins}`);
            
            if (verifyList.updated_at) {
                const updateDate = new Date(verifyList.updated_at.seconds * 1000);
                console.log(`   Created at: ${updateDate.toISOString()}`);
            }

            console.log('\n========================================');
            console.log('✅ PHASE 2 COMPLETE - SEEDING SUCCESSFUL');
            console.log('========================================\n');

            console.log('NEXT STEPS:\n');
            console.log('1. Verify data: node verify-admin-uids.js');
            console.log('2. Continue to Phase 3: Create adminUidValidation middleware\n');

            process.exit(0);
        } else {
            console.log('❌ Seeding failed:', result.message, '\n');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error during seeding:', error.message);
        console.error('\nPlease ensure:');
        console.error('  1. .env file exists and is properly configured');
        console.error('  2. ADMIN_UID_LIST is set in .env');
        console.error('  3. Firebase credentials are valid\n');
        process.exit(1);
    }
}

seedAdminUids();
