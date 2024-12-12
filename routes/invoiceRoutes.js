const express = require('express')
const {
    createOrUpdateInvoice,
    sendInvoice,
    deleteOldRecords,
    getInvoiceHistory,
} = require('../controllers/invoiceController')

const router = express.Router()

router.post('/', createOrUpdateInvoice)
router.post('/send', sendInvoice)
router.post('/delete-records', deleteOldRecords)
router.get('/invoice-history', getInvoiceHistory)

module.exports = router
