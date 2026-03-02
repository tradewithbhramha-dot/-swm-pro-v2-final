import QRCode from "qrcode";

/**
 * Generate QR code as Base64 encoded data URL
 */
export async function generateQRCode(data: string): Promise<string> {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 300,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    throw new Error("QR code generation failed");
  }
}

/**
 * Generate encrypted QR code with timestamp
 */
export function generateEncryptedQRId(
  type: string,
  entityId: number,
  timestamp: number = Date.now()
): string {
  // Simple format: TYPE:ID:TIMESTAMP
  // In production, implement proper encryption
  return `${type}:${entityId}:${timestamp}`;
}

/**
 * Parse QR code data
 */
export function parseQRCode(qrData: string): {
  type: string;
  id: number;
  timestamp: number;
} | null {
  try {
    const parts = qrData.split(":");
    if (parts.length < 3) return null;

    return {
      type: parts[0],
      id: parseInt(parts[1]),
      timestamp: parseInt(parts[2]),
    };
  } catch {
    return null;
  }
}
