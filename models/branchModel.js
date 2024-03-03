const admin = require("../firebaseAdmin")

class Branch {

    static async get_branch_list() {
        // console.log("getting branch list")

        let q = admin.firestore().collection('branches').orderBy("branch_name")
        let qs = await q.get()
        return qs.docs.map(doc => ({id: doc.id, ...(doc.data())}))
    }

    static async add_branch(current_user_uid,current_user_name,body_data) {
        console.log('adding branch')

        let branch_ref = await admin.firestore().collection('branches').add({
            branch_name: body_data.branch_name,
            branch_invoice_code: body_data.branch_invoice_code,

            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
        });

        return branch_ref
    }

    static async get_branch_invoice_code_by_id(branch_id) {
        console.log("getting branch invoice code by id")

        let q = admin.firestore().collection('branches').doc(branch_id)
        let doc = await q.get()
        return (doc.data()).branch_invoice_code
    }
}

module.exports = Branch;
