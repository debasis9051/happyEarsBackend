const XLSX = require("xlsx")
const Product = require('../models/productModel')
const Branch = require('../models/branchModel')

const productController = {
    getProductList: async (req, res) => {
        try {
            let p_data = await Product.get_product_list()

            res.status(200).json({ operation: "success", message: "Product list fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    importProducts: async (req, res) => {
        try {
            let b_list = await Branch.get_branch_list()

            let workbook = XLSX.read(req.file.buffer);
            let worksheet = workbook.Sheets[workbook.SheetNames[0]]

            let data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) //full data extracted
            data.splice(0, 1) //heading column remove
            data = data.slice(parseInt(req.body.starting_row) - 1, parseInt(req.body.ending_row)) //taking segment from start row to end row
            data = data.filter((x) => x[3] !== undefined) //empty serial entries remove
            data = data.filter((x) => ((!x[6].toLowerCase().includes("trial")) && ((x[6].toLowerCase().includes("ranikuthi")) || (x[6].toLowerCase().includes("rajpur"))) ) ) //branch name keyword not found and "trial" keyword entries remove

            data = data.map((x) => {          // structuring data
                let b = null
                b_list.forEach(br => {
                    if (x[6].toLowerCase().includes(br.branch_name.toLowerCase())) {
                        b = br.id
                    }
                })

                return {
                    product_name: x[2].toString(),
                    manufacturer_name: x[1].toString(),
                    mrp: parseFloat(x[5]),
                    serial_number: x[3].toString(),
                    branch_id: b
                }
            })

            let t1 = await Product.are_serials_in_stock(data.map(x => x.serial_number))
            if (t1.length > 0) {
                data = data.filter(x => !t1.find(y => y.serial_number === x.serial_number))
            } 

            await Product.add_batch_products_with_logs(data, req.body.current_user_uid, req.body.current_user_name, "import", "product added")
 
            return res.status(200).json({ operation: "success", message: "Products imported successfully", info: t1.map(x => x.serial_number) });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    transferProduct: async (req, res) => {
        try {
            await Product.transfer_product_with_logs(req.body, req.body.current_user_uid, req.body.current_user_name)
 
            return res.status(200).json({ operation: "success", message: "Product transferred successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    returnProduct: async (req, res) => {
        try {
            await Product.return_product_with_logs(req.body, req.body.current_user_uid, req.body.current_user_name)
 
            return res.status(200).json({ operation: "success", message: "Product transferred successfully" });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = productController;

