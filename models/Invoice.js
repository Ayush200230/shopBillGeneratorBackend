const mongoose = require('mongoose')

const InvoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true },
    date: { type: Date, required: true },
    customerName: { type: String, required: true },
    customerGstNumber: { type: String, required: true },
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    totalAmount: { type: Number, required: true },
    CGST: { type: Number, required: true },
    SGST: { type: Number, required: true },
    finalAmount: { type: Number, required: true },
})

module.exports = mongoose.model('Invoice', InvoiceSchema)
