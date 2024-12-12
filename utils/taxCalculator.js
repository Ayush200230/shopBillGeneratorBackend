const Hsn = require('../models/Hsn')

exports.calculateFinalAmount = async (products) => {
    // Group products by HSN code

    const hsnGroups = products.reduce((groups, product) => {
        const key = product.HSN
        if (!groups[key]) {
            groups[key] = []
        }
        groups[key].push(product)
        return groups
    }, {})

    let totalAmount = 0
    let totalCGST = 0
    let totalSGST = 0

    // Process each HSN group
    for (const [hsnCode, groupProducts] of Object.entries(hsnGroups)) {
        // Calculate total taxable value for this HSN group
        const taxableValue = groupProducts.reduce(
            (sum, product) => sum + product.amount,
            0,
        )

        // Find HSN rates for this group
        const hsnRates = await Hsn.findOne({ HSN: hsnCode })

        // Calculate CGST and SGST based on total taxable value
        const CGST = parseFloat(
            ((taxableValue * hsnRates.CGST) / 100).toFixed(2),
        )

        const SGST = parseFloat(
            ((taxableValue * hsnRates.SGST) / 100).toFixed(2),
        )

        totalAmount += taxableValue
        totalCGST += CGST
        totalSGST += SGST
    }

    const finalAmount = totalAmount + totalCGST + totalSGST
    return { totalAmount, CGST: totalCGST, SGST: totalSGST, finalAmount }
}
