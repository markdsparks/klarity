import KlarityCore
import SwiftUI

/// The evidence trail for one hand-authored additive (port of src/app/additive/[id].tsx).
struct AdditiveDetailView: View {
    let additiveID: String
    @Environment(AppModel.self) private var model

    var body: some View {
        if let additive = AdditiveData.additive(id: additiveID) {
            let result = resolveVerdict(additive, profile: model.profile)
            List {
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack(spacing: 6) {
                            Pill(text: result.verdict.label, tone: result.verdict.tone)
                            // Resolving for the user's values must never hide that regulators disagree.
                            if additive.baseVerdict == .contested && result.verdict != .contested {
                                Pill(text: "Contested", tone: .contested)
                            }
                            if let e = additive.eNumber { Text(e).font(.caption).foregroundStyle(.secondary) }
                        }
                        Text(additive.role).font(.subheadline).foregroundStyle(.secondary)
                    }
                }
                if let note = result.profileNote {
                    Section("For you") { Text(note) }
                }
                Section("Summary") { Text(additive.headline).font(.body.weight(.medium)) }
                Section("Exposure context") {
                    LabeledContent("Typical", value: additive.exposure.typical)
                    LabeledContent("Concerning", value: additive.exposure.concerning)
                    Text(additive.exposure.note).font(.subheadline).foregroundStyle(.secondary)
                }
                Section("Evidence trail") {
                    ForEach(Array(additive.evidence.enumerated()), id: \.offset) { _, item in EvidenceRow(item: item) }
                }
                if let q = additive.openQuestion {
                    Section("Open question") { Text(q.text) }
                }
                if let guidance = additive.contestedGuidance {
                    Section("Practical take") { Text(guidance) }
                }
            }
            .navigationTitle(additive.name)
        } else {
            ContentUnavailableView("Additive not found", systemImage: "questionmark.circle")
        }
    }
}

private struct EvidenceRow: View {
    let item: EvidenceItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                TierBadge(tier: item.tier)
                Spacer()
                switch item.applies {
                case .no: Pill(text: "Dismissed", tone: .neutral)
                case .split: Pill(text: "Split", tone: .contested)
                case .yes: EmptyView()
                }
            }
            // Tier D misattributed evidence is dismissed, not elevated (the carrageenan rule) — shown struck through.
            Text(item.claim).font(.body.weight(.medium)).strikethrough(item.applies == .no, color: .secondary)
            Text(item.why).font(.subheadline).foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

/// EFSA regulatory-status additive (spec 002/011): permitted status + ADI, deliberately no editorial verdict.
struct RegulatoryDetailView: View {
    let eNumber: String

    var body: some View {
        if let reg = ENumberIndex.regulatory[eNumber] {
            List {
                Section {
                    Pill(text: "Regulatory status", tone: .neutral)
                    Text("EFSA permits this as a food additive. We haven't authored a dose/frequency verdict for it yet, so there's no Everyday/Sometimes call here.")
                        .font(.subheadline).foregroundStyle(.secondary)
                }
                Section("Acceptable Daily Intake") {
                    switch reg.adi {
                    case .value(let v, let unit)?:
                        Text("\(v.formatted()) \(unit)").font(.body.weight(.medium))
                        Text("The amount EFSA considers safe to consume every day over a lifetime.").font(.subheadline).foregroundStyle(.secondary)
                    case .notNecessary?:
                        Text("No limit needed").font(.body.weight(.medium))
                        Text("EFSA found it safe enough that no numerical limit is required.").font(.subheadline).foregroundStyle(.secondary)
                    case nil:
                        Text("No single current ADI on record — we won't show an outdated or guessed number.").foregroundStyle(.secondary)
                    }
                }
                Section("Source") {
                    if let url = URL(string: reg.sourceUrl) { Link(reg.sourceLabel, destination: url) } else { Text(reg.sourceLabel) }
                }
            }
            .navigationTitle("\(reg.name) (\(reg.eNumber))")
        } else {
            ContentUnavailableView("Not found", systemImage: "questionmark.circle")
        }
    }
}
