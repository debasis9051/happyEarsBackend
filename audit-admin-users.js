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

const auth = admin.auth();
const db = admin.firestore();

/**
 * PHASE 0: Audit Current Admin Users
 * 
 * This script will:
 * 1. Get all users with custom claims (admin_panel or admin roles)
 * 2. Check for any admin collections in Firestore
 * 3. Report current admin structure
 * 4. Identify users that would be migrated
 */
async function auditCurrentAdmins() {
    console.log('\n========================================');
    console.log('PHASE 0: AUDITING CURRENT ADMIN USERS');
    console.log('========================================\n');
    
    try {
        console.log('🔍 STEP 1: Checking Firebase Auth Custom Claims\n');
        
        // Get all users from Firebase Auth
        const usersResult = await auth.listUsers(1000);
        const adminsWithClaims = [];
        
        for (const user of usersResult.users) {
            if (user.customClaims && (user.customClaims.admin_panel || user.customClaims.roles?.includes('admin'))) {
                adminsWithClaims.push({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName,
                    customClaims: user.customClaims,
                    createdAt: new Date(user.metadata.creationTime),
                    lastSignIn: user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime) : 'Never'
                });
            }
        }
        
        console.log(`Found ${adminsWithClaims.length} user(s) with admin_panel or admin roles:\n`);
        
        if (adminsWithClaims.length > 0) {
            adminsWithClaims.forEach((admin, index) => {
                console.log(`${index + 1}. UID: ${admin.uid}`);
                console.log(`   Email: ${admin.email}`);
                console.log(`   Name: ${admin.displayName || 'N/A'}`);
                console.log(`   Claims: ${JSON.stringify(admin.customClaims)}`);
                console.log(`   Created: ${admin.createdAt}`);
                console.log(`   Last Sign In: ${admin.lastSignIn}\n`);
            });
        } else {
            console.log('❌ No users found with admin claims in Firebase Auth!\n');
        }
        
        console.log('\n🔍 STEP 2: Checking Firestore for Admin Data\n');
        
        // Check if any admin_uids_v1 document already exists
        const adminUidsDoc = await db.collection('app_settings').doc('admin_uids_v1').get();
        if (adminUidsDoc.exists) {
            console.log('✅ admin_uids_v1 document already exists in Firestore!');
            console.log(JSON.stringify(adminUidsDoc.data(), null, 2));
        } else {
            console.log('❌ admin_uids_v1 document does NOT exist yet (normal for fresh setup)\n');
        }
        
        // Check for any user_permissions collection
        console.log('\n🔍 STEP 3: Checking for user_permissions collection\n');
        
        const permissionsSnapshot = await db.collection('user_permissions').limit(100).get();
        
        if (!permissionsSnapshot.empty) {
            console.log(`Found ${permissionsSnapshot.size} documents in user_permissions collection:\n`);
            
            const adminsInPermissions = [];
            
            permissionsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.admin_panel || data.roles?.includes('admin')) {
                    adminsInPermissions.push({
                        uid: doc.id,
                        permissions: data
                    });
                }
            });
            
            if (adminsInPermissions.length > 0) {
                console.log(`Found ${adminsInPermissions.length} user(s) with admin permissions:\n`);
                adminsInPermissions.forEach((admin, index) => {
                    console.log(`${index + 1}. UID: ${admin.uid}`);
                    console.log(`   Permissions: ${JSON.stringify(admin.permissions, null, 2)}\n`);
                });
            }
        } else {
            console.log('❌ user_permissions collection does NOT exist.\n');
        }
        
        console.log('\n========================================');
        console.log('SUMMARY - MIGRATION PLAN');
        console.log('========================================\n');
        
        const allAdminUids = [
            ...new Set([
                ...adminsWithClaims.map(a => a.uid),
                // Add any from other sources
            ])
        ];
        
        console.log(`✅ Total unique admin users identified: ${allAdminUids.length}`);
        console.log('\nAdmin UIDs to migrate to database:');
        allAdminUids.forEach((uid, index) => {
            console.log(`  ${index + 1}. ${uid}`);
        });
        
        console.log(`\n⚠️  CRITICAL: These UIDs must be preserved in admin_uids_v1 document`);
        console.log(`            or they will LOSE admin access after deployment!\n`);
        
        console.log('========================================');
        console.log('NEXT STEPS (Phase 1)');
        console.log('========================================\n');
        console.log('1. Review the admin UIDs listed above');
        console.log('2. Confirm they match actual admin users');
        console.log('3. Run: node create-admin-uids-seed.js');
        console.log('4. Verify with: node verify-admin-uids.js\n');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during audit:', error);
        process.exit(1);
    }
}

auditCurrentAdmins();
