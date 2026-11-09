// Read one-time pairing QR codes from the mobile camera with ZXing.
import React, { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { BarcodeFormat, BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";

export const fetchClientMetadata = async (deviceId) => ({
  deviceId,
  deviceName: navigator.userAgent || "VEDA Mobile",
  timestamp: new Date().toISOString()
});

export default function QRScanner({ onScan, onError }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    let active = true;
    let controls;

    const startBrowserScanner = async () => {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
        if (result && active) {
          controlsRef.current?.stop();
          onScan(result.getText());
        } else if (error && error.name !== "NotFoundException" && active) {
          onError(`Camera scan failed: ${error.message}`);
        }
      });
      controlsRef.current = controls;
      if (!active) controls.stop();
    };

    const startScanner = async () => {
      if (Capacitor.getPlatform() === "android") {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (available) {
          const { barcodes } = await BarcodeScanner.scan({
            formats: [BarcodeFormat.QrCode]
          });
          if (active && barcodes[0]?.rawValue) onScan(barcodes[0].rawValue);
          else if (active) onError("No QR code was scanned.");
          return;
        }

        const { camera } = await BarcodeScanner.requestPermissions();
        if (camera !== "granted") {
          throw new Error("Camera permission is required to scan the pairing QR.");
        }
      }

      await startBrowserScanner();
    };

    startScanner().catch((error) => {
      if (active) onError(`Camera could not start: ${error.message}`);
    });

    return () => {
      active = false;
      controlsRef.current?.stop();
      controls?.stop();
      BarcodeScanner.removeAllListeners().catch((error) => {
        console.error("Could not stop the native QR scanner:", error);
      });
    };
  }, [onError, onScan]);

  return (
    <div>
      <video
        ref={videoRef}
        muted
        playsInline
        style={{ width: "100%", borderRadius: 12, background: "#020617" }}
      />
      <p>Point the camera at the desktop QR code.</p>
    </div>
  );
}
