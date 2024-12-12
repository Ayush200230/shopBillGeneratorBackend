const PDFDocument = require('pdfkit')
const fs = require('fs')
const path = require('path')
const Hsn = require('../models/Hsn')

exports.generatePDF = async (invoice, products) => {
    const dir = path.join(__dirname, '../invoices')
    const outputPath = path.join(dir, `invoice-${invoice.invoiceNumber}.pdf`)

    // Create the invoices directory if it doesn't exist
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }

    const doc = new PDFDocument({ margin: 30 })
    doc.pipe(fs.createWriteStream(outputPath))

    // Header section
    doc.fontSize(12).text('AGARWAL PUSTAK BHANDAR & GIFT SHOP - 1/4/2022', {
        align: 'center',
    })
    doc.fontSize(10).text('AWAS VIKAS COLONY, RUDRAPUR', { align: 'center' })
    doc.moveDown(1)

    // Invoice Details
    doc.fontSize(10).text(`Invoice No: ${invoice.invoiceNumber}`, {
        continued: true,
    })
    doc.text(`  Date: ${invoice.date}`, { align: 'right' })
    doc.text(`GSTIN/UIN: 05AHMPA2414K1ZO`, { continued: true })

    doc.moveDown(0.5)
    doc.text(`Consignee (Ship to): ${invoice.customerName}`)
    if (invoice.customerGstNumber) {
        doc.text(`Customer GSTIN/UIN: ${invoice.customerGstNumber}`)
    }
    doc.text(`State Name: Uttarakhand, Code: 05`)
    doc.moveDown(1)

    // Product Table Header
    const tableTop = doc.y
    const productTableColumns = [
        'Sl No.',
        'Description of Goods',
        'HSN/SAC',
        'Quantity',
        'Rate',
        'GST',
        'Amount',
    ]
    const columnWidths = [30, 150, 60, 60, 60, 50, 80]
    const rowHeight = 20

    productTableColumns.forEach((header, i) => {
        doc.text(
            header,
            50 + columnWidths.slice(0, i).reduce((a, b) => a + b, 0),
            tableTop,
        )
    })
    doc.moveDown(0.5)

    // Product Table Content
    products.forEach((p, index) => {
        const rowY = tableTop + rowHeight * (index + 1)
        doc.text(index + 1, 50, rowY) // Sl No.
        doc.text(p.name, 80, rowY) // Description
        doc.text(p.HSN, 230, rowY) // HSN/SAC
        doc.text(p.quantity, 290, rowY) // Quantity
        doc.text(p.rate.toFixed(2), 350, rowY) // Rate
        doc.text(p.gst.toFixed(2), 410, rowY) // GST
        doc.text(p.amount.toFixed(2), 460, rowY) // Amount
    })

    const totalRowY = tableTop + rowHeight * (products.length + 1)
    doc.moveTo(50, totalRowY).lineTo(540, totalRowY).stroke() // Line above totals

    // Totals
    doc.fontSize(10).text('Total Amount:', 370, totalRowY + 10)
    doc.text(invoice.totalAmount.toFixed(2), 460, totalRowY + 10)

    doc.text('CGST:', 370, totalRowY + 30)
    doc.text(invoice.CGST.toFixed(2), 460, totalRowY + 30)

    doc.text('SGST:', 370, totalRowY + 50)
    doc.text(invoice.SGST.toFixed(2), 460, totalRowY + 50)

    doc.text('Final Amount:', 370, totalRowY + 70)
    doc.text(invoice.finalAmount.toFixed(2), 460, totalRowY + 70, {
        underline: true,
    })

    // HSN Summary Table
    const hsnSummaryTableTop = doc.y + 20
    doc.moveDown(2)
    doc.fontSize(10).text('HSN Summary', { align: 'center', underline: true })

    // HSN Summary Table Header
    const hsnTableColumns = [
        'HSN',
        'Taxable Value',
        'CGST %',
        'CGST Amt',
        'SGST %',
        'SGST Amt',
        'Total Tax',
    ]
    const hsnColumnWidths = [60, 80, 50, 60, 50, 60, 70]

    // Group products by HSN
    const hsnGroups = products.reduce((groups, product) => {
        const key = product.HSN
        if (!groups[key]) {
            groups[key] = {
                products: [],
                taxableValue: 0,
                hsnCode: key,
            }
        }
        groups[key].products.push(product)
        groups[key].taxableValue += product.amount
        return groups
    }, {})

    // Render HSN Summary Table Header
    hsnTableColumns.forEach((header, i) => {
        doc.text(
            header,
            50 + hsnColumnWidths.slice(0, i).reduce((a, b) => a + b, 0),
            hsnSummaryTableTop,
        )
    })

    // Render HSN Summary Table Content
    let hsnTableY = hsnSummaryTableTop + 20
    let totalTaxableValue = 0
    let totalCGST = 0
    let totalSGST = 0

    // Fetch HSN rates for all unique HSN codes
    const hsnRates = await Hsn.find({
        HSN: { $in: Object.keys(hsnGroups) },
    })

    // Create a map of HSN codes to their rates
    const hsnRateMap = hsnRates.reduce((map, hsn) => {
        map[hsn.HSN] = {
            CGST: hsn.CGST,
            SGST: hsn.SGST,
        }
        return map
    }, {})

    Object.entries(hsnGroups).forEach(([hsnCode, group]) => {
        // Get HSN rates
        const rates = hsnRateMap[hsnCode] || { CGST: 0, SGST: 0 }

        // Calculate taxes
        const cgstAmount = parseFloat(
            ((group.taxableValue * rates.CGST) / 100).toFixed(2),
        )
        const sgstAmount = parseFloat(
            ((group.taxableValue * rates.SGST) / 100).toFixed(2),
        )
        const totalTax = cgstAmount + sgstAmount

        // Render row
        doc.text(hsnCode, 50, hsnTableY)
        doc.text(group.taxableValue.toFixed(2), 110, hsnTableY)
        doc.text(`${rates.CGST}%`, 190, hsnTableY)
        doc.text(cgstAmount.toFixed(2), 240, hsnTableY)
        doc.text(`${rates.SGST}%`, 300, hsnTableY)
        doc.text(sgstAmount.toFixed(2), 350, hsnTableY)
        doc.text(totalTax.toFixed(2), 410, hsnTableY)

        // Accumulate totals
        totalTaxableValue += group.taxableValue
        totalCGST += cgstAmount
        totalSGST += sgstAmount

        hsnTableY += 20
    })

    // Total Row
    doc.moveTo(50, hsnTableY).lineTo(540, hsnTableY).stroke()
    doc.text('Total', 50, hsnTableY + 10)
    doc.text(totalTaxableValue.toFixed(2), 110, hsnTableY + 10)
    doc.text(totalCGST.toFixed(2), 240, hsnTableY + 10)
    doc.text(totalSGST.toFixed(2), 350, hsnTableY + 10)
    doc.text((totalCGST + totalSGST).toFixed(2), 410, hsnTableY + 10)

    // Footer
    doc.moveDown(2)
    doc.fontSize(10).text('This is a Computer Generated Invoice', {
        align: 'center',
    })

    doc.end()
    return outputPath
}
