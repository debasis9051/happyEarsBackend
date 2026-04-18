/**
 * Salesperson Model — Firestore data access for the `salespersons` collection.
 * All methods are wrapped by wrapStaticMethods for uniform error logging + re-throw.
 */
const wrapStaticMethods = require("../wrapStaticMethods")
const admin = require("../firebaseAdmin");
const cache = require("../utils/cache");

class Salesperson {

    /** Returns all salespersons ordered alphabetically by name. */
    static async get_salesperson_list() {
        // console.log("getting salesperson list")

        const cached = cache.get('salesperson-list');
        if (cached) {
            return cached;
        }

        let q = admin.firestore().collection('salespersons').orderBy("salesperson_name")
        let qs = await q.get()
        const result = qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
        cache.set('salesperson-list', result, 300);
        return result
    }

    /** Creates a new salesperson document and returns its reference. */
    static async add_salesperson(current_user_uid, current_user_name, body_data) {
        let salesperson_ref = await admin.firestore().collection('salespersons').add({
            salesperson_name: body_data.salesperson_name,

            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
        });

        return salesperson_ref
    }
}

module.exports = wrapStaticMethods(Salesperson);
