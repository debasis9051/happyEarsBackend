const moment = require("moment")
const Invoice = require('../models/invoiceModel')
const Product = require('../models/productModel')
const Branch = require('../models/branchModel')

const invoiceController = {
    getInvoiceList: async (req, res) => {
        try {
            let p_data = await Invoice.get_invoice_list()

            res.status(200).json({ operation: "success", message: "Invoice list fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    getInvoiceNumber: async (req, res) => {
        try {
            let c = await Invoice.get_invoice_count_by_branch_id_and_date(req.body.branch_id, req.body.date)
            let b = await Branch.get_branch_invoice_code_by_id(req.body.branch_id)
            let t = moment(req.body.date).format("MMM").toUpperCase() + "/HA/" + b + "/" + (c + 1)

            console.log(t)

            res.status(200).json({ operation: "success", message: "Invoice number fetched successfully", info: t });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    saveInvoice: async (req, res) => {
        try {
            let t = await Invoice.get_invoice_by_invoice_number(req.body.invoice_number)
            if (t.length > 0) {
                return res.status(200).json({ operation: "failed", message: "Invoice against given Invoice Number already exists" });
            }

            let t2 = await Product.are_serials_in_stock(req.body.line_items.map(x => x.serial_number))
            if (t2.find(x=>!x.instock)) {
                return res.status(200).json({ operation: "failed", message: `These serials are not in stock currently: ${t2.filter(x=>!x.instock).map(x=>x.serial_number).join(", ")}` });
            }

            await Invoice.add_invoice(req.body.current_user_uid, req.body.current_user_name, req.body)

            await Product.invoice_batch_products_with_logs(req.body.line_items, req.body.current_user_uid, req.body.current_user_name, "invoiced", "product invoiced", req.body.branch_id)

            return res.status(200).json({ operation: "success", message: "Invoice saved successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    updateInvoice: async (req, res) => {
        try {
            let t = await Invoice.get_invoice_by_invoice_id(req.body.invoice_id)
            if (!t) {
                return res.status(200).json({ operation: "failed", message: "No such Invoice exists" });
            }

            await Invoice.update_invoice(req.body)

            return res.status(200).json({ operation: "success", message: "Invoice updated successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = invoiceController;

