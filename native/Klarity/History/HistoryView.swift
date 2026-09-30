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
            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline) {
                    Text(entry.productName).font(.body.weight(.medium)).lineLimit(1)
                    Spacer(minLength: 8)
                    Text(Date(timeIntervalSince1970: entry.scannedAt / 1000), format: .relative(presentation: .named))
                        .font(.caption).foregroundStyle(.secondary).lineLimit(1).fixedSize()
                }
                // Two axes, never combined — each names its axis and shows its ladder position.
                HStack(spacing: 14) {
                    AxisReading(axis: "Additives", style: entry.additiveGlance.style, tone: entry.additiveGlance.cardTone)
                    AxisReading(axis: "Nutrition", style: entry.nutritionTone.style, tone: entry.nutritionTone.cardTone)
                    Spacer(minLength: 0)
                    if entry.scanCount > 1 { Text("×\(entry.scanCount)").font(.caption).foregroundStyle(.tertiary).fixedSize() }
                }
            }
        }
    }
}

private struct AxisReading: View {
    let axis: String
    let style: GlanceStyle
    let tone: Tone

    var body: some View {
        HStack(spacing: 5) {
            Text(axis).font(.caption).foregroundStyle(.secondary).lineLimit(1).fixedSize()
            if let level = style.level {
                LadderMark(level: level, color: tone.mark)
            } else {
                Text("—").font(.caption).foregroundStyle(.tertiary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(axis): \(style.label)")
    }
}
