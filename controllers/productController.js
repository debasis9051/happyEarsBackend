/**
 * productController — Handles Product inventory CRUD, bulk import, transfers, returns, and log history.
 */
const XLSX = require("xlsx")
const Product = require('../models/productModel')
const Branch = require('../models/branchModel')
const moment = require("moment")
const cache = require('../utils/cache')
const { sendServerError } = require('../utils/errorResponse')
const { setCacheControl } = require('../utils/cacheHeaders')
const { safeError } = require('../utils/safeLogger')

const invalidateProductCache = () => {
    cache.invalidate('product-list')
}

const productController = {
    // Legacy unbounded endpoint kept as reference only.
    // Do NOT enable in production; this can spike Firestore reads.
    // getProductList: async (req, res) => {
    //     try {
    //         let p_data = await Product.get_product_list()
    //
    //         setCacheControl(res, 'private', 300);
    //         res.status(200).json({ operation: "success", message: "Product list fetched successfully", info: p_data });
    //     } catch (error) {
    //         console.error(error);
    //         return sendServerError(res, error);
    //     }
    // },

    /**
     * Returns a cursor-paginated page of products ordered by product_name.
     * Body: { current_user_uid, current_user_name, limit?, cursor? }
     * Response info: { items, nextCursor, hasMore }
     */
    getProductListPaged: async (req, res) => {
        try {
            const parsedLimit = parseInt(req.body.limit)
            const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25
            const limit = Math.min(safeLimit, 50)  // hard cap: max 50 docs per page
            const cursorDocId = req.body.cursor || null
            const branchId = typeof req.body.branch_id === 'string' && req.body.branch_id.trim()
                ? req.body.branch_id.trim()
                : null
            const inStockOnly = req.body.in_stock_only === true
            const result = await Product.get_product_list_paged(limit, cursorDocId, branchId, { inStockOnly })

            setCacheControl(res, 'private', 60)
            res.status(200).json({ operation: "success", message: "Product list page fetched successfully", info: result })
        } catch (error) {
            safeError('productController.getProductListPaged', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Searches lightweight product options for typeahead dropdowns.
     * Body: { search_term: string, limit?: number, branch_id?: string, in_stock_only?: boolean }
     */
    searchProductBrief: async (req, res) => {
        try {
            const searchTerm = (req.body.search_term || '').toString()
            const parsedLimit = parseInt(req.body.limit)
            const safeLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 25
            const limit = Math.min(safeLimit, 100)
            const branchId = typeof req.body.branch_id === 'string' && req.body.branch_id.trim() ? req.body.branch_id.trim() : null
            const inStockOnly = req.body.in_stock_only !== false
            const result = await Product.search_product_brief(searchTerm, { limit, branchId, inStockOnly })

            setCacheControl(res, 'private', 30)
            return res.status(200).json({ operation: 'success', message: 'Product search fetched successfully', info: result })
        } catch (error) {
            safeError('productController.searchProductBrief', error)
            return sendServerError(res, error)
        }
    },

    /**
     * Adds a single new product to inventory.
     * Validates that the serial number does not already exist in the database.
     * Requires inventory access.
     * Body: { current_user_uid, current_user_name, product_name, manufacturer, mrp, serial_number, branch_id }
     */
    addProduct: async (req, res) => {
        try {
            let data = [
                {
                    product_name: req.body.product_name,
                    manufacturer_name: req.body.manufacturer,
                    mrp: req.body.mrp,
                    serial_number: req.body.serial_number,
                    branch_id: req.body.branch_id
                }
            ]

            let t1 = await Product.are_serials_in_stock([req.body.serial_number])
            if (t1.length > 0) {
                return res.status(409).json({ operation: "failed", message: `Product with Serial: ${req.body.serial_number} already exists in database` });
            }

            await Product.add_batch_products_with_logs(data, req.body.current_user_uid, req.body.current_user_name, "add", "product added")
            invalidateProductCache()

            return res.status(200).json({ operation: "success", message: "Product added successfully" });

        } catch (error) {
            safeError('productController.addProduct', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Updates an existing product's details.
     * Validates that the (possibly changed) serial number does not conflict with another product.
     * Requires inventory access.
     * Body: { current_user_uid, current_user_name, product_id, product_name, manufacturer, mrp, serial_number, branch_id }
     */
    updateProduct: async (req, res) => {
        try {
            let t1 = await Product.are_serials_in_stock([req.body.serial_number])
            t1 = t1.filter(x=>x.id !== req.body.product_id)
            
            if (t1.length > 0) {
                return res.status(409).json({ operation: "failed", message: `Product with Serial: ${req.body.serial_number} already exists in database` });
            }

            await Product.update_product_with_logs(req.body, req.body.current_user_uid, req.body.current_user_name)
            invalidateProductCache()

            return res.status(200).json({ operation: "success", message: "Product updated successfully" });

        } catch (error) {
            safeError('productController.updateProduct', error);
            return sendServerError(res, error);
        }
    },

    /**
     * Bulk-imports products from an uploaded Excel file.
     * Expected columns: COMPANY NAME, PRODUCT NAME, SERIAL NUMBER, MRP, BRANCH.
     * Filters: strips rows missing required fields, deduplicates by serial, rejects
     * serials already in the database, and resolves branch names to branch IDs.
     * Only accepts branches matching "ranikuthi" or "rajpur" keywords (not "trial").
     * Requires inventory access; uses multer to parse the uploaded file buffer.
     * Body (multipart): { current_user_uid, current_user_name, starting_row, ending_row, selected_file }
     */
    importProducts: async (req, res) => {
        try {
            let b_list = await Branch.get_branch_list()

            let workbook = XLSX.read(req.file.buffer);
            let worksheet = workbook.Sheets[workbook.SheetNames[0]]

            let data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) //full data extracted

            let h = data.splice(0, 1)[0]    //heading row extracted and cut off from data
            if(!(h.includes("COMPANY NAME") && h.includes("PRODUCT NAME") && h.includes("SERIAL NUMBER") && h.includes("MRP") && h.includes("BRANCH"))){
                return res.status(400).json({ operation: "failed", message: 'Invalid Excel File Data' });
            }
            
            let cn_col = h.findIndex(x=>x==="COMPANY NAME")
            let pn_col = h.findIndex(x=>x==="PRODUCT NAME")
            let sn_col = h.findIndex(x=>x==="SERIAL NUMBER")
            let mrp_col = h.findIndex(x=>x==="MRP")
            let br_col = h.findIndex(x=>x==="BRANCH")

            data = data.slice(parseInt(req.body.starting_row) - 1, parseInt(req.body.ending_row)) //taking segment from start row to end row

            let rejected_serials = []

            data = data.filter((x, i) => {         //remove if any of the following is empty: company name, product name, serial number, mrp, branch 
                if (!(x[cn_col] && x[pn_col] && x[sn_col] && x[mrp_col] && x[br_col])) {
                    if (!x[sn_col]) {
                        rejected_serials.push(`PRODUCT ON ROW ${i + 2}`)
                    }
                    else {
                        rejected_serials.push(x[sn_col].toString())
                    }
                }
                return (x[cn_col] && x[pn_col] && x[sn_col] && x[mrp_col] && x[br_col])
            })

            data = data.reduce((p, o) => {      //remove duplicate serials from "data"
                if (p.find(x => x[sn_col] === o[sn_col])) {
                    return p
                } else {
                    return [...p, o]
                }
            }, [])

            data = data.filter((x) => {         //branch name keyword("ranikuthi", "rajpur") not found and "trial" keyword entries remove
                if (!((!x[br_col].toLowerCase().includes("trial")) && (x[br_col].toLowerCase().includes("ranikuthi") || x[br_col].toLowerCase().includes("rajpur")))) {
                    rejected_serials.push(x[sn_col].toString())
                }
                return ( (!x[br_col].toLowerCase().includes("trial")) && (x[br_col].toLowerCase().includes("ranikuthi") || x[br_col].toLowerCase().includes("rajpur")) )
            })


            data = data.map((x) => {          // structuring data
                let b = null
                b_list.forEach(br => {
                    if (x[br_col].toLowerCase().includes(br.branch_name.toLowerCase())) {
                        b = br.id
                    }
                })

                return {
                    product_name: x[pn_col].toString(),
                    manufacturer_name: x[cn_col].toString(),
                    mrp: parseFloat(x[mrp_col]),
                    serial_number: x[sn_col].toString(),
                    branch_id: b
                }
            })

            let t1 = await Product.are_serials_in_stock(data.map(x => x.serial_number))     //existing serials in database filtered out
            if (t1.length > 0) {
                data = data.filter(x => {
                    if (t1.find(y => y.serial_number === x.serial_number)) {
                        rejected_serials.push(x.serial_number)
                    }
                    return !t1.find(y => y.serial_number === x.serial_number)
                })
            }

            await Product.add_batch_products_with_logs(data, req.body.current_user_uid, req.body.current_user_name, "import", "product added")
            invalidateProductCache()

            return res.status(200).json({ operation: "success", message: "Products imported successfully", info: { added_serials: data.map(x=>x.serial_number), rejected_serials: rejected_serials } });

        } catch (error) {
            console.error(error);
            return sendServerError(res, error);
        }
    },

    /**
     * Transfers a product to a different branch.
     * Records two log entries: transfer_remove from source branch, transfer_add to destination.
     * Requires inventory access.
     * Body: { current_user_uid, current_user_name, product_id, branch_id }
     */
    transferProduct: async (req, res) => {
        try {
            await Product.transfer_product_with_logs(req.body, req.body.current_user_uid, req.body.current_user_name)
            invalidateProductCache()

            return res.status(200).json({ operation: "success", message: "Product transferred successfully" });

        } catch (error) {
            console.error(error);
            return sendServerError(res, error);
        }
    },

    /**
     * Marks a product as returned (instock: false) with a reason log entry.
     * Requires inventory access.
     * Body: { current_user_uid, current_user_name, product_id, reason }
     */
    returnProduct: async (req, res) => {
        try {
            await Product.return_product_with_logs(req.body, req.body.current_user_uid, req.body.current_user_name)
            invalidateProductCache()

            return res.status(200).json({ operation: "success", message: "Product returned successfully" });

        } catch (error) {
            console.error(error);
            return sendServerError(res, error);
        }
    },

    /**
     * Permanently deletes a product and all its associated log entries.
     * Requires inventory access.
     * Params: { product_id }
     */
    deleteProduct: async (req, res) => {
        try {
            let product_id = req.params.product_id
            await Product.delete_product_and_logs_by_id(product_id)
            invalidateProductCache()

            return res.status(200).json({ operation: "success", message: "Product deleted successfully" });

        } catch (error) {
            console.error(error);
            return sendServerError(res, error);
        }
    },

    /**
     * Returns the full chronological log history for a single product.
     * Requires inventory access.
     * Body: { current_user_uid, current_user_name, product_id }
     */
    getProductLogHistory: async (req, res) => {
        try {
            let p_data = await Product.get_product_logs_by_id(req.body.product_id)

            p_data = p_data.sort((a,b)=>moment.unix(a.created_at._seconds) - moment.unix(b.created_at._seconds))

            res.status(200).json({ operation: "success", message: "Product log history fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            return sendServerError(res, error);
        }
    },
};

module.exports = productController;

