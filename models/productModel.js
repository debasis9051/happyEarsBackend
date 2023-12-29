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
            });

            const docRef2 = admin.firestore().collection('product_logs').doc();
            batch.set(docRef2, {
                current_user_uid: current_user_uid,
                current_user_name: current_user_name,
                product_id: docRef.id,
                product_name: p.product_name,
                serial_number: p.serial_number,
                operation: operation,
                reason: reason,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        })

        await batch.commit()
    }

    static async get_product_by_name(product_name) {
        console.log("getting product by name")

        let q = admin.firestore().collection('products').where("product_name", "==", product_name)
        let qs = await q.get()
        return qs.docs.map(doc => doc.data())
    }

    static async are_serials_in_stock(serial_array) {
        console.log("are serials in stock")

        let q = admin.firestore().collection('products').where("serial_number", "in", serial_array)
        let qs = await q.get()
        return qs.docs.map(doc => doc.data())
    }

    static async get_product_list() {
        // console.log("getting product list")

        let q = admin.firestore().collection('products').orderBy("product_name")
        let qs = await q.get()
        return qs.docs.map(doc => ({id: doc.id, ...(doc.data())}))
    }
}

module.exports = Product;
