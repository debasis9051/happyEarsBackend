const express = require('express');
const multer = require('multer')
const checkJwt= require('../checkJwt');
const productController = require('../controllers/productController');

const upload = multer()
const productRoutes = express.Router();

productRoutes.post('/get-product-list', checkJwt, productController.getProductList);
productRoutes.post('/import-products', upload.single("selected_file"), checkJwt, productController.importProducts);
productRoutes.post('/transfer-product', checkJwt, productController.transferProduct);
productRoutes.post('/return-product', checkJwt, productController.returnProduct);

module.exports = productRoutes;