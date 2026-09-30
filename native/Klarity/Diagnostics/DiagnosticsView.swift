import KlarityCore
import SwiftUI

/// "How Klarity's doing" (spec 009): how recent scans resolved — a mirror of where the data is strong and
/// where it has gaps. Local-only; export is an explicit user action.
struct DiagnosticsView: View {
    @Environment(AppModel.self) private var model
    @State private var exportURL: URL?
    @State private var confirmClear = false

    private static let order: [ScanOutcome] = [.confident, .clean, .restaurant, .unratedAdditive, .regulatoryOnly, .thinNutrition, .notFound]

    var body: some View {
        let summary = summarize(model.outcomes)
        List {
            if summary.total == 0 {
                ContentUnavailableView("No scans logged yet", systemImage: "chart.bar",
                                       description: Text("Scan a few products and check back."))
            } else {
                Section {
                    ForEach(Self.order, id: \.self) { o in
                        OutcomeRow(outcome: o, count: summary.outcomes[o.rawValue] ?? 0, total: summary.total)
                    }
                } header: {
                    Text("Last \(summary.total) scans")
                } footer: {
                    Text("Green rows are solid verdicts. Amber rows are gaps — each one points at the data to improve next.")
                }
                if !summary.sugarBasis.isEmpty {
                    Section("What sugar verdicts rested on") {
                        ForEach(summary.sugarBasis.sorted { $0.value > $1.value }, id: \.key) { key, count in
                            LabeledContent(SugarBasis(rawValue: key)?.label ?? key, value: "\(count)")
                        }
                    }
                }
            }

            Section("Feedback (\(model.feedback.count))") {
                if model.feedback.isEmpty {
                    Text("Nothing yet. Use \"Something look off?\" on any result.").foregroundStyle(.secondary)
                }
                ForEach(Array(model.feedback.prefix(20).enumerated()), id: \.offset) { _, f in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(f.category.label).font(.subheadline.weight(.medium))
                        if let name = f.productName ?? f.barcode { Text(name).font(.caption).foregroundStyle(.secondary) }
                        if let note = f.note { Text(note).font(.subheadline) }
                    }
                }
            }

            Section {
                if let exportURL {
                    ShareLink(item: exportURL, subject: Text("Klarity diagnostics")) {
                        Label("Export data (JSON)", systemImage: "square.and.arrow.up")
                    }
                }
                Button("Clear diagnostics", role: .destructive) { confirmClear = true }
            } footer: {
                Text("Stays on this device unless you export it.")
            }
        }
        .navigationTitle("How Klarity's doing")
        .onAppear { exportURL = model.writeDiagnosticsExport() }
        .onChange(of: model.feedback.count) { exportURL = model.writeDiagnosticsExport() }
        .confirmationDialog("Clear all scan logs and feedback?", isPresented: $confirmClear, titleVisibility: .visible) {
            Button("Clear diagnostics", role: .destructive) { model.clearDiagnostics(); exportURL = model.writeDiagnosticsExport() }
        }
    }
}

private struct OutcomeRow: View {
    let outcome: ScanOutcome
    let count: Int
    let total: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(outcome.label)
                Spacer()
                Text("\(count)").monospacedDigit().foregroundStyle(.secondary)
            }
            GeometryReader { geo in
                Capsule().fill(Color(.tertiarySystemFill))
                    .overlay(alignment: .leading) {
                        Capsule().fill(outcome.tone.mark)
                            .frame(width: total > 0 ? max(count > 0 ? 6 : 0, geo.size.width * CGFloat(count) / CGFloat(total)) : 0)
                    }
            }
            .frame(height: 6)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}

extension ScanOutcome {
    var label: String {
        switch self {
        case .confident: "Confident verdict"
        case .clean: "No additives"
        case .unratedAdditive: "Unrated additive"
        case .regulatoryOnly: "Permitted-status only"
        case .thinNutrition: "No nutrition data"
        case .notFound: "Not found"
        case .restaurant: "Restaurant item"
        }
    }
    /// Gaps read amber (a "sometimes" of data quality), solid results green, restaurants neutral.
    var tone: Tone {
        switch self {
        case .confident, .clean: .everyday
        case .restaurant: .neutral
        default: .sometimes
        }
    }
}

extension SugarBasis {
    var label: String {
        switch self {
        case .addedKnown: "Added sugar (from label)"
        case .totalOnly: "Total — couldn't split added"
        case .wholeFood: "Whole-food matrix"
        case .disqualified: "Juice/soda — scored on total"
        case .negligible: "Low sugar"
        }
    }
}
