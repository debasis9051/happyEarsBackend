const XLSX = require("xlsx")
const Product = require('../models/productModel')

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
            let workbook = XLSX.read(req.file.buffer);
            let worksheet = workbook.Sheets[workbook.SheetNames[0]]

            let data = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
            // console.log(data)
            data.splice(0, 1)
            data = data.slice(parseInt(req.body.starting_row) - 1, parseInt(req.body.ending_row))
            data = data.filter((x) => x[3] !== undefined)
            data = data.map((x) => {
                return {
                    product_name: x[2],
                    manufacturer_name: x[1],
                    mrp: x[5],
                    serial_number: x[3]
                }
            })

            let t1 = await Product.are_serials_in_stock(data.map(x => x.serial_number))
            if (t1.length > 0) {
                data = data.filter(x => !t1.find(y => y.serial_number === x.serial_number))
            }

            await Product.add_batch_products_with_logs(data, "current_user_uid", "current_user_name", "import", "product added")

            return res.status(200).json({ operation: "success", message: "Products imported successfully", info: t1.map(x => x.serial_number) });

        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = productController;

