const express = require('express');
const multer = require('multer')
const checkJwt= require('../checkJwt');
const productController = require('../controllers/productController');

const upload = multer()
const productRoutes = express.Router();

productRoutes.post('/get-product-list', checkJwt(["generate_invoice", "inventory"]), productController.getProductList);
productRoutes.post('/add-product', checkJwt(["inventory"]), productController.addProduct);
productRoutes.post('/update-product', checkJwt(["inventory"]), productController.updateProduct);
productRoutes.post('/import-products', upload.single("selected_file"), checkJwt(["inventory"]), productController.importProducts);
productRoutes.post('/transfer-product', checkJwt(["inventory"]), productController.transferProduct);
productRoutes.post('/return-product', checkJwt(["inventory"]), productController.returnProduct);
productRoutes.post('/get-product-log-history', checkJwt(["inventory"]), productController.getProductLogHistory);

module.exports = productRoutes;