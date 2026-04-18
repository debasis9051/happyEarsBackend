/**
 * Branch Model — Firestore data access for the `branches` collection.
 * All methods are wrapped by wrapStaticMethods for uniform error logging + re-throw.
 */
const wrapStaticMethods = require("../wrapStaticMethods")
const admin = require("../firebaseAdmin");
const cache = require("../utils/cache");

class Branch {

    /** Returns all branches ordered alphabetically by name. */
    static async get_branch_list() {
        // console.log("getting branch list")

        const cached = cache.get('branch-list');
        if (cached) {
            return cached;
        }

        let q = admin.firestore().collection('branches').orderBy("branch_name").limit(100)
        let qs = await q.get()
        const result = qs.docs.map(doc => ({id: doc.id, ...(doc.data())}))
        cache.set('branch-list', result, 300);
        return result
    }

    /** Creates a new branch document and returns its reference. */
    static async add_branch(current_user_uid,current_user_name,body_data) {
        let branch_ref = await admin.firestore().collection('branches').add({
            branch_name: body_data.branch_name,
            branch_invoice_code: body_data.branch_invoice_code,

            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
        });

        return branch_ref
    }

    /** Returns the branch_invoice_code string for a given branch ID (used for invoice number generation). */
    static async get_branch_invoice_code_by_id(branch_id) {
        let q = admin.firestore().collection('branches').doc(branch_id)
        let doc = await q.get()
        return (doc.data()).branch_invoice_code
    }
}

module.exports = wrapStaticMethods(Branch);
