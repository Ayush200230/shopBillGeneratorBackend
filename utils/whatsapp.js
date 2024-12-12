const qrcode = require('qrcode-terminal')
const { Client, MessageMedia } = require('whatsapp-web.js')
const fs = require('fs')
const path = require('path')
const cheerio = require('cheerio')

// Load session data if it exists
let sessionData
const sessionFilePath = path.join(
    __dirname,
    '../.wwebjs_cache/2.3000.1018812704.html',
)

console.log('Checking for session file at:', sessionFilePath)

if (fs.existsSync(sessionFilePath)) {
    console.log('Session file exists. Reading content...')
    const htmlContent = fs.readFileSync(sessionFilePath, 'utf-8')
    const $ = cheerio.load(htmlContent)

    // Extract session data from the HTML
    const sessionScript = $('script#envjson').html()
    if (sessionScript) {
        try {
            sessionData = JSON.parse(sessionScript)
            console.log('Session data loaded successfully:', sessionData)
        } catch (error) {
            console.error('Error parsing session data:', error)
        }
    } else {
        console.error('Session script not found in HTML.')
    }
} else {
    console.error('Session file does not exist.')
}

// Initialize WhatsApp Web.js Client with session data
const client = new Client({
    session: sessionData, // Use the extracted session data
})

// Event listener for QR code generation
client.on('qr', (qr) => {
    console.log('QR Code received, scan it!')
    // Generate and display QR code in terminal
    qrcode.generate(qr, { small: true })
})

// Event listener for successful authentication
client.on('authenticated', () => {
    console.log('Authenticated successfully!')
})

// Event listener for authentication failure
client.on('auth_failure', () => {
    console.error('Authentication failed, please check your session data.')
})

// Event listener for ready state
client.on('ready', () => {
    console.log('WhatsApp Client is ready')
})

// Start the client
client.initialize().catch((error) => {
    console.error('Error initializing client:', error)
})

exports.sendWhatsAppMessage = async (to, pdfPath) => {
    try {
        // Check if the client is ready
        console.log('Checking client status...')
        if (!client.info || !client.info.wid) {
            throw new Error(
                'WhatsApp client is not ready. Please ensure the client is initialized and logged in.',
            )
        }

        // Check if the PDF file exists
        if (!fs.existsSync(pdfPath)) {
            throw new Error(`PDF file does not exist at path: ${pdfPath}`)
        }

        console.log('Sending message to:', `${to}@c.us`)

        // Send a text message first
        const message = `Hello! Here is your invoice.`
        await client.sendMessage(`${to}@c.us`, message)

        // Create a MessageMedia object for the PDF
        const media = MessageMedia.fromFilePath(pdfPath)
        await client.sendMessage(`${to}@c.us`, media)

        console.log('WhatsApp message sent successfully')
    } catch (error) {
        console.error('Error sending WhatsApp message:', error)
    }
}
