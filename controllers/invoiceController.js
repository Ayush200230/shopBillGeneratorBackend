const mongoose = require('mongoose')
const Invoice = require('../models/Invoice')
const InvoiceHistory = require('../models/InvoiceHistory')
const Product = require('../models/Product')
const Customer = require('../models/Customer')
const { calculateFinalAmount } = require('../utils/taxCalculator')
const { generatePDF } = require('../utils/pdfGenerator')
const { sendWhatsAppMessage } = require('../utils/whatsapp')
const xlsx = require('xlsx')
const path = require('path')
const fs = require('fs')

// Maximum free usage storage limit in MB
const MAX_STORAGE_LIMIT_MB = 450

// Helper to calculate database size
const calculateDatabaseSize = async () => {
    const collections = [
        { name: 'Invoice', model: Invoice },
        { name: 'InvoiceHistory', model: InvoiceHistory },
        { name: 'Product', model: Product },
        { name: 'Customer', model: Customer },
    ]

    let totalSize = 0

    for (const collection of collections) {
        const documents = await collection.model.find()
        const collectionSize = documents.reduce((acc, doc) => {
            return acc + Buffer.byteLength(JSON.stringify(doc), 'utf8')
        }, 0)
        totalSize += collectionSize
    }

    return totalSize / (1024 * 1024) // Convert size to MB
}

// API to create or update invoices with storage check
exports.createOrUpdateInvoice = async (req, res) => {
    try {
        const { invoiceNumber, date, customerInfo, products } = req.body

        // Calculate current database size
        let currentDbSize = await calculateDatabaseSize()

        // Notify if storage is near or exceeds the limit
        if (currentDbSize > MAX_STORAGE_LIMIT_MB) {
            // Notify about database storage issue
            return res.status(200).json({
                message: 'Database storage is full for free usage.',
                currentSize: `${currentDbSize.toFixed(2)} MB`,
                suggestion:
                    'Please choose a collection to delete records older than 30 days.',
                collections: [
                    'Invoice',
                    'InvoiceHistory',
                    'Product',
                    'Customer',
                ],
            })
        }

        // Save customer
        const savedCustomer = await Customer.create(customerInfo)

        // Save products
        const savedProducts = await Promise.all(
            products.map(async (product) => {
                const normalizedRate = parseFloat(
                    (
                        product.rate -
                        (product.rate * product.gst) / (100 + product.gst)
                    ).toFixed(2),
                )
                const amount = parseFloat(
                    (product.quantity * normalizedRate).toFixed(2),
                )
                return await Product.create({
                    ...product,
                    amount,
                    rate: normalizedRate,
                })
            }),
        )

        // Calculate totals
        const { totalAmount, CGST, SGST, finalAmount } =
            await calculateFinalAmount(savedProducts)

        // Check if invoice already exists
        let invoice = await Invoice.findOne({ invoiceNumber })
        if (invoice) {
            // Update existing invoice
            invoice.date = date
            invoice.customerName = savedCustomer.name
            invoice.customerGstNumber = savedCustomer.gstNumber
            invoice.products = savedProducts.map((p) => p._id)
            invoice.totalAmount = totalAmount
            invoice.CGST = CGST
            invoice.SGST = SGST
            invoice.finalAmount = finalAmount
            await invoice.save()
        } else {
            // Create new invoice
            invoice = await Invoice.create({
                invoiceNumber,
                date,
                customerName: savedCustomer.name,
                customerGstNumber: savedCustomer.gstNumber,
                products: savedProducts.map((p) => p._id),
                totalAmount,
                CGST,
                SGST,
                finalAmount,
            })
        }

        // Generate PDF
        const pdfPath = await generatePDF(invoice, savedProducts)

        // Save to or update Invoice History
        let invoiceHistory = await InvoiceHistory.findOne({ invoiceNumber })
        if (invoiceHistory) {
            // Update existing invoice history
            invoiceHistory.date = date
            invoiceHistory.customerName = savedCustomer.name
            invoiceHistory.customerPhoneNumber = savedCustomer.phone
            invoiceHistory.customerGstNumber = savedCustomer.gstNumber
            invoiceHistory.products = savedProducts.map((p) => p._id)
            invoiceHistory.totalAmount = totalAmount
            invoiceHistory.CGST = CGST
            invoiceHistory.SGST = SGST
            invoiceHistory.finalAmount = finalAmount
            invoiceHistory.pdfPath = pdfPath
            await invoiceHistory.save()
        } else {
            // Create new invoice history entry
            invoiceHistory = await InvoiceHistory.create({
                invoiceNumber,
                date,
                customerName: savedCustomer.name,
                customerPhoneNumber: savedCustomer.phone,
                customerGstNumber: savedCustomer.gstNumber,
                products: savedProducts.map((p) => p._id),
                totalAmount,
                CGST,
                SGST,
                finalAmount,
                pdfPath,
            })
        }

        // Update Excel file
        updateExcelFile(invoiceHistory)

        currentDbSize = await calculateDatabaseSize()

        res.status(201).json({
            message: 'Invoice created/updated successfully',
            invoice,
            pdfPath,
            currentDbSize,
        })
    } catch (error) {
        res.status(500).json({
            message: 'Error creating/updating invoice',
            error: error.message,
        })
    }
}

// Helper function to update Excel file
const updateExcelFile = (invoice) => {
    const excelFilePath = path.join(
        __dirname,
        '../invoices/invoice_history.xlsx',
    )
    let workbook
    if (fs.existsSync(excelFilePath)) {
        workbook = xlsx.readFile(excelFilePath)
    } else {
        workbook = xlsx.utils.book_new()
    }

    const sheetName = 'Invoice History'
    let worksheet
    if (workbook.Sheets[sheetName]) {
        worksheet = workbook.Sheets[sheetName]
    } else {
        worksheet = xlsx.utils.json_to_sheet([])
        workbook.SheetNames.push(sheetName)
    }

    const newRow = {
        InvoiceNumber: invoice.invoiceNumber,
        Date: invoice.date,
        CustomerName: invoice.customerName,
        customerPhoneNumber: invoice.customerPhoneNumber,
        CustomerGstNumber: invoice.customerGstNumber,
        TotalAmount: invoice.totalAmount,
        CGST: invoice.CGST,
        SGST: invoice.SGST,
        FinalAmount: invoice.finalAmount,
        PdfPath: invoice.pdfPath,
    }

    const existingData = xlsx.utils.sheet_to_json(worksheet)
    const index = existingData.findIndex(
        (row) => row.InvoiceNumber === invoice.invoiceNumber,
    )
    if (index > -1) {
        existingData[index] = newRow // Update existing row
    } else {
        existingData.push(newRow) // Append new row
    }

    const updatedWorksheet = xlsx.utils.json_to_sheet(existingData)
    workbook.Sheets[sheetName] = updatedWorksheet
    xlsx.writeFile(workbook, excelFilePath)
}

// New endpoint to send the invoice via WhatsApp after confirmation
exports.sendInvoice = async (req, res) => {
    try {
        const { phone, pdfPath } = req.body

        // Send WhatsApp message
        await sendWhatsAppMessage(phone, pdfPath)

        res.status(200).json({
            message: 'Invoice sent successfully via WhatsApp',
        })
    } catch (error) {
        res.status(500).json({
            message: 'Error sending invoice via WhatsApp',
            error: error,
        })
    }
}

exports.deleteOldRecords = async (req, res) => {
    try {
        const { deleteFrom } = req.body

        if (!deleteFrom) {
            return res.status(400).json({
                message:
                    'Please specify the collection to delete records from.',
            })
        }

        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        let deletedCount = 0

        switch (deleteFrom) {
            case 'Invoice':
                deletedCount = await Invoice.deleteMany({
                    date: { $lt: thirtyDaysAgo },
                })
                break
            case 'InvoiceHistory':
                deletedCount = await InvoiceHistory.deleteMany({
                    date: { $lt: thirtyDaysAgo },
                })
                break
            case 'Product':
                deletedCount = await Product.deleteMany({
                    createdAt: { $lt: thirtyDaysAgo },
                })
                break
            case 'Customer':
                deletedCount = await Customer.deleteMany({
                    createdAt: { $lt: thirtyDaysAgo },
                })
                break
            default:
                return res
                    .status(400)
                    .json({ message: 'Invalid deleteFrom option' })
        }

        res.status(200).json({
            message: `Successfully deleted ${deletedCount.deletedCount} records from ${deleteFrom}.`,
        })
    } catch (error) {
        res.status(500).json({
            message: 'Error deleting old records',
            error: error.message,
        })
    }
}

exports.getInvoiceHistory = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            customerName,
            startDate,
            endDate,
        } = req.query

        const query = {}
        if (customerName) query.customerName = new RegExp(customerName, 'i')
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            }
        }

        const invoiceHistory = await InvoiceHistory.find(query)
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .sort({ date: -1 })

        const totalRecords = await InvoiceHistory.countDocuments(query)

        res.status(200).json({
            message: 'Invoice history fetched successfully',
            data: invoiceHistory,
            currentPage: page,
            totalPages: Math.ceil(totalRecords / limit),
            totalRecords,
        })
    } catch (error) {
        res.status(500).json({
            message: 'Error fetching invoice history',
            error: error.message,
        })
    }
}
