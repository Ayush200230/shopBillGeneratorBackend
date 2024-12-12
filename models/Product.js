const mongoose = require('mongoose')

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    HSN: { type: String, required: true },
    quantity: { type: Number, required: true },
    rate: { type: Number, required: true },
    gst: { type: Number, required: true },
    amount: { type: Number, required: true },
})

module.exports = mongoose.model('Product', ProductSchema)
