import KlarityCore
import SwiftUI

/// The two-axis verdict screen (port of src/app/result/[barcode].tsx). All judgment comes from
/// KlarityCore's `ProductAnalysis`; this view only lays it out.
struct ResultView: View {
    let barcode: String
    @Environment(AppModel.self) private var model

    private enum Phase {
        case loading
        case notFound
        case failed(String)
        case ready(ResolvedProduct)
    }

    @State private var phase: Phase = .loading
    @State private var sheet: ResultSheet?

    var body: some View {
        content
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.heroBackground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task(id: barcode) { await load() }
            .sheet(item: $sheet) { sheet in
                ResultSheetView(sheet: sheet, barcode: barcode)
            }
    }

    @ViewBuilder private var content: some View {
        switch phase {
        case .loading:
            VStack(spacing: 14) {
                ProgressView().tint(Theme.goodOnDark).controlSize(.large)
                Text("Looking up product…").foregroundStyle(Theme.heroMuted)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.heroBackground)
        case .notFound:
            ContentUnavailableView("Product not found", systemImage: "magnifyingglass",
                description: Text("We checked Open Food Facts, USDA, and Kroger and couldn't find this barcode."))
        case .failed(let message):
            ContentUnavailableView {
                Label("Something went wrong", systemImage: "exclamationmark.triangle")
            } description: {
                Text(message)
            } actions: {
                Button("Try again") { Task { await load() } }
            }
        case .ready(let resolved):
            let analysis = ProductAnalysis(resolved, profile: model.profile, userServingGrams: model.userServing(for: barcode))
            ScrollView {
                VStack(spacing: 0) {
                    ResultHero(analysis: analysis, entry: model.historyEntry(for: barcode), barcode: barcode, sheet: $sheet)
                    VStack(spacing: 14) {
                        AdditivesCard(analysis: analysis)
                        NutritionCard(analysis: analysis, sheet: $sheet)
                    }
                    .padding(16)
                }
            }
            .background(Color(.systemGroupedBackground))
        }
    }

    private func load() async {
        if case .ready = phase { return }
        phase = .loading
        do {
            switch try await model.resolver.resolve(barcode) {
            case .notFound:
                phase = .notFound
            case .found(let resolved):
                phase = .ready(resolved)   // paint first — history must never delay the result
                model.recordScan(ProductAnalysis.historyRecord(
                    resolved, userServingGrams: model.userServing(for: barcode),
                    now: Date().timeIntervalSince1970 * 1000))
            }
        } catch {
            phase = .failed((error as? ClientError) == .network ? "No internet connection." : "Could not load product.")
        }
    }
}

// MARK: - Hero

private struct ResultHero: View {
    let analysis: ProductAnalysis
    let entry: ScanHistoryEntry?
    let barcode: String
    @Binding var sheet: ResultSheet?
    @Environment(AppModel.self) private var model

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    if !analysis.brand.isEmpty {
                        Text(analysis.brand.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(Theme.heroMuted)
                    }
                    Text(analysis.name).font(.title2.weight(.bold)).foregroundStyle(Theme.heroText).lineLimit(3)
                }
                Spacer(minLength: 0)
                if analysis.imageURL != nil {
                    ProductThumbnail(url: analysis.imageURL, name: analysis.name, size: 72)
                }
            }

            if let sentence = analysis.sentence {
                Text(sentence)
                    .font(.body)
                    .foregroundStyle(Theme.heroText)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(analysis.heroTone.accent.opacity(0.11), in: RoundedRectangle(cornerRadius: 14))
                    .overlay(alignment: .leading) {
                        UnevenRoundedRectangle(topLeadingRadius: 14, bottomLeadingRadius: 14)
                            .fill(analysis.heroTone.accent).frame(width: 4)
                    }
                Text("The two axes behind it — tap either for why")
                    .font(.caption).foregroundStyle(Theme.heroMuted)
            }

            HStack(spacing: 10) {
                GlanceButton(axis: "ADDITIVES", style: analysis.glance.style,
                             action: analysis.glance == .unrated ? nil : {
                    sheet = .ladder(axis: .additives,
                                    level: analysis.glance == .clean ? .everyday : LadderLevel(rawValue: analysis.glance.rawValue) ?? .everyday,
                                    context: analysis.additiveContext.text, link: analysis.additiveContext.link)
                })
                GlanceButton(axis: "NUTRITION", style: analysis.nutrition.tone.style) {
                    sheet = .ladder(axis: .nutrition, level: nutritionToneToLadderLevel(analysis.nutrition.tone),
                                    context: analysis.nutrition.summary, link: nil)
                }
            }

            if let entry, showsFrequency(entry) { frequencyCard(entry) }
        }
        .padding(16)
        .padding(.bottom, 6)
        .background(Theme.heroBackground)
    }

    private var amber: Bool {
        analysis.glance == .sometimes || analysis.glance == .contested || analysis.nutrition.tone == .warn
    }

    private func showsFrequency(_ entry: ScanHistoryEntry) -> Bool {
        frequencyLineEligible(entry, amber: amber, now: Date().timeIntervalSince1970 * 1000)
    }

    @ViewBuilder private func frequencyCard(_ entry: ScanHistoryEntry) -> some View {
        let focus = analysis.additiveResults.first { $0.verdict == .sometimes }?.additive
        VStack(alignment: .leading, spacing: 10) {
            if entry.buySignal == .regular {
                Text("A regular buy for you — " + (focus.map { "for \($0.name.lowercased()), frequency is the whole game." }
                                                   ?? "how often matters more than any single serving."))
            } else {
                let days = distinctScanDays(entry, windowDays: 14, now: Date().timeIntervalSince1970 * 1000)
                Text("This keeps showing up in your scans — \(days.formatted(.number.notation(.automatic)))\(ordinalSuffix(days)) day in two weeks.")
                HStack {
                    Text("Regular buy?").foregroundStyle(Theme.heroMuted)
                    Button("Yes") { model.setBuySignal(.regular, for: barcode) }
                    Button("Just checking") { model.setBuySignal(.justChecking, for: barcode) }
                }
                .buttonStyle(.bordered).tint(Theme.heroMuted)
            }
        }
        .font(.subheadline)
        .foregroundStyle(Theme.heroText)
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
    }
}

private func ordinalSuffix(_ n: Int) -> String {
    if (11...13).contains(n % 100) { return "th" }
    switch n % 10 { case 1: return "st"; case 2: return "nd"; case 3: return "rd"; default: return "th" }
}

private struct GlanceButton: View {
    let axis: String
    let style: GlanceStyle
    var action: (() -> Void)?

    var body: some View {
        Button { action?() } label: {
            VStack(alignment: .leading, spacing: 3) {
                Text(axis).font(.caption2.weight(.semibold)).foregroundStyle(Theme.heroMuted)
                HStack(spacing: 4) {
                    Text(style.label).font(.headline).foregroundStyle(style.color)
                    if action != nil { Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(style.color.opacity(0.7)) }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(style.color.opacity(0.16), in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
    }
}

// MARK: - Additives

private struct AdditivesCard: View {
    let analysis: ProductAnalysis

    private var total: Int { analysis.additiveResults.count + analysis.regulatory.count + analysis.unknown.count }

    var body: some View {
        Card {
            HStack {
                Text("Additives").font(.headline)
                Spacer()
                if total > 0 { Text("\(total) in product").font(.subheadline).foregroundStyle(.secondary) }
            }
            if total == 0 {
                Text("No additives detected.").foregroundStyle(.secondary)
            }
            ForEach(analysis.additiveResults, id: \.additive.id) { r in
                NavigationLink(value: Route.additive(id: r.additive.id)) { AdditiveRow(result: r) }
                    .buttonStyle(.plain)
            }
            if !analysis.regulatory.isEmpty {
                SectionDivider(title: "Regulatory status only")
                ForEach(analysis.regulatory, id: \.eNumber) { reg in
                    NavigationLink(value: Route.regulatory(eNumber: reg.eNumber)) {
                        SimpleAdditiveRow(name: reg.name, eNumber: reg.eNumber, pill: "Permitted", color: .secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            if !analysis.unknown.isEmpty {
                SectionDivider(title: "Not yet rated")
                ForEach(analysis.unknown, id: \.eNumber) { u in
                    SimpleAdditiveRow(name: u.name, eNumber: u.eNumber, pill: nil, color: .secondary)
                }
            }
        }
    }
}

private struct AdditiveRow: View {
    let result: AdditiveResult

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Text(result.additive.name).font(.body.weight(.medium))
                    if let e = result.additive.eNumber { Text(e).font(.caption).foregroundStyle(.secondary) }
                }
                Text(result.additive.role).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                if let note = result.profileNote {
                    Text("For you: \(note)").font(.subheadline).foregroundStyle(Theme.contested).lineLimit(3)
                }
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 4) {
                Pill(text: result.verdict.label, color: result.verdict.color)
                // Resolving for the user's values must never hide that regulators disagree.
                if result.additive.baseVerdict == .contested && result.verdict != .contested {
                    Pill(text: "Contested", color: Theme.contested)
                }
            }
            Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.tertiary).padding(.top, 4)
        }
        .contentShape(Rectangle())
        .padding(.vertical, 4)
    }
}

private struct SimpleAdditiveRow: View {
    let name: String
    let eNumber: String
    let pill: String?
    let color: Color

    var body: some View {
        HStack {
            Text(name)
            // No bundled name for this E-number → the name IS the E-number; don't print it twice.
            if name.caseInsensitiveCompare(eNumber) != .orderedSame {
                Text(eNumber).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if let pill { Pill(text: pill, color: color) }
        }
        .contentShape(Rectangle())
        .padding(.vertical, 2)
    }
}

private struct SectionDivider: View {
    let title: String
    var body: some View {
        HStack {
            VStack { Divider() }
            Text(title).font(.caption).foregroundStyle(.secondary).fixedSize()
            VStack { Divider() }
        }
        .padding(.vertical, 4)
    }
}

struct Card<Content: View>: View {
    @ViewBuilder let content: Content
    var accent: Color? = nil

    init(accent: Color? = nil, @ViewBuilder content: () -> Content) {
        self.accent = accent
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) { content }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
            .overlay(alignment: .leading) {
                if let accent {
                    UnevenRoundedRectangle(topLeadingRadius: 16, bottomLeadingRadius: 16).fill(accent).frame(width: 3)
                }
            }
    }
}
