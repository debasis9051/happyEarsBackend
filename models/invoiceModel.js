/**
 * Invoice Model — Firestore data access for the `invoices` collection.
 * All methods are wrapped by wrapStaticMethods for uniform error logging + re-throw.
 * List queries are cached with 5-minute TTL to reduce Firestore quota consumption.
 */
const wrapStaticMethods = require("../wrapStaticMethods")
const admin = require("../firebaseAdmin")
const cache = require("../utils/cache")

const moment = require("moment")

class Invoice {
    /**
     * Returns the number of invoices in a given branch for the calendar month containing `date`.
     * Used to compute the next sequential invoice number.
     */
    static async get_invoice_count_by_branch_id_and_date(branch_id, date, ownerUid = null) {
        // console.log("get invoice count by branch id and date")

        let f = new Date(moment(date).startOf("month").format("YYYY-MM-DD"))
        let l = new Date(moment(date).endOf("month").format("YYYY-MM-DD"))

        let q = admin.firestore().collection('invoices').where("date", ">=", f).where("date", "<=", l)
        let qs = await q.get()
        let t = qs.docs.map(doc => doc.data())
        t = t.filter(x => x.branch_id === branch_id)
        if (ownerUid) {
            t = t.filter(x => x.added_by_user_uid === ownerUid)
        }

        return t.length
    }

    /** Returns a single invoice document by its Firestore document ID. */
    static async get_invoice_by_invoice_id(invoice_id, ownerUid = null) {
        console.log("getting invoice by invoice id")

        let q = admin.firestore().collection('invoices').doc(invoice_id)
        let doc = await q.get()
        if (!doc.exists) {
            return null
        }
        const data = doc.data()
        if (ownerUid && data.added_by_user_uid !== ownerUid) {
            return null
        }
        return data
    }

    /** Returns all invoices matching a given invoice_number (should be max 1). */
    static async get_invoice_by_invoice_number(invoice_number, ownerUid = null) {
        console.log("getting invoice by invoice number")

        let q = admin.firestore().collection('invoices').where("invoice_number", "==", invoice_number)
        let qs = await q.get()
        let result = qs.docs.map(doc => doc.data())
        if (ownerUid) {
            result = result.filter(x => x.added_by_user_uid === ownerUid)
        }
        return result
    }

    /**
     * Saves a new invoice document.
     * Also stores a denormalized `product_ids` array for efficient product-association queries.
     */
    static async add_invoice(current_user_uid, current_user_name, body_data) {
        console.log('adding invoice')

        let invoice_ref = await admin.firestore().collection('invoices').add({
            branch_id: body_data.branch_id,
            date: new Date(body_data.date),
            patient_id: body_data.patient_id,
            invoice_number: body_data.invoice_number,
            mode_of_payment: body_data.mode_of_payment,
            salesperson_id: body_data.salesperson_id,
            discount_amount: body_data.discount_amount,
            line_items: body_data.line_items,
            product_ids: body_data.line_items.map(x => x.product_id),
            accessory_items: body_data.accessory_items,

            created_at: admin.firestore.FieldValue.serverTimestamp(),
            added_by_user_uid: current_user_uid,
            added_by_user_name: current_user_name,
        });

        return invoice_ref
    }

    /** Updates editable fields on an existing invoice (date, payment, salesperson, discount, accessories). */
    static async update_invoice(body_data) {
        console.log('updating invoice')

        await admin.firestore().collection('invoices').doc(body_data.invoice_id).update({
            date: new Date(body_data.date),
            mode_of_payment: body_data.mode_of_payment,
            salesperson_id: body_data.salesperson_id,
            discount_amount: body_data.discount_amount,
            accessory_items: body_data.accessory_items
        });
    }

    /** Deletes an invoice document by its Firestore document ID. */
    static async delete_invoice_by_id(invoice_id) {
        console.log('delete invoice by id')

        await admin.firestore().collection('invoices').doc(invoice_id).delete()
    }

    /**
     * Finds the invoice that contains a specific product by querying the denormalized `product_ids` array.
     * Returns the first matching invoice, or null if not found.
     */
    static async get_product_associated_invoice(product_id, ownerUid = null) {
        console.log("getting product associated invoice")

        let q = admin.firestore().collection('invoices').where("product_ids", "array-contains", product_id)
        let qs = await q.get()
        let results = qs.docs.map(doc => doc.data())
        if (ownerUid) {
            results = results.filter(x => x.added_by_user_uid === ownerUid)
        }
        
        return results.length > 0 ? results[0] : null
    }

    /**
     * Returns all invoices for a given calendar month and branch.
     * Used exclusively by the Monthly Report tab — fetches the FULL month in one query
     * so the report is never limited by paginated Records data.
     *
     * Index usage (no new indexes needed):
     *   Admin path   → (branch_id ASC, date DESC) composite index
     *   Non-admin    → (added_by_user_uid ASC, date DESC) composite + in-memory branch filter
     *
     * @param {string} branchId   - Branch to report on (required)
     * @param {string} yearMonth  - "YYYY-MM" string
     * @param {string|null} ownerUid - Non-admin user UID; null for admins
     * @returns {object[]}  Full invoice list for the month (capped at 500 for safety)
     */
    static async get_invoices_for_month(branchId, yearMonth, ownerUid = null) {
        const startDate = moment(yearMonth, 'YYYY-MM').startOf('month').toDate()
        const endDate   = moment(yearMonth, 'YYYY-MM').endOf('month').toDate()
        const MONTHLY_CAP = 500

        if (ownerUid) {
            // Non-admin: query scoped to user + date range using existing (added_by_user_uid, date DESC) index.
            // Branch is filtered in-memory — a single month per user is always small (< MONTHLY_CAP).
            const q = admin.firestore().collection('invoices')
                .where('added_by_user_uid', '==', ownerUid)
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .orderBy('date', 'desc')
                .limit(MONTHLY_CAP)
            const qs = await q.get()
            let items = qs.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            if (branchId) {
                items = items.filter(item => item.branch_id === branchId)
            }
            return items
        }

        // Admin: query scoped to branch + date range using existing (branch_id, date DESC) index.
        const q = admin.firestore().collection('invoices')
            .where('branch_id', '==', branchId)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .orderBy('date', 'desc')
            .limit(MONTHLY_CAP)
        const qs = await q.get()
        return qs.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    }

    /**
     * Returns a paginated page of invoices ordered by date (descending).
     * Uses Firestore cursor-based pagination (startAfter) for true read reduction.
    * @param {number} limit        - Documents per page (max 50, default 25)
     * @param {string|null} cursorDocId - Firestore doc ID of the last item from the previous page
     * @param {string|null} branchId - Optional branch filter for server-side pagination
     * @returns {{ items: object[], nextCursor: string|null, hasMore: boolean }}
     */
    static async get_invoice_list_paged(limit = 25, cursorDocId = null, ownerUid = null, branchId = null) {
        let q = admin.firestore().collection('invoices')
        if (ownerUid) {
            q = q.where('added_by_user_uid', '==', ownerUid)
        }
        if (branchId) {
            q = q.where('branch_id', '==', branchId)
        }

        const buildResult = (qs) => ({
            items: qs.docs.map(doc => ({ id: doc.id, ...(doc.data()) })),
            nextCursor: qs.docs.length === limit ? qs.docs[qs.docs.length - 1].id : null,
            hasMore: qs.docs.length === limit,
        })

        try {
            let pagedQuery = q.orderBy('date', 'desc').limit(limit)
            if (cursorDocId) {
                const cursorDoc = await admin.firestore().collection('invoices').doc(cursorDocId).get()
                if (cursorDoc.exists) pagedQuery = pagedQuery.startAfter(cursorDoc)
            }
            const qs = await pagedQuery.get()
            return buildResult(qs)
        } catch (error) {
            const details = `${error?.message || ''} ${error?.details || ''}`
            const isIndexDelay = error?.code === 9 && /index/i.test(details)
            if (!isIndexDelay || !branchId) {
                throw error
            }

            // Fallback while index is building: overfetch owner-scoped invoices and filter by branch in memory.
            const fallbackLimit = Math.max(limit * 3, 100)
            let fallbackQuery = admin.firestore().collection('invoices')
            if (ownerUid) {
                fallbackQuery = fallbackQuery.where('added_by_user_uid', '==', ownerUid)
            }
            fallbackQuery = fallbackQuery.orderBy('date', 'desc').limit(fallbackLimit)
            if (cursorDocId) {
                const cursorDoc = await admin.firestore().collection('invoices').doc(cursorDocId).get()
                if (cursorDoc.exists) fallbackQuery = fallbackQuery.startAfter(cursorDoc)
            }

            const fallbackSnap = await fallbackQuery.get()
            const branchDocs = fallbackSnap.docs.filter((doc) => doc.data()?.branch_id === branchId).slice(0, limit)
            return {
                items: branchDocs.map((doc) => ({ id: doc.id, ...(doc.data()) })),
                nextCursor: fallbackSnap.docs.length === fallbackLimit ? fallbackSnap.docs[fallbackSnap.docs.length - 1].id : null,
                hasMore: fallbackSnap.docs.length === fallbackLimit,
            }
        }
    }
}

module.exports = wrapStaticMethods(Invoice);
