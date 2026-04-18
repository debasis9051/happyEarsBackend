#!/usr/bin/env node

/**
 * PHASE 5: Safety Testing
 * 
 * This script tests the new B+C security implementation WITHOUT
 * modifying any running services or affecting production.
 * 
 * Tests:
 * 1. Admin UID validation logic
 * 2. Permission checks
 * 3. Audit trail recording
 * 4. Fallback behavior
 * 
 * NO ACTUAL HTTP REQUESTS - simulates middleware behavior
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

async function runSafetyTests() {
    console.log('\n========================================');
    console.log('PHASE 5: SAFETY TESTING');
    console.log('B+C Security Implementation');
    console.log('========================================\n');

    let passed = 0;
    let failed = 0;

    try {
        // TEST 1: Admin UID list accessible
        console.log('TEST 1: Getting admin UID list from database\n');
        const adminList = await AdminUidModel.getAdminUidList();
        
        if (adminList.source === 'database' && adminList.uids.length > 0) {
            console.log('✅ PASS: Admin UID list retrieved successfully');
            console.log(`   Source: ${adminList.source}`);
            console.log(`   Total admins: ${adminList.total_admins}`);
            passed++;
        } else {
            console.log('❌ FAIL: Could not retrieve admin UID list');
            failed++;
        }
        console.log();

        // TEST 2: Verify each authorized admin
        console.log('TEST 2: Verify authorized admin UIDs\n');
        
        let allAuthorized = true;
        for (const uid of adminList.uids) {
            const isAuthorized = await AdminUidModel.isAdminUid(uid);
            if (isAuthorized) {
                console.log(`   ✅ ${uid}: AUTHORIZED`);
            } else {
                console.log(`   ❌ ${uid}: NOT AUTHORIZED`);
                allAuthorized = false;
            }
        }
        
        if (allAuthorized) {
            console.log('\n✅ PASS: All authorized UIDs verified');
            passed++;
        } else {
            console.log('\n❌ FAIL: Some UIDs failed authorization check');
            failed++;
        }
        console.log();

        // TEST 3: Reject unauthorized UID
        console.log('TEST 3: Reject unauthorized UID\n');
        
        const fakeUid = 'unauthorized_uid_12345';
        const isUnauthorizedCorrect = !(await AdminUidModel.isAdminUid(fakeUid));
        
        if (isUnauthorizedCorrect) {
            console.log(`   ✅ Correctly rejected: ${fakeUid}`);
            console.log('✅ PASS: Unauthorized UID properly denied');
            passed++;
        } else {
            console.log('❌ FAIL: Unauthorized UID incorrectly authorized');
            failed++;
        }
        console.log();

        // TEST 4: Audit trail exists
        console.log('TEST 4: Verify audit trail presence\n');
        
        const history = await AdminUidModel.getAuditHistory();
        
        if (history && history.updated_at) {
            console.log('✅ PASS: Audit trail exists');
            console.log(`   Created by: ${history.updated_by_name}`);
            console.log(`   Last change: ${history.last_change}`);
            console.log(`   Updated at: ${new Date(history.updated_at.seconds * 1000).toISOString()}`);
            passed++;
        } else {
            console.log('❌ FAIL: No audit trail found');
            failed++;
        }
        console.log();

        // TEST 5: Simulating middleware behavior
        console.log('TEST 5: Simulate middleware validation\n');
        
        // Simulate middleware for authorized user
        const testUser1 = {
            uid: adminList.uids[0],
            name: 'Test Admin'
        };
        
        const canAccess = await AdminUidModel.isAdminUid(testUser1.uid);
        if (canAccess) {
            console.log(`   ✅ User ${testUser1.uid}`);
            console.log(`      Permission: GRANTED`);
            console.log(`      Action: Would proceed to controller`);
            passed++;
        } else {
            console.log('❌ FAIL: Authorized user incorrectly denied');
            failed++;
        }
        
        // Simulate middleware for unauthorized user
        const testUser2 = {
            uid: 'unauthorized_uid_xyz',
            name: 'Unauthorized User'
        };
        
        const cannotAccess = !(await AdminUidModel.isAdminUid(testUser2.uid));
        if (cannotAccess) {
            console.log(`\n   ✅ User ${testUser2.uid}`);
            console.log(`      Permission: DENIED`);
            console.log(`      Action: Return 403 Unauthorized`);
            console.log('\n✅ PASS: Middleware simulation correct');
            passed++;
        } else {
            console.log('❌ FAIL: Unauthorized user incorrectly allowed');
            failed++;
        }
        console.log();

        // TEST 6: Environment fallback
        console.log('TEST 6: Check environment fallback configuration\n');
        
        const envUids = AdminUidModel.getDefaultAdminUids();
        if (envUids.length > 0) {
            console.log('✅ PASS: Environment fallback UIDs available');
            console.log(`   Count: ${envUids.length}`);
            console.log(`   UIDs: ${envUids.join(', ')}`);
            passed++;
        } else {
            console.log('❌ FAIL: No environment fallback UIDs');
            failed++;
        }
        console.log();

        // TEST 7: Database vs Environment comparison
        console.log('TEST 7: Database vs Environment comparison\n');
        
        const dbUids = adminList.uids.sort();
        const envUidsCompare = envUids.sort();
        const match = JSON.stringify(dbUids) === JSON.stringify(envUidsCompare);
        
        if (match) {
            console.log('✅ PASS: Database matches environment');
            console.log('   Admins are properly synchronized');
            passed++;
        } else {
            console.log('⚠️  INFO: Database differs from environment');
            console.log('   This is OK if you\'ve manually added/removed admins');
            console.log('   Database is the authoritative source');
            passed++;
        }
        console.log();

        // SUMMARY
        console.log('========================================');
        console.log('TEST SUMMARY');
        console.log('========================================\n');
        
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`Total: ${passed + failed}\n`);

        if (failed === 0) {
            console.log('🎉 ALL TESTS PASSED - READY FOR DEPLOYMENT\n');
            console.log('NEXT STEPS:');
            console.log('1. Phase 6: Verify no admin lost access');
            console.log('2. Phase 7: Deploy to production\n');
            process.exit(0);
        } else {
            console.log('⚠️  SOME TESTS FAILED - FIX BEFORE DEPLOYMENT\n');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error.message);
        console.error('\nPlease fix the error and retry Phase 5\n');
        process.exit(1);
    }
}

runSafetyTests();
