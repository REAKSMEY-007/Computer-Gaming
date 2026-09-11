const express = require("express");
const router = express.Router();
const { validatePcBuild } = require("../controllers/buildPc.controller");

router.post("/validate", validatePcBuild);

module.exports = router;