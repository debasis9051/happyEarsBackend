/**
 * User Model — Firestore data access for the `users` collection.
 * All methods are wrapped by wrapStaticMethods for uniform error logging + re-throw.
 * List queries are cached with 5-minute TTL to reduce Firestore quota consumption.
 */
const wrapStaticMethods = require("../wrapStaticMethods");
const admin = require("../firebaseAdmin");
const cache = require("../utils/cache");

class User {
    /**
     * Creates a new user document in Firestore with default (all-false) auth_access.
     * Throws if a user with the same UID already exists.
     */
    static async create(user_uid, user_name, user_email, user_photo) {
        const userRef = admin.firestore().collection('users').doc(user_uid);
        const existingUser = await userRef.get();

        if (existingUser.exists) {
            throw new Error(`User with UID "${user_uid}" already exists.`);
        }

        await userRef.set({
            user_name: user_name,
            user_email: user_email,
            user_photo: user_photo,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            auth_access: {
                admin_panel: false,
                audiometry: false,
                generate_invoice: false,
                inventory: false,
                sales_report: false,
                patients: false,
                service: false,
            }
        });

        cache.invalidate('user-list');
    }

    /** Returns a user document by UID, or null if not found. */
    static async get(user_uid) {
        // console.log("getting user")

        if (!user_uid || typeof user_uid !== 'string' || user_uid.trim() === '') {
            return null;
        }

        let s = await admin.firestore().collection('users').doc(user_uid).get()

        if (s.exists) {
            return s.data()
        } else {
            return null
        }
    }

    /** Returns all user documents ordered alphabetically by user_name. Cached for 5 mins. */
    static async get_user_list() {
        // console.log("getting user list")

        // Check cache first
        const cached = cache.get('user-list');
        if (cached) {
            return cached;
        }

        let q = admin.firestore().collection('users').orderBy("user_name")
        let qs = await q.get()
        const result = qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
        
        // Cache for 5 minutes
        cache.set('user-list', result, 300);
        return result;
    }

    /** Overwrites the auth_access map for a given user document. */
    static async update_user_access(body_data) {
        await admin.firestore().collection('users').doc(body_data.user_id).update({
            auth_access: body_data.user_access
        });

        cache.invalidate('user-list');
    }

    /** Returns total users that currently have admin_panel access enabled. */
    static async get_admin_user_count() {
        const qs = await admin.firestore().collection('users').where('auth_access.admin_panel', '==', true).get();
        return qs.size;
    }
}

module.exports = wrapStaticMethods(User);