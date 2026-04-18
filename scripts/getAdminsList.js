/**
 * getAdminsList.js
 * 
 * Utility script to fetch all admins from database with their UIDs and display names
 * Usage: node scripts/getAdminsList.js
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin
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

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.default_bucket
    });
} catch (error) {
    // App already initialized
    if (!error.message.includes('already exists')) {
        throw error;
    }
}

const db = admin.firestore();
const auth = admin.auth();

async function getAdminsList() {
    try {
        console.log('\n📋 Fetching Admin List from Database...\n');
        
        // Get admin UIDs from Firestore
        const docRef = db.collection('app_settings').doc('admin_uids_v1');
        const doc = await docRef.get();

        if (!doc.exists) {
            console.log('❌ No admin list found in database');
            return;
        }

        const adminData = doc.data();
        const adminUids = adminData.authorized_admin_uids || [];
        
        if (adminUids.length === 0) {
            console.log('⚠️  No admins configured yet');
            return;
        }

        console.log(`✅ Found ${adminUids.length} admin(s)\n`);
        console.log('═'.repeat(80));

        // Fetch each admin's details from Auth
        const adminDetails = [];
        
        for (const uid of adminUids) {
            try {
                const user = await auth.getUser(uid);
                adminDetails.push({
                    uid: uid,
                    name: user.displayName || '(No name set)',
                    email: user.email,
                    emailVerified: user.emailVerified,
                    createdAt: user.metadata?.creationTime,
                });
            } catch (error) {
                console.error(`⚠️  Error fetching details for UID ${uid}:`, error.message);
                adminDetails.push({
                    uid: uid,
                    name: '(User not found)',
                    email: '(N/A)',
                    error: error.message
                });
            }
        }

        // Display formatted table
        console.log('\n🔐 ADMIN ACCOUNTS\n');
        adminDetails.forEach((admin, index) => {
            console.log(`${index + 1}. Name: ${admin.name}`);
            console.log(`   UID:   ${admin.uid}`);
            console.log(`   Email: ${admin.email}`);
            if (admin.createdAt) {
                console.log(`   Created: ${new Date(admin.createdAt).toLocaleDateString()}`);
            }
            console.log('');
        });

        console.log('═'.repeat(80));
        console.log(`\n✅ Total Admins: ${adminDetails.length}\n`);

        // Display database metadata
        if (adminData.updated_at) {
            console.log(`Last Updated: ${new Date(adminData.updated_at).toLocaleString()}`);
            console.log(`Updated By: ${adminData.updated_by_name} (${adminData.updated_by_uid})\n`);
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        // Close database connection
        await db.terminate();
        process.exit(0);
    }
}

// Run the script
getAdminsList();
