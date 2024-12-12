require('dotenv').config()
const express = require('express')
const connectDB = require('./config/database')
const invoiceRoutes = require('./routes/invoiceRoutes')
const gstRoutes = require('./routes/gstRoutes')
const path = require('path')

const app = express()
connectDB()

app.use(express.json())
// Serve static files from the 'invoices' directory
app.use('/invoices', express.static(path.join(__dirname, 'invoices')))

app.use('/api/invoice', invoiceRoutes)
app.use('/api/gst', gstRoutes)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
