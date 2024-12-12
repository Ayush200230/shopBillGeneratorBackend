const axios = require('axios')

exports.getCustomerByGST = async (req, res) => {
    try {
        const { gstNumber } = req.params

        // Validate the GST number format
        const gstRegex =
            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/
        if (!gstRegex.test(gstNumber)) {
            return res
                .status(400)
                .json({ message: 'Invalid GST number format' })
        }

        // API URL and headers
        const apiUrl = `https://www.knowyourgst.com/developers/gstincall/?gstin=${gstNumber}`
        const apiKey = process.env.GST_API_KEY // API key

        // Fetch details from the external API
        const response = await axios.get(apiUrl, {
            headers: {
                passthrough: apiKey,
            },
        })

        // Check if the response is successful
        if (response.data.status_code !== 1) {
            return res.status(404).json({
                message: 'GST number not found in the official database',
            })
        }

        // Extract relevant data from the response
        const {
            gstin,
            'legal-name': legalName,
            'trade-name': tradeName,
            pan,
            'dealer-type': dealerType,
            'registration-date': registrationDate,
            'entity-type': entityType,
            business,
            status,
            adress, // Note: This should be 'address' for correct spelling
        } = response.data

        // Construct the address object
        const address = {
            floor: adress.floor,
            buildingNumber: adress.bno,
            street: adress.street,
            location: adress.location,
            state: adress.state,
            pincode: adress.pincode,
            city: adress.city,
        }

        // Return the structured customer data
        res.status(200).json({
            gstin,
            legalName,
            tradeName,
            pan,
            dealerType,
            registrationDate,
            entityType,
            business,
            status,
            address,
        })
    } catch (error) {
        console.error('Error fetching GST details:', error.message)
        res.status(500).json({ message: 'Error fetching GST details', error })
    }
}
