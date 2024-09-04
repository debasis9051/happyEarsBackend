const XLSX = require("xlsx")
const Product = require('../models/productModel')
const Branch = require('../models/branchModel')
const moment = require("moment")

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
                return res.status(200).json({ operation: "failed", message: `Product with Serial: ${req.body.serial_number} already exists in database` });
            }

            await Product.add_batch_products_with_logs(data, req.body.current_user_uid, req.body.current_user_name, "add", "product added")

            return res.status(200).json({ operation: "success", message: "Product added successfully" });

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

            let h = data.splice(0, 1)[0]    //heading row extracted and cut off from data
            if(!(h.includes("COMPANY NAME") && h.includes("PRODUCT NAME") && h.includes("SERIAL NUMBER") && h.includes("MRP") && h.includes("BRANCH"))){
                return res.status(200).json({ operation: "failed", message: 'Invalid Excel File Data' });
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

            return res.status(200).json({ operation: "success", message: "Products imported successfully", info: { added_serials: data.map(x=>x.serial_number), rejected_serials: rejected_serials } });

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

    getProductLogHistory: async (req, res) => {
        try {
            let p_data = await Product.get_product_logs_by_id(req.body.product_id)

            p_data = p_data.sort((a,b)=>moment.unix(a.created_at._seconds) - moment.unix(b.created_at._seconds))

            res.status(200).json({ operation: "success", message: "Product log history fetched successfully", info: p_data });
        } catch (error) {
            console.error(error);
            res.status(500).json({ operation: "failed", message: 'Internal Server Error' });
        }
    },
};

module.exports = productController;

