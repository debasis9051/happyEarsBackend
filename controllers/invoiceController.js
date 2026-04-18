/**
 * invoiceController — Handles Invoice CRUD and invoice-number generation.
 * Also provides product–invoice association lookup for inventory tracking.
 */
const moment = require("moment")
const Invoice = require('../models/invoiceModel')
const Product = require('../models/productModel')
const Branch = require('../models/branchModel')
const Patient = require('../models/patientModel')
const cache = require('../utils/cache')
const { sendServerError } = require('../utils/errorResponse')
const { setCacheControl } = require('../utils/cacheHeaders')
const { safeError } = require('../utils/safeLogger')

const invalidateInvoiceAndProductCaches = () => {
    cache.invalidateByPrefix('invoice-list')
    cache.invalidate('product-list')
}

const invoiceController = {
    _ownerScopeUid: (req) => (req.authAccess?.admin_panel ? null : req.authUserUid),
    // Legacy unbounded endpoint kept commented for future reference only.
    // Do NOT enable in production: this can spike Firestore reads on large collections.
    // getInvoiceList: async (req, res) => {
    //     try {
    //         const ownerUid = invoiceController._ownerScopeUid(req)
    //         let p_data = await Invoice.get_invoice_list(ownerUid)
    //
    //         setCacheControl(res, 'private', 300);
    //         res.status(200).json({ operation: "success", message: "Invoice list fetched successfully", info: p_data });
    //     } catch (error) {
    //         console.error(error);
    //         return sendServerError(res, error);
    //     }
    // },

    /**
     * Generates the next sequential invoice number for the given branch and date.
     * Format: MMM/YY/HA/<branch_code>/<count+1>  (e.g. "JAN/25/HA/RN/3")
     * Requires generate_invoice access.
     * Body: { current_user_uid, current_user_name, branch_id, date }
     */
    getInvoiceNumber: async (req, res) => {
        try {
            const ownerUid = invoiceController._ownerScopeUid(req)
            if (!moment(req.body.date).isValid()) {
                return res.status(400).json({ operation: "failed", message: "Given date is Invalid " });
            }

            let c = await Invoice.get_invoice_count_by_branch_id_and_date(req.body.branch_id, req.body.date, ownerUid)
            let b = await Branch.get_branch_invoice_code_by_id(req.body.branch_id)
            let t = moment(req.body.date).format("MMM/YY").toUpperCase() + "/HA/" + b + "/" + (c + 1)

            res.status(200).json({ operation: "success", message: "Invoice number fetched successfully", info: t });
        } catch (error) {
            safeError('invoiceController.getInvoiceNumber', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Saves a new invoice and marks all sold products as out-of-stock.
     * Validates: invoice number uniqueness, and that all product serials are in stock.
     * Requires generate_invoice access.
     * Body: { current_user_uid, current_user_name, invoice_number, branch_id, date,
     *         patient_id, mode_of_payment, salesperson_id, discount_amount,
     *         line_items, accessory_items }
     */
    saveInvoice: async (req, res) => {
        try {
            const ownerUid = invoiceController._ownerScopeUid(req)
            let t = await Invoice.get_invoice_by_invoice_number(req.body.invoice_number, ownerUid)
            if (t.length > 0) {
                return res.status(409).json({ operation: "failed", message: "Invoice against given Invoice Number already exists" });
            }

            let t2 = await Product.are_serials_in_stock(req.body.line_items.map(x => x.serial_number))
            if (t2.find(x => !x.instock)) {
                return res.status(409).json({ operation: "failed", message: `These serials are not in stock currently: ${t2.filter(x => !x.instock).map(x => x.serial_number).join(", ")}` });
            }

            await Invoice.add_invoice(req.authUserUid, req.authUserName || req.body.current_user_name, req.body)

            await Product.invoice_batch_products_with_logs(req.body.line_items, req.authUserUid, req.authUserName || req.body.current_user_name, "invoiced", "product invoiced", req.body.branch_id)
            invalidateInvoiceAndProductCaches()

            return res.status(200).json({ operation: "success", message: "Invoice saved successfully" });

        } catch (error) {
            safeError('invoiceController.saveInvoice', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Updates editable fields on an existing invoice (date, payment, salesperson, discount, accessories).
     * Does NOT re-validate product stock since line items cannot be changed on edit.
     * Requires sales_report access.
     * Body: { current_user_uid, current_user_name, invoice_id, ...updatable fields }
     */
    updateInvoice: async (req, res) => {
        try {
            const ownerUid = invoiceController._ownerScopeUid(req)
            let t = await Invoice.get_invoice_by_invoice_id(req.body.invoice_id, ownerUid)
            if (!t) {
                return res.status(404).json({ operation: "failed", message: "No such Invoice exists" });
            }

            await Invoice.update_invoice(req.body)
            invalidateInvoiceAndProductCaches()

            return res.status(200).json({ operation: "success", message: "Invoice updated successfully" });

        } catch (error) {
            safeError('invoiceController.updateInvoice', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Deletes an invoice and restocks all products that were on it.
     * Requires inventory access.
     * Params: { invoice_id }  Body: { current_user_uid, current_user_name }
     */
    deleteInvoice: async (req, res) => {
        try {
            const ownerUid = invoiceController._ownerScopeUid(req)
            let invoice_id = req.params.invoice_id
            let invoice = await Invoice.get_invoice_by_invoice_id(invoice_id, ownerUid)

            if (!invoice) {
                return res.status(404).json({ operation: "failed", message: "No such Invoice exists" });
            }

            await Product.restock_product_with_logs(invoice.line_items.map(x => x.product_id), req.authUserUid, req.authUserName || req.body.current_user_name)

            await Invoice.delete_invoice_by_id(invoice_id)
            invalidateInvoiceAndProductCaches()

            return res.status(200).json({ operation: "success", message: "Invoice deleted successfully and products restocked" });

        } catch (error) {
            safeError('invoiceController.deleteInvoice', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Finds the invoice that contains a specific product (by product_id from product_ids array).
     * Also hydrates the patient details onto the returned invoice object.
     * Requires inventory access.
     * Params: { product_id }
     */
    getProductAssociatedInvoice: async (req, res) => {
        try {
            const ownerUid = invoiceController._ownerScopeUid(req)
            let invoice = await Invoice.get_product_associated_invoice(req.params.product_id, ownerUid)

            if (invoice) {
                let patient_details = await Patient.get_patient_by_patient_id(invoice.patient_id)
                invoice.patient_details = patient_details
            }

            res.status(200).json({ operation: "success", message: "Product associated Invoice fetched successfully", info: invoice });
        } catch (error) {
            safeError('invoiceController.getProductAssociatedInvoice', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Returns ALL invoices for a given month and branch for the Monthly Report tab.
     * Uses a date-range query (bounded: 1 month) so it is NOT limited by paginated Records data.
     * Body: { current_user_uid, current_user_name, branch_id, year_month }
     *   year_month — "YYYY-MM" format string
     */
    getInvoicesForMonthReport: async (req, res) => {
        try {
            const ownerUid = invoiceController._ownerScopeUid(req)
            const branchId = typeof req.body.branch_id === 'string' && req.body.branch_id.trim() ? req.body.branch_id.trim() : null
            const yearMonth = typeof req.body.year_month === 'string' ? req.body.year_month.trim() : ''

            if (!branchId) {
                return res.status(400).json({ operation: 'failed', message: 'branch_id is required' })
            }
            if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
                return res.status(400).json({ operation: 'failed', message: 'year_month must be in YYYY-MM format' })
            }

            const items = await Invoice.get_invoices_for_month(branchId, yearMonth, ownerUid)
            setCacheControl(res, 'private', 60)
            res.status(200).json({ operation: 'success', message: 'Monthly report invoices fetched successfully', info: items })
        } catch (error) {
            console.error(error)
            return sendServerError(res, error)
        }
    },

    /**
     * Returns a cursor-paginated page of invoices (newest first).
     * Body: { current_user_uid, current_user_name, limit?, cursor? }
     * Response info: { items, nextCursor, hasMore }
     */
    getInvoiceListPaged: async (req, res) => {
        try {
            const ownerUid = invoiceController._ownerScopeUid(req)
            const parsedLimit = parseInt(req.body.limit)
            const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25
            const limit = Math.min(safeLimit, 50)  // hard cap: max 50 docs per page
            const cursorDocId = req.body.cursor || null
            const branchId = typeof req.body.branch_id === 'string' && req.body.branch_id.trim() ? req.body.branch_id.trim() : null
            const result = await Invoice.get_invoice_list_paged(limit, cursorDocId, ownerUid, branchId)
            setCacheControl(res, 'private', 60)
            res.status(200).json({ operation: "success", message: "Invoice list page fetched successfully", info: result })
        } catch (error) {
            console.error(error);
            return sendServerError(res, error);
        }
    },
};

module.exports = invoiceController;

