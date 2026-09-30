import KlarityCore
import SwiftUI

/// Port of src/components/nutrition-card.tsx (spec 016): summary, one consistent annotation row per
/// profile note / context line — each individually tappable when an explainer exists — plus the numbers.
struct NutritionCard: View {
    let data: NutritionCardData
    @Binding var sheet: ResultSheet?

    private var sn: ServingNutrients { data.servingNutrients }

    private struct Annotation: Identifiable { let id: String; let text: String; let explainer: NutritionExplainer? }

    private var annotations: [Annotation] {
        var out = (data.nutrition.profileNotes + data.nutrition.contextLines)
            .map { Annotation(id: $0, text: $0, explainer: NutritionExplainers.explainer(forLine: $0)) }
        if data.personalizedReference {
            out.append(Annotation(id: "personalized_reference",
                                  text: "Fiber & protein %DV use your reference intake (sex/age), not the generic label value.",
                                  explainer: NutritionExplainers.explainer(id: "personalized_reference")))
        }
        return out
    }

    var body: some View {
        Card(accent: data.nutrition.tone.cardAccent) {
            Button {
                sheet = .ladder(axis: .nutrition, level: nutritionToneToLadderLevel(data.nutrition.tone),
                                context: data.nutrition.summary, link: nil)
            } label: {
                HStack {
                    Text("Nutrition").font(.headline)
                    Spacer()
                    Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            servingLine
            Text(data.nutrition.summary).font(.body.weight(.medium))
            ForEach(data.basisNotes, id: \.self) { Text($0).font(.caption).foregroundStyle(.secondary) }

            ForEach(annotations) { a in
                Button { if let e = a.explainer { sheet = .explainer(e) } } label: {
                    HStack(alignment: .firstTextBaseline) {
                        Text(a.text).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.leading)
                        Spacer(minLength: 6)
                        if a.explainer != nil { Image(systemName: "chevron.right").font(.caption2.weight(.semibold)).foregroundStyle(.tertiary) }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .disabled(a.explainer == nil)
            }

            Divider().padding(.vertical, 2)
            nutrientGrid
        }
    }

    @ViewBuilder private var servingLine: some View {
        let meta = [data.servingText, data.badge].compactMap { $0 }.joined(separator: " · ")
        if !meta.isEmpty || data.servingEditable {
            HStack(spacing: 6) {
                if !meta.isEmpty { Text(meta).foregroundStyle(.secondary) }
                if data.servingEditable {
                    Button(sn.basis == .userServing ? "Edit serving size" : "Set serving size") { sheet = .serving }
                        .font(.caption.weight(.semibold))
                }
            }
            .font(.caption)
        }
    }

    private var nutrientGrid: some View {
        let sugarLabel = sn.addedSugarDv != nil ? "Added sugar" : "Sugar"
        let sugarHot = sugarBasisDv(sn) >= data.sugarThreshold
        return Grid(alignment: .leading, horizontalSpacing: 12, verticalSpacing: 6) {
            NutrientRow(label: "Calories", value: sn.calories.map { "\(Int($0.rounded()))" }, dv: nil)
            NutrientRow(label: "Sat fat", value: grams(sn.satFat), dv: sn.satFatDv)
            NutrientRow(label: "Sodium", value: sn.sodium.map { "\(Int(($0 * 1000).rounded())) mg" }, dv: sn.sodiumDv)
            NutrientRow(label: sugarLabel, value: grams(sn.addedSugar ?? sn.sugar), dv: sn.addedSugarDv ?? sn.sugarDv, hot: sugarHot)
            NutrientRow(label: "Fiber", value: grams(sn.fiber), dv: sn.fiberDv, positive: true)
            NutrientRow(label: "Protein", value: grams(sn.protein), dv: sn.proteinDv, positive: true)
        }
        .font(.subheadline)
    }

    private func grams(_ v: Double?) -> String? {
        v.map { $0 >= 10 ? "\(Int($0.rounded())) g" : "\($0.formatted(.number.precision(.fractionLength(0...1)))) g" }
    }
}

private struct NutrientRow: View {
    let label: String
    let value: String?
    let dv: Int?
    var hot = false
    var positive = false

    var body: some View {
        GridRow {
            Text(label).foregroundStyle(.secondary)
            Text(value ?? "—").monospacedDigit()
            Spacer()
            Text(dv.map { "\($0)%" } ?? "").monospacedDigit()
                .foregroundStyle(color)
                .fontWeight(hot ? .semibold : .regular)
                .gridColumnAlignment(.trailing)
        }
    }

    private var color: Color {
        guard let dv else { return .secondary }
        if positive { return dv >= 20 ? Theme.good : .secondary }
        return hot || dv >= 20 ? Theme.occasionally : .secondary
    }
}
