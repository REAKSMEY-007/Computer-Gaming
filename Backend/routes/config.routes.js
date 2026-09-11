const express = require("express");
const router = express.Router();
const { getBankPaymentInfo } = require("../controllers/config.controller");
const { getConfig } = require("../controllers/siteConfig.controller");

router.get("/bank-payment", getBankPaymentInfo);
router.get("/site", getConfig);

module.exports = router;