/**
 * Test Script for /set-admin-status Endpoint
 * 
 * Tests the unified admin status endpoint to ensure:
 * - Promotion updates both auth_access and admin_uids_v1
 * - Demotion removes from admin list and clears all permissions
 * - Error cases handled properly
 * - Firestore data is correct after operations
 */

const axios = require('axios');
const admin = require('./firebaseAdmin');
const db = admin.firestore();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
const TEST_ADMIN_PASSWORD = process.env.ADMIN_ROLE_UPDATE_PASSWORD;

// Test user setup - we'll use real users from Firestore for testing
let testConfig = {
    adminToken: null,
    adminUid: null,
    targetUserUid: null,
    targetUserName: null,
};

console.log(`\n🧪 Testing /set-admin-status Endpoint`);
console.log(`Backend URL: ${BACKEND_URL}`);
console.log(`======================================\n`);

/**
 * Get admin token and user info
 */
async function setupTestConfig() {
    try {
        console.log('📋 Setting up test configuration...');
        
        // Get list of users
        const usersSnapshot = await db.collection('users').limit(10).get();
        if (usersSnapshot.empty) {
            console.error('❌ No users found in Firestore. Add some users first.');
            process.exit(1);
        }

        const users = [];
        usersSnapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });

        // Find an admin user (for getting the JWT token)
        const adminUserSnapshot = await db.collection('app_settings').doc('admin_uids_v1').get();
        const adminUidList = adminUserSnapshot.data()?.authorized_admin_uids || [];

        let adminUser = users.find(u => adminUidList.includes(u.id));
        if (!adminUser) {
            console.warn('⚠️  No admin found in admin_uids_v1, using first user as admin test user');
            adminUser = users[0];
        }

        testConfig.adminUid = adminUser.id;
        testConfig.adminName = adminUser.user_name;

        // Find a non-admin user to test with (or use second user)
        let targetUser = users.find(u => u.id !== adminUser.id && !adminUidList.includes(u.id));
        if (!targetUser) {
            targetUser = users.find(u => u.id !== adminUser.id);
        }

        testConfig.targetUserUid = targetUser.id;
        testConfig.targetUserName = targetUser.user_name;

        // Get admin token using Firebase Admin SDK
        const customToken = await admin.auth().createCustomToken(testConfig.adminUid);
        testConfig.adminToken = customToken;

        console.log(`✅ Test config ready:`);
        console.log(`   - Admin UID: ${testConfig.adminUid} (${testConfig.adminName})`);
        console.log(`   - Target User UID: ${testConfig.targetUserUid} (${testConfig.targetUserName})`);
        console.log(`   - Token obtained: ${testConfig.adminToken.substring(0, 20)}...`);
        console.log('');

    } catch (error) {
        console.error('❌ Failed to setup test config:', error.message);
        process.exit(1);
    }
}

/**
 * Test 1: Promote user to admin
 */
async function testPromoteUser() {
    console.log('\n🟢 TEST 1: Promote User to Admin');
    console.log('─────────────────────────────────────');

    try {
        const payload = {
            user_id: testConfig.targetUserUid,
            is_admin: true,
            admin_password: TEST_ADMIN_PASSWORD,
        };

        console.log('📤 Sending request:');
        console.log(`   POST ${BACKEND_URL}/set-admin-status`);
        console.log(`   Body: ${JSON.stringify(payload, null, 2)}`);

        const response = await axios.post(
            `${BACKEND_URL}/set-admin-status`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${testConfig.adminToken}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000,
            }
        );

        console.log('📥 Response received:');
        console.log(`   Status: ${response.status}`);
        console.log(`   Body: ${JSON.stringify(response.data, null, 2)}`);

        if (response.data.operation !== 'success') {
            console.error('❌ Operation failed:', response.data.message);
            return false;
        }

        console.log('✅ Promotion request successful');
        return true;

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Verify promotion in Firestore
 */
async function verifyPromotion() {
    console.log('\n🔍 Verifying promotion in Firestore...');
    console.log('─────────────────────────────────────');

    try {
        // Check 1: auth_access.admin_panel should be true
        const userDoc = await db.collection('users').doc(testConfig.targetUserUid).get();
        const isAdminPanelTrue = userDoc.data()?.auth_access?.admin_panel === true;

        console.log(`1️⃣  Check auth_access.admin_panel:`);
        console.log(`   ${isAdminPanelTrue ? '✅' : '❌'} Value: ${userDoc.data()?.auth_access?.admin_panel}`);

        // Check 2: Should be in admin_uids_v1 list
        const adminUidsDoc = await db.collection('app_settings').doc('admin_uids_v1').get();
        const adminUidList = adminUidsDoc.data()?.authorized_admin_uids || [];
        const isInAdminList = adminUidList.includes(testConfig.targetUserUid);

        console.log(`2️⃣  Check admin_uids_v1 list:`);
        console.log(`   ${isInAdminList ? '✅' : '❌'} UID in list: ${isInAdminList}`);
        console.log(`   Current admins: ${adminUidList.length} total`);

        // Check 3: Activity log entry
        const logsQuery = await db
            .collection('activity_logs')
            .where('target_user_id', '==', testConfig.targetUserUid)
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();

        let hasLogEntry = false;
        if (!logsQuery.empty) {
            const logEntry = logsQuery.docs[0].data();
            hasLogEntry = logEntry.change_type?.includes('admin') || logEntry.action?.includes('admin');
            console.log(`3️⃣  Check activity_logs:`);
            console.log(`   ${hasLogEntry ? '✅' : '❌'} Log entry found`);
            if (hasLogEntry) {
                console.log(`   Entry: ${logEntry.change_type || logEntry.action}`);
            }
        } else {
            console.log(`3️⃣  Check activity_logs:`);
            console.log(`   ⚠️  No recent log entry (might be OK depending on logging setup)`);
        }

        const allChecked = isAdminPanelTrue && isInAdminList;
        console.log(`\n${allChecked ? '✅' : '❌'} Promotion verification: ${allChecked ? 'PASSED' : 'FAILED'}`);
        return allChecked;

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        return false;
    }
}

/**
 * Test 2: Demote user from admin
 */
async function testDemoteUser() {
    console.log('\n🔴 TEST 2: Demote User from Admin');
    console.log('─────────────────────────────────────');

    try {
        const payload = {
            user_id: testConfig.targetUserUid,
            is_admin: false,
            admin_password: TEST_ADMIN_PASSWORD,
        };

        console.log('📤 Sending request:');
        console.log(`   POST ${BACKEND_URL}/set-admin-status`);
        console.log(`   Body: ${JSON.stringify(payload, null, 2)}`);

        const response = await axios.post(
            `${BACKEND_URL}/set-admin-status`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${testConfig.adminToken}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000,
            }
        );

        console.log('📥 Response received:');
        console.log(`   Status: ${response.status}`);
        console.log(`   Body: ${JSON.stringify(response.data, null, 2)}`);

        if (response.data.operation !== 'success') {
            console.error('❌ Operation failed:', response.data.message);
            return false;
        }

        console.log('✅ Demotion request successful');
        return true;

    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
        return false;
    }
}

/**
 * Verify demotion in Firestore
 */
async function verifyDemotion() {
    console.log('\n🔍 Verifying demotion in Firestore...');
    console.log('─────────────────────────────────────');

    try {
        // Check 1: ALL auth_access fields should be false
        const userDoc = await db.collection('users').doc(testConfig.targetUserUid).get();
        const authAccess = userDoc.data()?.auth_access || {};
        const allFalse = Object.values(authAccess).every(v => v === false);

        console.log(`1️⃣  Check all auth_access fields are false:`);
        console.log(`   ${allFalse ? '✅' : '❌'} All permissions revoked`);
        console.log(`   Permissions:`, Object.entries(authAccess).map(([k, v]) => `${k}=${v}`).join(', '));

        // Check 2: Should NOT be in admin_uids_v1 list
        const adminUidsDoc = await db.collection('app_settings').doc('admin_uids_v1').get();
        const adminUidList = adminUidsDoc.data()?.authorized_admin_uids || [];
        const isNotInAdminList = !adminUidList.includes(testConfig.targetUserUid);

        console.log(`2️⃣  Check admin_uids_v1 list:`);
        console.log(`   ${isNotInAdminList ? '✅' : '❌'} UID removed from list`);
        console.log(`   Current admins: ${adminUidList.length} total`);

        // Check 3: Other admins should still exist
        const hasOtherAdmins = adminUidList.length > 0;
        console.log(`3️⃣  Check other admins exist:`);
        console.log(`   ${hasOtherAdmins ? '✅' : '⚠️'} ${adminUidList.length} admin(s) remain`);

        const allChecked = allFalse && isNotInAdminList;
        console.log(`\n${allChecked ? '✅' : '❌'} Demotion verification: ${allChecked ? 'PASSED' : 'FAILED'}`);
        return allChecked;

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        return false;
    }
}

/**
 * Test 3: Error case - wrong password
 */
async function testWrongPassword() {
    console.log('\n⚠️ TEST 3: Wrong Password (Error Case)');
    console.log('─────────────────────────────────────');

    try {
        const payload = {
            user_id: testConfig.targetUserUid,
            is_admin: true,
            admin_password: 'wrong_password_12345',
        };

        console.log('📤 Sending request with wrong password...');

        const response = await axios.post(
            `${BACKEND_URL}/set-admin-status`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${testConfig.adminToken}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000,
            }
        );

        console.error('❌ Should have failed with 403, but got:', response.status);
        return false;

    } catch (error) {
        if (error.response?.status === 403) {
            console.log('✅ Correctly rejected with 403:', error.response.data.message);
            return true;
        } else {
            console.error('❌ Unexpected error:', error.message);
            return false;
        }
    }
}

/**
 * Main test runner
 */
async function runAllTests() {
    try {
        await setupTestConfig();

        let results = {
            promote: false,
            verifyPromotion: false,
            demote: false,
            verifyDemotion: false,
            wrongPassword: false,
        };

        // Run tests in sequence
        results.promote = await testPromoteUser();
        await new Promise(r => setTimeout(r, 1000)); // Small delay for DB write

        results.verifyPromotion = await verifyPromotion();
        await new Promise(r => setTimeout(r, 500));

        results.demote = await testDemoteUser();
        await new Promise(r => setTimeout(r, 1000));

        results.verifyDemotion = await verifyDemotion();
        await new Promise(r => setTimeout(r, 500));

        results.wrongPassword = await testWrongPassword();

        // Summary
        console.log('\n\n📊 TEST SUMMARY');
        console.log('═════════════════════════════════════');
        console.log(`✅ Promote to Admin: ${results.promote ? 'PASS' : 'FAIL'}`);
        console.log(`✅ Verify Promotion: ${results.verifyPromotion ? 'PASS' : 'FAIL'}`);
        console.log(`✅ Demote from Admin: ${results.demote ? 'PASS' : 'FAIL'}`);
        console.log(`✅ Verify Demotion: ${results.verifyDemotion ? 'PASS' : 'FAIL'}`);
        console.log(`✅ Error Handling: ${results.wrongPassword ? 'PASS' : 'FAIL'}`);

        const allPassed = Object.values(results).every(r => r);
        console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall: ${allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
        console.log('═════════════════════════════════════\n');

        process.exit(allPassed ? 0 : 1);

    } catch (error) {
        console.error('\n❌ Test runner error:', error);
        process.exit(1);
    }
}

// Run tests
runAllTests();
