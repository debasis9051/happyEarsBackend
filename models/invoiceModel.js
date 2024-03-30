const admin = require("../firebaseAdmin")

const moment = require("moment")

class Invoice {
    static async get_invoice_count_by_branch_id_and_date(branch_id, date) {
        // console.log("get invoice count by branch id and date")

        let f = new Date(moment(date).startOf("month").format("YYYY-MM-DD"))
        let l = new Date(moment(date).endOf("month").format("YYYY-MM-DD"))

        let q = admin.firestore().collection('invoices').where("date", ">=", f).where("date", "<=", l)
        let qs = await q.get()
        let t = qs.docs.map(doc => doc.data())
        t = t.filter(x => x.branch_id === branch_id)

        return t.length
    }

    static async get_invoice_by_invoice_id(invoice_id) {
        console.log("getting invoice by invoice id")

        let q = admin.firestore().collection('invoices').doc(invoice_id)
        let doc = await q.get()
        return doc.data()
    }

    static async get_invoice_by_invoice_number(invoice_number) {
        console.log("getting invoice by invoice number")

        let q = admin.firestore().collection('invoices').where("invoice_number", "==", invoice_number)
        let qs = await q.get()
        return qs.docs.map(doc => doc.data())
    }

    static async get_invoice_list() {
        // console.log("getting invoice list")

        let q = admin.firestore().collection('invoices').orderBy("invoice_number")
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }

    static async add_invoice(current_user_uid, current_user_name, body_data) {
        console.log('adding invoice')

        let invoice_ref = await admin.firestore().collection('invoices').add({
            patient_name: body_data.patient_name,
            patient_address: body_data.patient_address,
            contact_number: body_data.contact_number,
            branch_id: body_data.branch_id,
            invoice_number: body_data.invoice_number,
            date: new Date(body_data.date),
            mode_of_payment: body_data.mode_of_payment,
            salesperson_id: body_data.salesperson_id,
            discount_amount: body_data.discount_amount,
            line_items: body_data.line_items,
            accessory_items: body_data.accessory_items,

            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
        });

        return invoice_ref
    }

    static async update_invoice(body_data) {
        console.log('updating invoice')

        await admin.firestore().collection('invoices').doc(body_data.invoice_id).update({
            patient_name: body_data.patient_name,
            patient_address: body_data.patient_address,
            contact_number: body_data.contact_number,
            date: new Date(body_data.date),
            mode_of_payment: body_data.mode_of_payment,
            salesperson_id: body_data.salesperson_id,
            discount_amount: body_data.discount_amount,
            accessory_items: body_data.accessory_items
        });
    }
}

module.exports = Invoice;
