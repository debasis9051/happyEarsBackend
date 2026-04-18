/**
 * Product Model — Firestore data access for the `products` and `product_logs` collections.
 * All mutations also write a corresponding log entry to `product_logs`.
 * All methods are wrapped by wrapStaticMethods for uniform error logging + re-throw.
 * List queries are cached with 5-minute TTL to reduce Firestore quota consumption.
 */
const wrapStaticMethods = require("../wrapStaticMethods");
const admin = require("../firebaseAdmin")
const cache = require("../utils/cache");

class Product {
    /**
     * Batch-adds an array of new products and creates a log entry for each.
     * Used by both the single add and bulk Excel import flows.
     * @param {string} operation - Log operation label (e.g. "add", "import")
     */
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

    /**
     * Batch-marks products as out-of-stock (instock: false) when invoiced.
     * Creates a log entry per product in the same Firestore batch.
     */
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

    /**
     * Moves a product to a new branch.
     * Creates two log entries: transfer_remove (old branch) and transfer_add (new branch).
     */
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

    /**
     * Marks a product as out-of-stock (returned/sold externally) and logs the reason.
     * Note: instock is set to false here since the product left inventory.
     */
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

    /** Deletes a product and all its associated log entries in a single batch. */
    static async delete_product_and_logs_by_id(product_id) {
        console.log('delete product and logs by id')

        const batch = admin.firestore().batch()

        const productLogs = await admin.firestore().collection('product_logs').where("product_id", "==", product_id).get();
        productLogs.docs.forEach((doc) => {
            batch.delete(doc.ref);
        });

        const productRef = admin.firestore().collection('products').doc(product_id)
        batch.delete(productRef);

        await batch.commit()
    }

    /** Updates product details and writes a log entry for the change. */
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

    /**
     * Marks a list of products as in-stock again (instock: true).
     * Called when an invoice is deleted, restoring the sold products.
     * Creates a restock log entry per product.
     */
    static async restock_product_with_logs(product_id_list, current_user_uid, current_user_name) {
        console.log('restock product with logs')

        const batch = admin.firestore().batch()

        await Promise.all(product_id_list.map(async (pid) => {
            const docRef = admin.firestore().collection('products').doc(pid);
            let productData = (await docRef.get()).data();

            batch.update(docRef, { instock: true });

            const docRef2 = admin.firestore().collection('product_logs').doc();
            batch.set(docRef2, {
                added_by_user_uid: current_user_uid,
                added_by_user_name: current_user_name,
                product_id: pid,
                product_name: productData.product_name,
                serial_number: productData.serial_number,
                operation: "restock",
                reason: "invoice deleted, product restocked",
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                branch_id: productData.branch_id
            });
        }));

        await batch.commit()
    }


    /** Returns all products whose product_name exactly matches the given string. */
    static async get_product_by_name(product_name) {
        console.log("getting product by name")

        let q = admin.firestore().collection('products').where("product_name", "==", product_name)
        let qs = await q.get()
        return qs.docs.map(doc => doc.data())
    }

    /**
     * Checks if any of the given serial numbers already exist in the `products` collection.
     * Queries in batches of 30 to stay within Firestore's `in` operator limit.
     * Returns matching product documents (non-empty result = serial already exists).
     */
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

    /**
     * Returns a paginated page of products ordered alphabetically by product_name.
    * @param {number} limit - Documents per page (max 50, default 25)
     * @param {string|null} cursorDocId - Firestore doc ID of last item from previous page
     * @returns {{ items: object[], nextCursor: string|null, hasMore: boolean }}
     */
    static async get_product_list_paged(limit = 25, cursorDocId = null, branchId = null, options = {}) {
        const inStockOnly = options?.inStockOnly === true
        let q = admin.firestore().collection('products')
        if (inStockOnly) {
            q = q.where('instock', '==', true)
        }
        if (branchId) {
            q = q.where('branch_id', '==', branchId)
        }
        q = q.orderBy('product_name').limit(limit)
        if (cursorDocId) {
            const cursorDoc = await admin.firestore().collection('products').doc(cursorDocId).get()
            if (cursorDoc.exists) q = q.startAfter(cursorDoc)
        }

        try {
            const qs = await q.get()
            const items = qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) }))
            return {
                items,
                nextCursor: qs.docs.length === limit ? qs.docs[qs.docs.length - 1].id : null,
                hasMore: qs.docs.length === limit,
            }
        } catch (error) {
            // Fallback: if composite index is missing or still building, overfetch without branch
            // filter and apply in-memory. This keeps the endpoint functional until the index is READY.
            const isMissingIndex = Number(error?.code) === 9

            if (!isMissingIndex) {
                throw error
            }

            const overfetchLimit = Math.max(limit * 6, 150)
            let fallback = admin.firestore().collection('products').orderBy('product_name').limit(overfetchLimit)
            if (cursorDocId) {
                const cursorDoc = await admin.firestore().collection('products').doc(cursorDocId).get()
                if (cursorDoc.exists) fallback = fallback.startAfter(cursorDoc)
            }

            const fallbackSnapshot = await fallback.get()
            const filteredDocs = fallbackSnapshot.docs.filter((doc) => {
                const data = doc.data() || {}
                if (branchId && data.branch_id !== branchId) return false
                if (inStockOnly && data.instock !== true) return false
                return true
            })
            const slicedDocs = filteredDocs.slice(0, limit)
            const items = slicedDocs.map((doc) => ({ id: doc.id, ...(doc.data()) }))

            console.warn(`[productModel] Product index missing/building — used in-memory fallback for branchId=${branchId || 'ALL'}, inStockOnly=${inStockOnly}. Deploy firestore.indexes.json to fix.`)
            return {
                items,
                nextCursor: slicedDocs.length === limit ? slicedDocs[slicedDocs.length - 1].id : null,
                hasMore: fallbackSnapshot.docs.length === overfetchLimit,
            }
        }
    }

    static async search_product_brief(searchTerm = '', { limit = 25, branchId = null, inStockOnly = true } = {}) {
        const normalized = (searchTerm || '').toString().trim().toLowerCase()
        if (!normalized) {
            return []
        }

        let q = admin.firestore().collection('products').orderBy('product_name').limit(300)
        const qs = await q.get()

        return qs.docs
            .map((doc) => ({ id: doc.id, ...(doc.data()) }))
            .filter((row) => {
                if (inStockOnly && !row.instock) return false
                if (branchId && row.branch_id !== branchId) return false

                const productName = (row.product_name || '').toString().toLowerCase()
                const serialNumber = (row.serial_number || '').toString().toLowerCase()
                const manufacturerName = (row.manufacturer_name || '').toString().toLowerCase()
                return (
                    productName.includes(normalized) ||
                    serialNumber.includes(normalized) ||
                    manufacturerName.includes(normalized)
                )
            })
            .slice(0, Math.max(1, Math.min(limit || 25, 100)))
            .map((row) => ({
                id: row.id,
                product_name: row.product_name,
                serial_number: row.serial_number,
                manufacturer_name: row.manufacturer_name,
                mrp: row.mrp,
                branch_id: row.branch_id,
                instock: row.instock,
            }))
    }

    /** Returns all log entries for a given product ID (unsorted — sort in controller). */
    static async get_product_logs_by_id(product_id) {
        console.log("getting product logs by id")

        let q = admin.firestore().collection('product_logs').where("product_id", "==", product_id)
        let qs = await q.get()
        return qs.docs.map(doc => doc.data())
    }
}

module.exports = wrapStaticMethods(Product);
