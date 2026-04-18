/**
 * adminUidModel.js - Admin UID Management Layer
 * 
 * PHASE 1 of B+C Security Implementation
 * Manages the authoritative admin UID whitelist in Firestore
 * 
 * This model provides:
 * - Get/add/remove admin UIDs
 * - Database-driven authorization
 * - Audit trail for changes
 * - Fallback to environment defaults
 */

const admin = require('firebase-admin');
const db = admin.firestore();

const COLLECTION = 'app_settings';
const DOC_ID = 'admin_uids_v1';

module.exports = {
    /**
     * Get all authorized admin UIDs from database
     * Serves as the authoritative source for admin access
     * 
     * @returns {Object} { uids: [], source: 'database'|'environment', updated_at?, updated_by? }
     */
    async getAdminUidList() {
        try {
            const docRef = db.collection(COLLECTION).doc(DOC_ID);
            const doc = await docRef.get();

            if (doc.exists) {
                const data = doc.data();
                return {
                    uids: data.authorized_admin_uids || [],
                    source: 'database',
                    updated_at: data.updated_at,
                    updated_by_uid: data.updated_by_uid,
                    updated_by_name: data.updated_by_name,
                    total_admins: (data.authorized_admin_uids || []).length
                };
            } else {
                // Database document should always be initialized during setup
                console.warn('Admin UIDs document not found in Firestore. Run initialization script.');
                return {
                    uids: [],
                    source: 'database',
                    message: 'Admin UIDs document not initialized',
                    total_admins: 0
                };
            }
        } catch (error) {
            console.error('Error fetching admin UIDs from Firestore:', error);
            throw new Error(`Failed to retrieve admin UIDs: ${error.message}`);
        }
    },

    /**
     * Check if a specific UID is authorized as admin
     * 
     * @param {string} uid - Firebase UID to check
     * @returns {Promise<boolean>}
     */
    async isAdminUid(uid) {
        if (!uid || typeof uid !== 'string') {
            return false;
        }
        
        const adminList = await this.getAdminUidList();
        return adminList.uids.includes(uid);
    },

    /**
     * Initialize admin_uids_v1 document in Firestore
     * USE ONLY DURING PHASE 2 (Seeding)
     * 
     * @param {Array} uidsToSeed - Array of UIDs to seed
     * @returns {Promise<Object>}
     */
    async initializeAdminUidDocument(uidsToSeed = DEFAULT_ADMIN_UIDS) {
        try {
            const docRef = db.collection(COLLECTION).doc(DOC_ID);
            const now = admin.firestore.Timestamp.now();

            // Check if document already exists
            const existingDoc = await docRef.get();
            if (existingDoc.exists) {
                return {
                    success: false,
                    message: 'Document already exists. Use addAdminUid() to add more UIDs.',
                    current_uids: existingDoc.data().authorized_admin_uids
                };
            }

            // Create new document with seeded UIDs
            await docRef.set({
                authorized_admin_uids: uidsToSeed,
                created_at: now,
                updated_at: now,
                updated_by_uid: 'system-seed',
                updated_by_name: 'System Initialization',
                last_change: `Seeded with ${uidsToSeed.length} admin UIDs`,
                source: 'database'
            });

            console.log(`✅ Created ${DOC_ID} with ${uidsToSeed.length} admin UIDs`);

            return {
                success: true,
                message: 'Admin UID document initialized successfully',
                seeded_uids: uidsToSeed,
                count: uidsToSeed.length
            };
        } catch (error) {
            console.error('Error initializing admin UID document:', error);
            throw error;
        }
    },

    /**
     * Add a user to admin UID list
     * Only called by super_admin role
     * 
     * @param {string} uidToAdd - UID to add
     * @param {string} addedByUid - UID of user making the change
     * @param {string} addedByName - Name of user making the change
     * @returns {Promise<Array>} Updated admin UID list
     */
    async addAdminUid(uidToAdd, addedByUid, addedByName) {
        if (!uidToAdd || typeof uidToAdd !== 'string') {
            throw new Error('Invalid UID format');
        }

        const docRef = db.collection(COLLECTION).doc(DOC_ID);
        const now = admin.firestore.Timestamp.now();

        return db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            
            if (!doc.exists) {
                throw new Error(
                    `${DOC_ID} document not initialized. Run: node create-admin-uids-seed.js`
                );
            }

            const currentUids = doc.data().authorized_admin_uids || [];

            if (currentUids.includes(uidToAdd)) {
                throw new Error(`UID ${uidToAdd} is already authorized`);
            }

            const updatedUids = [...currentUids, uidToAdd];

            const updateData = {
                authorized_admin_uids: updatedUids,
                updated_at: now,
                updated_by_uid: addedByUid,
                updated_by_name: addedByName,
                last_change: `Added ${uidToAdd}`
            };

            transaction.update(docRef, updateData);

            console.log(`✅ Added ${uidToAdd} to admin list by ${addedByName}`);

            return updatedUids;
        });
    },

    /**
     * Remove a user from admin UID list
     * Only called by super_admin role
     * 
     * @param {string} uidToRemove - UID to remove
     * @param {string} removedByUid - UID of user making the change
     * @param {string} removedByName - Name of user making the change
     * @returns {Promise<Array>} Updated admin UID list
     */
    async removeAdminUid(uidToRemove, removedByUid, removedByName) {
        if (!uidToRemove || typeof uidToRemove !== 'string') {
            throw new Error('Invalid UID format');
        }

        const docRef = db.collection(COLLECTION).doc(DOC_ID);
        const now = admin.firestore.Timestamp.now();

        return db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            
            if (!doc.exists) {
                throw new Error(`${DOC_ID} document not found`);
            }

            const currentUids = doc.data().authorized_admin_uids || [];

            if (!currentUids.includes(uidToRemove)) {
                throw new Error(`UID ${uidToRemove} is not currently authorized`);
            }

            // Don't allow removing the last admin
            if (currentUids.length === 1) {
                throw new Error('Cannot remove the last admin. At least one admin required.');
            }

            const updatedUids = currentUids.filter(u => u !== uidToRemove);

            const updateData = {
                authorized_admin_uids: updatedUids,
                updated_at: now,
                updated_by_uid: removedByUid,
                updated_by_name: removedByName,
                last_change: `Removed ${uidToRemove}`
            };

            transaction.update(docRef, updateData);

            console.log(`✅ Removed ${uidToRemove} from admin list by ${removedByName}`);

            return updatedUids;
        });
    },

    /**
     * Get full audit history of admin UID changes
     * 
     * @returns {Promise<Object>}
     */
    async getAuditHistory() {
        try {
            const doc = await db.collection(COLLECTION).doc(DOC_ID).get();
            if (doc.exists) {
                const data = doc.data();
                return {
                    created_at: data.created_at,
                    updated_at: data.updated_at,
                    updated_by_uid: data.updated_by_uid,
                    updated_by_name: data.updated_by_name,
                    last_change: data.last_change,
                    total_admins: (data.authorized_admin_uids || []).length
                };
            }
            return null;
        } catch (error) {
            console.error('Error getting audit history:', error);
            return null;
        }
    },

    /**
     * Get default admin UIDs from environment
     * Used only for reference/comparison
     * 
     * @returns {Array}
     */
    getDefaultAdminUids() {
        return DEFAULT_ADMIN_UIDS;
    }
};
