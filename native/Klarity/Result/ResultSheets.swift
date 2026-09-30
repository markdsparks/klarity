import KlarityCore
import SwiftUI

enum ResultSheet: Identifiable {
    case ladder(axis: LadderAxis, level: LadderLevel, context: String, link: AdditiveLink?)
    case explainer(NutritionExplainer)
    case serving

    var id: String {
        switch self {
        case .ladder(let axis, let level, _, _): "ladder-\(axis)-\(level)"
        case .explainer(let e): "explainer-\(e.id)"
        case .serving: "serving"
        }
    }
}

/// Native sheets with detents replace the hand-rolled/@expo/ui sheets (ADR-004/005's bug class).
struct ResultSheetView: View {
    let sheet: ResultSheet
    let barcode: String

    var body: some View {
        switch sheet {
        case .ladder(let axis, let level, let context, let link):
            LadderSheet(explainer: VerdictLadder.explainer(axis, level), context: context, link: link)
        case .explainer(let e):
            ExplainerSheet(explainer: e)
        case .serving:
            ServingSizeSheet(barcode: barcode)
        }
    }
}

/// Spec 013 tap-through ladder: what this word means, why THIS product landed there, how we calculate it.
struct LadderSheet: View {
    let explainer: LadderExplainer
    let context: String
    let link: AdditiveLink?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section("What it means") { Text(explainer.body) }
                Section("Why this one") {
                    Text(context)
                    if let link {
                        // A real destination, not "tap it below" copy the covering sheet can't honor.
                        NavigationLink {
                            AdditiveDetailView(additiveID: link.id)
                        } label: {
                            HStack {
                                Text("See the evidence for \(link.name)")
                                Spacer()
                                Pill(text: link.verdict.label, color: link.verdict.color)
                            }
                        }
                    }
                }
                Section("How we calculate it") { Text(explainer.method).foregroundStyle(.secondary) }
                Section("The ladder") {
                    ForEach(explainer.steps, id: \.level) { step in
                        HStack(alignment: .top) {
                            Image(systemName: step.level == explainer.level ? "largecircle.fill.circle" : "circle")
                                .foregroundStyle(step.level == explainer.level ? Color.accentColor : .secondary)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(step.label).font(.body.weight(step.level == explainer.level ? .semibold : .regular))
                                Text(step.blurb).font(.subheadline).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle(explainer.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }
}

struct ExplainerSheet: View {
    let explainer: NutritionExplainer
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Text(explainer.body)
                } header: {
                    TierBadge(tier: explainer.tier)
                }
                Section("Source") { Text(explainer.source).foregroundStyle(.secondary) }
            }
            .navigationTitle(explainer.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }
}

/// Spec 023 — user-entered serving from the package; g/oz only (volume→weight needs density we don't have).
struct ServingSizeSheet: View {
    let barcode: String
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var unit: ServingUnit = .g
    @FocusState private var focused: Bool

    private var grams: Double? { Double(text.replacingOccurrences(of: ",", with: ".")).flatMap { toGrams($0, unit) } }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        TextField("Amount", text: $text).keyboardType(.decimalPad).focused($focused)
                        Picker("Unit", selection: $unit) {
                            Text("g").tag(ServingUnit.g)
                            Text("oz").tag(ServingUnit.oz)
                        }
                        .pickerStyle(.segmented).frame(width: 110)
                    }
                } footer: {
                    Text("Use the serving size printed on the package. We'll show nutrition for that amount instead of an estimate.")
                }
                if model.userServing(for: barcode) != nil {
                    Section {
                        Button("Remove my serving size", role: .destructive) {
                            model.setUserServing(nil, for: barcode); dismiss()
                        }
                    }
                }
            }
            .navigationTitle("Serving size")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { model.setUserServing(grams, for: barcode); dismiss() }.disabled(grams == nil)
                }
            }
            .onAppear {
                if let g = model.userServing(for: barcode) { text = g.formatted(.number.precision(.fractionLength(0...1))) }
                focused = true
            }
        }
        .presentationDetents([.medium])
    }
}

struct TierBadge: View {
    let tier: EvidenceTier

    var body: some View {
        Text("Tier \(tier.rawValue) · \(tierLabel)")
            .font(.caption.weight(.semibold))
            .foregroundStyle(tierColor)
            .textCase(nil)
    }

    private var tierLabel: String {
        switch tier {
        case .A: "Regulatory consensus / human trial"
        case .B: "Human observational / limited human"
        case .C: "Animal data"
        case .D: "In-vitro or misattributed"
        }
    }

    private var tierColor: Color {
        switch tier { case .A: Theme.good; case .B: Theme.sometimes; case .C: Theme.occasionally; case .D: .secondary }
    }
}
