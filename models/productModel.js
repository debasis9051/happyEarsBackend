const admin = require("../firebaseAdmin")

class Product {
    static async create_product(product_name, manufacturer_name, mrp, product_type) {
        console.log('creating product')

        let pd_ref = await admin.firestore().collection('products').add({
            product_name: product_name,
            manufacturer_name: manufacturer_name,
            mrp: mrp,
            product_type: product_type,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        return pd_ref.id
    }

    static async create_serials(product_id, serial_array) {
        console.log('creating serials')

        const batch = admin.firestore().batch()

        serial_array.forEach((s) => {
            const docRef = admin.firestore().collection('serials').doc();
            batch.set(docRef, {
                product_id: product_id,
                serial_number: s,
                instock: true,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        })

        await batch.commit()
    }

    static async add_product_log(current_user_uid, current_user_name, product_id, product_name, operation, reason, serial_in, serial_out) {
        console.log('adding product log')

        await admin.firestore().collection('product_logs').add({
            current_user_uid: current_user_uid,
            current_user_name: current_user_name,
            product_id: product_id,
            product_name: product_name,
            operation: operation,
            reason: reason,
            serial_in: serial_in,
            serial_out: serial_out,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
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

        let q = admin.firestore().collection('serials').where("serial_number", "in", serial_array)
        let qs = await q.get()
        return qs.docs.map(doc => doc.data())
    }
}

module.exports = Product;
