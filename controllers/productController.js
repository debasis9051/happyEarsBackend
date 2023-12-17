const Product = require('../models/productModel');

const productController = {
    addProduct: async (req, res) => {
        try {
            let t1 = await Product.get_product_by_name(req.body.product_name)
            let t2 = await Product.are_serials_in_stock(req.body.serial_array)

            if(t1.length === 0){
                if(t2.length === 0 ){
                    let product_id = await Product.create_product(req.body.product_name, req.body.manufacturer_name, req.body.mrp, req.body.product_type)
                    await Product.create_serials(product_id, req.body.serial_array)
                    await Product.add_product_log("current_user_uid", "current_user_name", product_id, req.body.product_name, "create", "new product added", req.body.serial_array, [])
    
                    res.status(200).json({ operation: "success", message: "Product created successfully" });
                }
                else{
                    res.status(200).json({ operation: "failed", message: `These serials already exist: ${t2.map(x=>x.serial_number).join(", ")}` });
                }
            }
            else{
                res.status(200).json({ operation: "failed", message: "Product by this name already exists" });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },

    getProductList: async (req, res) => {
        try {            
            let p_data = await Product.get_product_list_by_pagination()

            res.status(200).json({ operation: "success", message: "Product list fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    }
};

module.exports = productController;
