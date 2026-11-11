// Read one-time pairing QR codes from the mobile camera with ZXing.
import React, { useEffect, useRef } from "react";

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

    startBrowserScanner().catch((error) => {
      if (active) onError(`Camera could not start: ${error.message}`);
    });

    return () => {
      active = false;
      controlsRef.current?.stop();
      controls?.stop();
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
