// Scan pairing QR codes with Android's native camera or the browser camera.
import React, { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import {
  BarcodeFormat,
  BarcodeScanner,
  LensFacing
} from "@capacitor-mlkit/barcode-scanning";

export const fetchClientMetadata = async (deviceId) => ({
  deviceId,
  deviceName: navigator.userAgent || "VEDA Mobile",
  timestamp: new Date().toISOString()
});

export default function QRScanner({ onScan, onError, onCancel }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);

  useEffect(() => {
    let active = true;
    let controls;
    let nativeListener;
    let nativeScanStarted = false;
    let handledScan = false;
    let stopPromise;

    const stopNativeScanner = () => {
      if (stopPromise) return stopPromise;
      stopPromise = (async () => {
        document.body.classList.remove("barcode-scanner-active");
        await nativeListener?.remove();
        nativeListener = undefined;
        if (nativeScanStarted) {
          nativeScanStarted = false;
          await BarcodeScanner.stopScan();
        }
      })();
      return stopPromise;
    };

    const startNativeScanner = async () => {
      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) throw new Error("This device does not have a supported camera.");

      const { camera: currentPermission } = await BarcodeScanner.checkPermissions();
      const { camera } = currentPermission === "granted"
        ? { camera: currentPermission }
        : await BarcodeScanner.requestPermissions();
      if (camera !== "granted") {
        throw new Error("Camera permission is required. Allow camera access in Android settings and try again.");
      }

      nativeListener = await BarcodeScanner.addListener("barcodeScanned", async ({ barcode }) => {
        const value = barcode.rawValue || barcode.displayValue;
        if (!active || handledScan || !value) return;
        handledScan = true;
        try {
          await stopNativeScanner();
          if (active) onScan(value);
        } catch (error) {
          if (active) onError(`Could not stop the camera after scanning: ${error.message}`);
        }
      });

      document.body.classList.add("barcode-scanner-active");
      nativeScanStarted = true;
      await BarcodeScanner.startScan({
        formats: [BarcodeFormat.QrCode],
        lensFacing: LensFacing.Back
      });
      if (!active) await stopNativeScanner();
    };

    const startBrowserScanner = async () => {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } } },
        videoRef.current,
        (result, error) => {
          if (result && active) {
            controlsRef.current?.stop();
            onScan(result.getText());
          } else if (error && error.name !== "NotFoundException" && active) {
            onError(`Camera scan failed: ${error.message}`);
          }
        }
      );
      controlsRef.current = controls;
      if (!active) controls.stop();
    };

    const startScanner = Capacitor.getPlatform() === "android"
      ? startNativeScanner
      : startBrowserScanner;

    startScanner().catch(async (error) => {
      if (Capacitor.getPlatform() === "android") {
        try {
          await stopNativeScanner();
        } catch (stopError) {
          console.error("Could not stop the Android QR scanner:", stopError);
        }
      }
      if (active) onError(`Camera could not start: ${error.message}`);
    });

    return () => {
      active = false;
      controlsRef.current?.stop();
      controls?.stop();
      if (Capacitor.getPlatform() === "android") {
        stopNativeScanner().catch((error) => {
          console.error("Could not stop the Android QR scanner:", error);
        });
      }
    };
  }, [onError, onScan]);

  const isNativeAndroid = Capacitor.getPlatform() === "android";

  return (
    <div style={isNativeAndroid ? styles.nativeOverlay : styles.browserScanner}>
      <button onClick={onCancel} type="button" style={styles.cancelButton}>
        Cancel scan
      </button>
      {!isNativeAndroid && (
        <video
          ref={videoRef}
          muted
          playsInline
          style={{ width: "100%", borderRadius: 12, background: "#020617" }}
        />
      )}
      <p>Point the back camera at the desktop QR code.</p>
    </div>
  );
}

const styles = {
  browserScanner: { display: "grid", gap: 12 },
  cancelButton: {
    padding: "10px 16px",
    border: "1px solid #fff",
    borderRadius: 8,
    background: "#0f172a",
    color: "#fff"
  },
  nativeOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 24,
    boxSizing: "border-box",
    background: "transparent",
    color: "#fff"
  }
};
