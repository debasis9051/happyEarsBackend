const express = require('express');
const multer = require('multer')
const productController = require('../controllers/productController');

const upload = multer()
const productRoutes = express.Router();

productRoutes.post('/get-product-list', productController.getProductList);
productRoutes.post('/import-products',upload.single("selected_file"), productController.importProducts);


module.exports = productRoutes;