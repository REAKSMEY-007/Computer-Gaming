const express = require("express");
const router = express.Router();
const { getBankPaymentInfo } = require("../controllers/config.controller");
const { getConfig } = require("../controllers/siteConfig.controller");
const { getShippingConfig } = require("../controllers/shipping.controller");

router.get("/bank-payment", getBankPaymentInfo);
router.get("/site", getConfig);
router.get("/shipping", getShippingConfig);

module.exports = router;