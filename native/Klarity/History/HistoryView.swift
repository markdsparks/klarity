import KlarityCore
import SwiftUI

struct HistoryView: View {
    @Environment(AppModel.self) private var model
    @State private var confirmClear = false

    var body: some View {
        NavigationStack {
            Group {
                if model.history.isEmpty {
                    ContentUnavailableView("No scans yet", systemImage: "clock",
                                           description: Text("Products you scan or search show up here."))
                } else {
                    List(model.history, id: \.barcode) { entry in
                        if let r = entry.restaurant {
                            NavigationLink(value: Route.restaurant(itemID: r.itemId, removed: r.removedIds, added: r.addedIds)) {
                                HistoryRow(entry: entry)
                            }
                        } else {
                            NavigationLink(value: Route.product(barcode: entry.barcode)) { HistoryRow(entry: entry) }
                        }
                    }
                }
            }
            .navigationTitle("History")
            .toolbar {
                if !model.history.isEmpty {
                    Button("Clear", role: .destructive) { confirmClear = true }
                }
            }
            .confirmationDialog("Clear all scan history?", isPresented: $confirmClear, titleVisibility: .visible) {
                Button("Clear history", role: .destructive) { model.clearHistory() }
            }
            .klarityDestinations()
        }
    }
}

private struct HistoryRow: View {
    let entry: ScanHistoryEntry

    var body: some View {
        HStack(spacing: 12) {
            ProductThumbnail(url: entry.imageUrl.flatMap(URL.init(string:)), name: entry.productName)
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.productName).font(.body.weight(.medium)).lineLimit(1)
                HStack(spacing: 6) {
                    // Two axes, never combined — each dot names its axis.
                    Dot(color: entry.additiveGlance.style.color, label: "Additives \(entry.additiveGlance.style.label.lowercased())")
                    Dot(color: entry.nutritionTone.style.color, label: "Nutrition \(entry.nutritionTone.style.label.lowercased())")
                }
            }
            Spacer(minLength: 0)
            VStack(alignment: .trailing, spacing: 2) {
                Text(Date(timeIntervalSince1970: entry.scannedAt / 1000), format: .relative(presentation: .named))
                    .font(.caption).foregroundStyle(.secondary)
                if entry.scanCount > 1 { Text("×\(entry.scanCount)").font(.caption2).foregroundStyle(.tertiary) }
            }
        }
    }
}

private struct Dot: View {
    let color: Color
    let label: String
    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
    }
}
