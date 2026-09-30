import SwiftUI
import VisionKit

/// VisionKit's DataScanner — the system barcode scanner (replaces expo-camera). Unsupported in the
/// Simulator; ScanView falls back to Search there.
struct BarcodeScanner: UIViewControllerRepresentable {
    let onScan: (String) -> Void

    static var isAvailable: Bool { DataScannerViewController.isSupported && DataScannerViewController.isAvailable }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let vc = DataScannerViewController(
            // UPC-A is decoded as EAN-13 (leading 0); the OFF client's twin-code lookup handles both forms.
            recognizedDataTypes: [.barcode(symbologies: [.ean13, .ean8, .upce, .code128])],
            // .accurate: grocery barcodes are small and often on curved bottles/bags.
            qualityLevel: .accurate,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: true,
            isHighlightingEnabled: true)
        vc.delegate = context.coordinator
        return vc
    }

    func updateUIViewController(_ vc: DataScannerViewController, context: Context) {
        context.coordinator.onScan = onScan
        if !vc.isScanning { try? vc.startScanning() }
    }

    static func dismantleUIViewController(_ vc: DataScannerViewController, coordinator: Coordinator) {
        vc.stopScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    @MainActor
    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        var onScan: (String) -> Void
        private var last: (code: String, at: Date)?

        init(onScan: @escaping (String) -> Void) { self.onScan = onScan }

        // VisionKit often reports a barcode first WITHOUT its payload and decodes it a moment later as an
        // update — so all three callbacks feed the same handler (didAdd alone missed real scans on device).
        func dataScanner(_ scanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            handle(addedItems)
        }

        func dataScanner(_ scanner: DataScannerViewController, didUpdate updatedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            handle(updatedItems)
        }

        func dataScanner(_ scanner: DataScannerViewController, didTapOn item: RecognizedItem) {
            handle([item])
        }

        private func handle(_ items: [RecognizedItem]) {
            for item in items {
                guard case .barcode(let barcode) = item,
                      let raw = barcode.payloadStringValue?.trimmingCharacters(in: .whitespacesAndNewlines),
                      !raw.isEmpty else { continue }
                print("[Klarity scan] \(barcode.observation.symbology.rawValue) \(raw)")
                // The same code stays in frame for a while — don't re-fire it within a few seconds.
                if let last, last.code == raw, Date().timeIntervalSince(last.at) < 4 { continue }
                last = (raw, Date())
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                onScan(raw)
                return
            }
        }
    }
}
