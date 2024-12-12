const mongoose = require('mongoose')

const HsnSchema = new mongoose.Schema({
    HSN: { type: String, required: true },
    CGST: { type: Number, required: true },
    SGST: { type: Number, required: true },
})

module.exports = mongoose.model('Hsn', HsnSchema)
