// models/InvoiceHistory.js
const mongoose = require('mongoose')

const InvoiceHistorySchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true },
    date: { type: Date, required: true },
    customerName: { type: String, required: true },
    customerPhoneNumber: { type: String, required: true },
    customerGstNumber: { type: String, required: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    totalAmount: { type: Number, required: true },
    CGST: { type: Number, required: true },
    SGST: { type: Number, required: true },
    finalAmount: { type: Number, required: true },
    pdfPath: { type: String, required: true },
})

module.exports = mongoose.model('InvoiceHistory', InvoiceHistorySchema)
