#!/usr/bin/env node

/**
 * PHASE 6: Verify No Admin Lost Access
 * 
 * CRITICAL PRE-DEPLOYMENT CHECK
 * 
 * This script ensures that:
 * 1. All original admins from frontend .env are in database
 * 2. No admins have been accidentally removed
 * 3. Both systems are in sync
 * 4. Safe to proceed with deployment
 * 
 * If this check fails, DO NOT DEPLOY
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

async function verifyNoAccessLoss() {
    console.log('\n========================================');
    console.log('PHASE 6: ACCESS VERIFICATION');
    console.log('Ensuring No Admin Lost Access');
    console.log('========================================\n');

    let issuesFound = [];

    try {
        // STEP 1: Get environment admin list (original source of truth)
        console.log('STEP 1: Load original admin UIDs from environment (.env)\n');
        
        const envUids = AdminUidModel.getDefaultAdminUids();
        
        console.log(`Found ${envUids.length} admins in environment:\n`);
        envUids.forEach((uid, index) => {
            console.log(`   ${index + 1}. ${uid}`);
        });
        
        if (envUids.length === 0) {
            console.log('❌ ERROR: No admins configured in environment!');
            console.log('   Check ADMIN_UID_LIST in .env\n');
            process.exit(1);
        }
        console.log();

        // STEP 2: Get database admin list
        console.log('STEP 2: Load current admin UIDs from database\n');
        
        const dbList = await AdminUidModel.getAdminUidList();
        
        console.log(`Found ${dbList.total_admins} admins in database:\n`);
        dbList.uids.forEach((uid, index) => {
            console.log(`   ${index + 1}. ${uid}`);
        });
        console.log();

        // STEP 3: Compare - check for missing admins
        console.log('STEP 3: Verify all original admins are in database\n');
        
        for (const uid of envUids) {
            const isInDb = dbList.uids.includes(uid);
            
            if (isInDb) {
                console.log(`   ✅ ${uid}`);
            } else {
                console.log(`   ❌ MISSING: ${uid}`);
                issuesFound.push(`Admin ${uid} is in environment but NOT in database!`);
            }
        }
        console.log();

        // STEP 4: Check for extra admins in database
        console.log('STEP 4: Check for unexpected admins in database\n');
        
        const extraAdmins = dbList.uids.filter(uid => !envUids.includes(uid));
        
        if (extraAdmins.length === 0) {
            console.log('   ✅ No extra admins (database matches environment)\n');
        } else {
            console.log(`   ⚠️  Found ${extraAdmins.length} extra admin(s) in database:\n`);
            extraAdmins.forEach(uid => {
                console.log(`      - ${uid}`);
            });
            console.log('\n   Note: This is OK if you intentionally added admins\n');
        }

        // STEP 5: Verify each admin's actual authorization status
        console.log('STEP 5: Verify authorization status for all original admins\n');
        
        let allAuthorized = true;
        for (const uid of envUids) {
            const isAuthorized = await AdminUidModel.isAdminUid(uid);
            
            if (isAuthorized) {
                console.log(`   ✅ ${uid}: AUTHORIZED`);
            } else {
                console.log(`   ❌ ${uid}: NOT AUTHORIZED`);
                issuesFound.push(`Admin ${uid} is in database but not authorized!`);
                allAuthorized = false;
            }
        }
        console.log();

        // STEP 6: Final decision
        console.log('========================================');
        console.log('VERIFICATION RESULT');
        console.log('========================================\n');

        if (issuesFound.length === 0) {
            console.log('✅ PERFECT - No admins lost access!\n');
            console.log('Summary:');
            console.log(`  Total original admins: ${envUids.length}`);
            console.log(`  Total in database: ${dbList.total_admins}`);
            console.log(`  All authorized: YES`);
            console.log(`  Data integrity: VERIFIED\n`);
            
            console.log('========================================');
            console.log('🚀 SAFE TO DEPLOY');
            console.log('========================================\n');
            
            console.log('NEXT STEPS:');
            console.log('1. Backup current database state');
            console.log('2. Deploy Phase 6+ code');
            console.log('3. Monitor logs for any issues');
            console.log('4. Test cache policy settings in admin panel\n');
            
            process.exit(0);
        } else {
            console.log('❌ CRITICAL ISSUES FOUND:\n');
            
            issuesFound.forEach((issue, index) => {
                console.log(`${index + 1}. ${issue}`);
            });
            
            console.log('\n========================================');
            console.log('⛔ DO NOT DEPLOY');
            console.log('========================================\n');
            
            console.log('REQUIRED ACTIONS:');
            console.log('1. Review the issues above');
            console.log('2. Fix by running: node create-admin-uids-seed.js');
            console.log('3. Re-run this verification');
            console.log('4. Only then proceed with deployment\n');
            
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error.message);
        console.error('\nCannot proceed with verification');
        console.error('Please fix the error before deployment\n');
        process.exit(1);
    }
}

verifyNoAccessLoss();
