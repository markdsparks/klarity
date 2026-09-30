import KlarityCore
import SwiftUI

/// Profile (spec 001/003): values lean resolves contested cases; conditions surface subgroup notes and
/// tighten thresholds; sex/age personalize fiber & protein; goal re-weights emphasis — never a calorie ledger.
struct YouView: View {
    @Environment(AppModel.self) private var model

    private let valueOptions: [(ProfileValues, String, String)] = [
        (.balanced, "Balanced", "Contested additives stay contested — both sides shown, no lean."),
        (.precaution, "Precaution-leaning", "When regulators genuinely disagree, treat it as “sometimes”."),
        (.risk, "Risk-tolerant", "When regulators genuinely disagree, treat it as “everyday”."),
    ]
    private let goalOptions: [(ProfileGoal, String, String)] = [
        (.unset, "Not set", "Balanced nutrition view (default)."),
        (.build, "Building muscle", "Protein reads as a positive signal."),
        (.lose, "Losing weight", "Tightens added sugar; highlights protein + fiber for fullness."),
        (.maintain, "Maintaining", "Balanced view, same as default."),
    ]

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            Form {
                Section {
                    ForEach(valueOptions, id: \.0) { value, label, hint in
                        OptionRow(label: label, hint: hint, selected: model.profile.values == value) { model.profile.values = value }
                    }
                } header: { Text("When experts disagree") }

                Section {
                    ForEach(ConditionDef.all) { c in
                        Toggle(isOn: Binding(
                            get: { model.profile.conditions.contains(c.id) },
                            set: { on in
                                model.profile.conditions.removeAll { $0 == c.id }
                                if on { model.profile.conditions.append(c.id) }
                            })) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(c.label)
                                Text(c.hint).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                } header: { Text("Conditions") } footer: { Text("Only changes which notes and thresholds you see. Stays on this device.") }

                Section("Reference intake") {
                    Picker("Sex", selection: Binding(get: { model.profile.sex ?? .unspecified }, set: { model.profile.sex = $0 })) {
                        Text("Prefer not to say").tag(ProfileSex.unspecified)
                        Text("Female").tag(ProfileSex.female)
                        Text("Male").tag(ProfileSex.male)
                    }
                    Picker("Age", selection: Binding(get: { model.profile.ageBand ?? .adult }, set: { model.profile.ageBand = $0 })) {
                        Text("19–50").tag(ProfileAgeBand.adult)
                        Text("51+").tag(ProfileAgeBand.older_adult)
                    }
                }

                Section("Goal") {
                    ForEach(goalOptions, id: \.0) { goal, label, hint in
                        OptionRow(label: label, hint: hint, selected: (model.profile.goal ?? .unset) == goal) { model.profile.goal = goal }
                    }
                }
            }
            .navigationTitle("You")
        }
    }
}

private struct OptionRow: View {
    let label: String
    let hint: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(label).foregroundStyle(.primary)
                    Text(hint).font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                if selected { Image(systemName: "checkmark").foregroundStyle(Color.accentColor).fontWeight(.semibold) }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
