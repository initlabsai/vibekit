/**
 * QR Code Generator
 *
 * Generates QR codes for wallet pairing URIs.
 * Produces both ASCII art (for terminal) and data URL (for UIs).
 */

import QRCode from 'qrcode'

/**
 * Generated QR code in multiple formats.
 */
export interface GeneratedQR {
  /** ASCII art representation for terminal display */
  ascii: string
  /** Data URL (PNG base64) for UI display */
  dataUrl: string
}

/**
 * Generate a QR code from a pairing URI.
 *
 * @param uri - Pairing URI (WalletConnect or other)
 * @returns QR code in ASCII and data URL formats
 */
export async function generateQR(uri: string): Promise<GeneratedQR> {
  // Generate ASCII QR code for terminal
  const ascii = await QRCode.toString(uri, {
    type: 'terminal',
    small: true,
    margin: 1,
  })

  // Generate data URL for UI display
  const dataUrl = await QRCode.toDataURL(uri, {
    margin: 2,
    width: 256,
    errorCorrectionLevel: 'M',
  })

  return { ascii, dataUrl }
}
