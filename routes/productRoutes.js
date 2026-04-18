/**
 * Product routes
 * POST /get-product-list-paged     — Requires generate_invoice or inventory access
 * POST /add-product                — Requires inventory access
 * POST /update-product             — Requires inventory access
 * POST /import-products            — Requires inventory access; accepts multipart/form-data (Excel file)
 * POST /transfer-product           — Requires inventory access
 * POST /return-product             — Requires inventory access
 * POST /get-product-log-history    — Requires inventory access
 * POST /products/:product_id       — Delete product; requires inventory access
 */
const express = require('express');
const multer = require('multer')
const checkJwt = require('../checkJwt');
const productController = require('../controllers/productController');

const upload = multer()
const productRoutes = express.Router();

// Legacy unbounded endpoint kept commented for reference only.
// productRoutes.post('/get-product-list', checkJwt(["generate_invoice", "inventory"]), productController.getProductList);
productRoutes.post('/get-product-list-paged', checkJwt(["generate_invoice", "inventory"]), productController.getProductListPaged);
productRoutes.post('/search-product-brief', checkJwt(["generate_invoice", "inventory"]), productController.searchProductBrief);
productRoutes.post('/add-product', checkJwt(["inventory"]), productController.addProduct);
productRoutes.post('/update-product', checkJwt(["inventory"]), productController.updateProduct);
productRoutes.post('/import-products', upload.single("selected_file"), checkJwt(["inventory"]), productController.importProducts);
productRoutes.post('/transfer-product', checkJwt(["inventory"]), productController.transferProduct);
productRoutes.post('/return-product', checkJwt(["inventory"]), productController.returnProduct);
productRoutes.post('/get-product-log-history', checkJwt(["inventory"]), productController.getProductLogHistory);

productRoutes.post('/products/:product_id', checkJwt(["inventory"]), productController.deleteProduct);

module.exports = productRoutes;