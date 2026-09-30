import KlarityCore
import SwiftUI

/// A chain menu item with the build customizer (port of src/app/result/restaurant.tsx, specs 004–006).
/// Recompute is synchronous: every toggle re-derives both axes through the same pure engine functions.
struct RestaurantResultView: View {
    @Environment(AppModel.self) private var model
    @State private var build: RestaurantBuild?
    @State private var sheet: ResultSheet?
    @State private var optionSheet: OptionSheetKind?
    @State private var recorded = false
    @State private var feedbackOpen = false

    private let itemID: String
    private let seedRemoved: [String]
    private let seedAdded: [String]

    init(itemID: String, removed: [String], added: [String]) {
        self.itemID = itemID; self.seedRemoved = removed; self.seedAdded = added
    }

    var body: some View {
        Group {
            if let build, let a = RestaurantAnalysis(build, profile: model.profile) {
                content(build: build, analysis: a)
            } else if build == nil, Restaurants.menuItem(id: itemID) != nil {
                ProgressView()
            } else {
                ContentUnavailableView("Menu item not found", systemImage: "fork.knife")
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Theme.heroBackground, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .onAppear {
            if build == nil, let item = Restaurants.menuItem(id: itemID) {
                build = RestaurantBuild(item: item, removedIds: seedRemoved, addedIds: seedAdded)
            }
        }
        .onChange(of: build) { _, b in persist(b) }
        .sheet(item: $sheet) { ResultSheetView(sheet: $0, barcode: restaurantHistoryKey(itemID)) }
        .sheet(item: $optionSheet) { kind in
            OptionSheet(kind: kind, build: Binding(get: { build! }, set: { build = $0 }))
        }
    }

    /// First appearance records the scan (per-item frequency merge); later build edits update in place.
    private func persist(_ b: RestaurantBuild?) {
        guard let b, let record = RestaurantAnalysis.historyRecord(b, now: Date().timeIntervalSince1970 * 1000) else { return }
        if recorded { model.updateRestaurantBuild(record); return }
        recorded = true
        model.recordScan(record)
        model.logOutcome(ScanOutcomeRecord(at: record.scannedAt, source: .restaurant, outcome: .restaurant,
                                           productName: record.productName, barcode: record.barcode))
    }

    private func content(build: RestaurantBuild, analysis a: RestaurantAnalysis) -> some View {
        ScrollView {
            VStack(spacing: 0) {
                VerdictHero(eyebrow: a.chain.name, title: build.item.name, subtitle: build.item.serving, imageURL: nil,
                            sentence: a.sentence, heroTone: a.heroTone, glance: a.glance, nutrition: a.nutritionCard.nutrition,
                            additiveContext: a.additiveContext, sheet: $sheet) {
                    if !a.removed.isEmpty || !a.added.isEmpty { ModifierChips(removed: a.removed, added: a.added) }
                }
                VStack(spacing: 14) {
                    BuildCard(build: Binding(get: { self.build ?? build }, set: { self.build = $0 }), optionSheet: $optionSheet)
                    AdditivesCard(results: a.additiveResults)
                    NutritionCard(data: a.nutritionCard, sheet: $sheet)
                    Text("Source: \(a.chain.source.label) (FDA menu-labeling disclosure) · retrieved \(a.chain.source.retrieved)"
                         + (a.chain.coverage == .nutritionOnly ? " · nutrition only — ingredient statements not published" : ""))
                        .font(.caption).foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 4)
                    Button("Something look off?") { feedbackOpen = true }.font(.subheadline)
                }
                .padding(16)
            }
        }
        .background(Color(.systemGroupedBackground))
        .sheet(isPresented: $feedbackOpen) {
            FeedbackSheet(source: .restaurant, categories: [.wrongVerdict, .wrongData, .missingAdditive, .other],
                          productName: "\(a.chain.name) \(build.item.name)", barcode: restaurantHistoryKey(build.item.id))
        }
    }
}

private struct ModifierChips: View {
    let removed: [MenuComponent]
    let added: [CatalogComponent]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(removed, id: \.id) { Pill(text: "– \($0.name)", color: Theme.sometimesOnDark) }
                ForEach(added, id: \.id) { Pill(text: "+ \($0.name)", color: Theme.goodOnDark) }
            }
        }
    }
}

private struct BuildCard: View {
    @Binding var build: RestaurantBuild
    @Binding var optionSheet: OptionSheetKind?

    var body: some View {
        Card {
            Text("Your build").font(.headline)
            Text("Toggle toppings or swap choices — both axes update instantly.").font(.caption).foregroundStyle(.secondary)

            ForEach(build.toggleComponents, id: \.id) { c in
                if c.removable {
                    Toggle(isOn: Binding(get: { !build.removedIds.contains(c.id) }, set: { _ in build.toggleComponent(c.id) })) {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(c.name).strikethrough(build.removedIds.contains(c.id), color: .secondary)
                            if let cal = c.nutrition?.calories { Text("−\(Int(cal)) cal when removed").font(.caption).foregroundStyle(.secondary) }
                        }
                    }
                    .tint(Theme.good)
                } else {
                    HStack { Text(c.name); Spacer(); Pill(text: "Base", tone: .neutral) }
                }
            }

            ForEach(build.item.slots ?? [], id: \.id) { slot in
                Button { optionSheet = .slot(slot) } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(slot.label).foregroundStyle(.primary)
                            Text(build.selection(for: slot).flatMap { Restaurants.catalogComponent(id: $0)?.name } ?? "None")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text("Change").font(.subheadline.weight(.semibold)).foregroundStyle(Theme.goodText)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }

            if !(build.item.addOnIds ?? []).isEmpty {
                Button { optionSheet = .addOns } label: {
                    Label("Add to this build", systemImage: "plus.circle").font(.subheadline.weight(.semibold))
                }
                .tint(Theme.good)
            }
        }
    }
}

enum OptionSheetKind: Identifiable {
    case slot(ItemSlot)
    case addOns
    var id: String { if case .slot(let s) = self { "slot-\(s.id)" } else { "addons" } }
}

/// Each option shows its calorie delta AND its additive consequence at the moment of decision (spec 006 Q3).
/// Slots are single-select (close on pick); add-ons are multi-select.
private struct OptionSheet: View {
    let kind: OptionSheetKind
    @Binding var build: RestaurantBuild
    @Environment(\.dismiss) private var dismiss

    private var options: [RestaurantBuild.Option] {
        switch kind {
        case .slot(let slot): build.options(for: slot)
        case .addOns: build.addOnOptions
        }
    }

    var body: some View {
        NavigationStack {
            List(options) { opt in
                Button {
                    switch kind {
                    case .slot(let slot): build.select(opt.id, in: slot); dismiss()
                    case .addOns: build.toggleAddOn(opt.id)
                    }
                } label: {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(opt.name).foregroundStyle(.primary)
                            HStack(spacing: 6) {
                                Text(calDeltaLabel(opt.calDelta)).monospacedDigit()
                                Text("·")
                                Text(opt.additiveNote).foregroundStyle(opt.additiveTone?.tone.text ?? .secondary)
                            }
                            .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if opt.selected { Image(systemName: "checkmark").foregroundStyle(Theme.good).fontWeight(.semibold) }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDetents([.medium, .large])
    }

    private var title: String {
        if case .slot(let s) = kind { return s.label }
        return "Add to this build"
    }
}
