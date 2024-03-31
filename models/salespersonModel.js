const admin = require("../firebaseAdmin")

class Salesperson {

    static async get_salesperson_list() {
        // console.log("getting salesperson list")

        let q = admin.firestore().collection('salespersons').orderBy("salesperson_name")
        let qs = await q.get()
        return qs.docs.map(doc => ({id: doc.id, ...(doc.data())}))
    }

    static async add_salesperson(current_user_uid,current_user_name,body_data) {
        console.log('adding salesperson')

        let salesperson_ref = await admin.firestore().collection('salespersons').add({
            salesperson_name: body_data.salesperson_name,

            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
        });

        return salesperson_ref
    }

    static async test() {
        console.log('custom script')

        // let salesperson_ref = await admin.firestore().collection('salespersons').add({
        //     salesperson_name: body_data.salesperson_name,

        //     created_at: admin.firestore.FieldValue.serverTimestamp(),
        //     added_by_user_uid: current_user_uid,
        //     added_by_user_name: current_user_name,
        // });

        // return salesperson_ref
    }
}

module.exports = Salesperson;
