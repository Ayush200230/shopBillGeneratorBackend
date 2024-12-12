const mongoose = require('mongoose')

const CustomerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    gstNumber: { type: String },
})

module.exports = mongoose.model('Customer', CustomerSchema)
