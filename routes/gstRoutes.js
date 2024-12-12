const express = require('express')
const { getCustomerByGST } = require('../controllers/gstController')

const router = express.Router()

router.get('/:gstNumber', getCustomerByGST)

module.exports = router
