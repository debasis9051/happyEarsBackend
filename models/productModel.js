const admin = require("../firebaseAdmin")

class Product {
    static async add_batch_products_with_logs(product_array, current_user_uid, current_user_name, operation, reason) {
        console.log('adding batch products with logs')

        const batch = admin.firestore().batch()

        product_array.forEach((p) => {
            const docRef = admin.firestore().collection('products').doc();
            batch.set(docRef, {
                product_name: p.product_name,
                manufacturer_name: p.manufacturer_name,
                mrp: p.mrp,
                serial_number: p.serial_number,
                instock: true,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                branch_id: p.branch_id
            });

            const docRef2 = admin.firestore().collection('product_logs').doc();
            batch.set(docRef2, {
                added_by_user_uid: current_user_uid,
                added_by_user_name: current_user_name,
                product_id: docRef.id,
                product_name: p.product_name,
                serial_number: p.serial_number,
                operation: operation,
                reason: reason,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                branch_id: p.branch_id
            });
        })

        await batch.commit()
    }

    static async invoice_batch_products_with_logs(product_array, current_user_uid, current_user_name, operation, reason, branch_id) {
        console.log('invoicing batch products with logs')

        const batch = admin.firestore().batch()

        product_array.forEach((p) => {
            const docRef = admin.firestore().collection('products').doc(p.product_id);
            batch.update(docRef, { instock: false });

            const docRef2 = admin.firestore().collection('product_logs').doc();
            batch.set(docRef2, {
                added_by_user_uid: current_user_uid,
                added_by_user_name: current_user_name,
                product_id: docRef.id,
                product_name: p.product_name,
                serial_number: p.serial_number,
                operation: operation,
                reason: reason,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                branch_id: branch_id
            });
        })

        await batch.commit()
    }

    static async transfer_product_with_logs(bodyData, current_user_uid, current_user_name) {
        console.log('transfer product with logs')

        const docRef = admin.firestore().collection('products').doc(bodyData.product_id);
        let qs = await docRef.get()
        let pd = qs.data()

        const batch = admin.firestore().batch()

        batch.update(docRef, { branch_id: bodyData.branch_id });

        const docRef2 = admin.firestore().collection('product_logs').doc();
        batch.set(docRef2, {
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
            product_id: bodyData.product_id,
            product_name: pd.product_name,
            serial_number: pd.serial_number,
            operation: "transfer_remove",
            reason: "product transferred",
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            branch_id: pd.branch_id
        });

        const docRef3 = admin.firestore().collection('product_logs').doc();
        batch.set(docRef3, {
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
            product_id: bodyData.product_id,
            product_name: pd.product_name,
            serial_number: pd.serial_number,
            operation: "transfer_add",
            reason: "product transferred",
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            branch_id: bodyData.branch_id
        });

        await batch.commit()
    }

    static async return_product_with_logs(bodyData, current_user_uid, current_user_name) {
        console.log('return product with logs')

        const docRef = admin.firestore().collection('products').doc(bodyData.product_id);
        let qs = await docRef.get()
        let pd = qs.data()

        const batch = admin.firestore().batch()

        batch.update(docRef, { instock: false });

        const docRef3 = admin.firestore().collection('product_logs').doc();
        batch.set(docRef3, {
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
            product_id: bodyData.product_id,
            product_name: pd.product_name,
            serial_number: pd.serial_number,
            operation: "returned",
            reason: bodyData.reason,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            branch_id: pd.branch_id
        });

        await batch.commit()
    }

    static async update_product_with_logs(bodyData, current_user_uid, current_user_name) {
        console.log('updating product with logs')

        await admin.firestore().collection('products').doc(bodyData.product_id).update({
            product_name: bodyData.product_name,
            manufacturer_name: bodyData.manufacturer,
            mrp: bodyData.mrp,
            serial_number: bodyData.serial_number,
        });

        await admin.firestore().collection('product_logs').add({
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
            product_id: bodyData.product_id,
            product_name: bodyData.product_name,
            serial_number: bodyData.serial_number,
            operation: "update",
            reason: "product updated",
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            branch_id: bodyData.branch_id
        });
    }


    static async get_product_by_name(product_name) {
        console.log("getting product by name")

        let q = admin.firestore().collection('products').where("product_name", "==", product_name)
        let qs = await q.get()
        return qs.docs.map(doc => doc.data())
    }

    static async are_serials_in_stock(serial_array) {
        console.log("are serials in stock")

        let p_arr = [];
        for (let k = 0; k < serial_array.length; k += 30) {
            p_arr.push(new Promise(async (res) => {
                let seg = serial_array.slice(k, k + 30)
                let q = admin.firestore().collection('products').where("serial_number", "in", seg)
                let qs = await q.get()
                res(qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) })))
            }))
        }
        let t = await Promise.all(p_arr)

        return t.flat()
    }

    static async get_product_list() {
        // console.log("getting product list")

        let q = admin.firestore().collection('products').orderBy("product_name")
        let qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
    }

    static async get_product_logs_by_id(product_id) {
        console.log("getting product logs by id")

        let q = admin.firestore().collection('product_logs').where("product_id", "==", product_id)
        let qs = await q.get()
        return qs.docs.map(doc => doc.data())
    }
}

module.exports = Product;
