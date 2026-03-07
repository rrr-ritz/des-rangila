import QRCode from "qrcode";

/**
 * Generate a QR code as a data URL (PNG base64).
 */
export async function generateQrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 300,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

/**
 * Generate a QR code as a Buffer (PNG).
 */
export async function generateQrBuffer(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 300,
    type: "png",
  });
}
