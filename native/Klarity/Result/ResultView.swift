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
    @State private var feedbackOpen = false

    var body: some View {
        content
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Theme.heroBackground, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task(id: barcode) { await load() }
            .sheet(item: $sheet) { sheet in
                ResultSheetView(sheet: sheet, barcode: barcode, ask: readyAskContext)
            }
    }

    private var readyAskContext: AskContext? {
        guard case .ready(let r) = phase else { return nil }
        return ProductAnalysis(r, profile: model.profile, userServingGrams: model.userServing(for: barcode)).askContext
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
            ContentUnavailableView {
                Label("Product not found", systemImage: "magnifyingglass")
            } description: {
                Text("We checked Open Food Facts, USDA, and Kroger and couldn't find this barcode.")
            } actions: {
                Button("Tell us what this was") { feedbackOpen = true }
            }
            .sheet(isPresented: $feedbackOpen) {
                FeedbackSheet(source: .notFound, categories: [.notFound], barcode: barcode,
                              title: "What product was this?", notePrompt: "Product name / brand — helps us close the gap")
            }
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
                    VerdictHero(eyebrow: analysis.brand, title: analysis.name, subtitle: nil, imageURL: analysis.imageURL,
                                sentence: analysis.sentence, heroTone: analysis.heroTone, glance: analysis.glance,
                                nutrition: analysis.nutrition, additiveContext: analysis.additiveContext, sheet: $sheet) {
                        if let entry = model.historyEntry(for: barcode) {
                            FrequencyCard(entry: entry, barcode: barcode, analysis: analysis)
                        }
                    }
                    VStack(spacing: 14) {
                        AdditivesCard(results: analysis.additiveResults, regulatory: analysis.regulatory, unknown: analysis.unknown)
                        NutritionCard(data: analysis.nutritionCard, sheet: $sheet)
                        Button("Something look off?") { feedbackOpen = true }
                            .font(.subheadline)
                            .padding(.top, 4)
                    }
                    .padding(16)
                }
            }
            .background(Color(.systemGroupedBackground))
            .sheet(isPresented: $feedbackOpen) {
                FeedbackSheet(source: .barcode, categories: [.wrongVerdict, .wrongData, .missingAdditive, .other],
                              productName: analysis.name, barcode: barcode)
            }
        }
    }

    private func load() async {
        if case .ready = phase { return }
        phase = .loading
        do {
            switch try await model.resolver.resolve(barcode) {
            case .notFound:
                phase = .notFound
                model.logOutcome(ScanOutcomeRecord(at: Date().timeIntervalSince1970 * 1000, source: .barcode,
                                                   outcome: .notFound, barcode: barcode))
            case .found(let resolved):
                phase = .ready(resolved)   // paint first — history must never delay the result
                let now = Date().timeIntervalSince1970 * 1000
                model.recordScan(ProductAnalysis.historyRecord(resolved, userServingGrams: model.userServing(for: barcode), now: now))
                model.logOutcome(ProductAnalysis.outcomeRecord(resolved, source: .barcode,
                                                               userServingGrams: model.userServing(for: barcode), now: now))
            }
        } catch {
            phase = .failed((error as? ClientError) == .network ? "No internet connection." : "Could not load product.")
        }
    }
}

// MARK: - Hero (shared by packaged + restaurant results)

struct VerdictHero<Extra: View>: View {
    let eyebrow: String
    let title: String
    let subtitle: String?
    let imageURL: URL?
    let sentence: String?
    let heroTone: HeroTone
    let glance: GlanceKey
    let nutrition: NutritionAssessment
    let additiveContext: AdditiveContext
    @Binding var sheet: ResultSheet?
    @ViewBuilder var extra: Extra

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    if !eyebrow.isEmpty {
                        Text(eyebrow.uppercased()).font(.caption.weight(.semibold)).foregroundStyle(Theme.heroMuted)
                    }
                    Text(title).font(.title2.weight(.bold)).foregroundStyle(Theme.heroText).lineLimit(3)
                    if let subtitle { Text(subtitle).font(.subheadline).foregroundStyle(Theme.heroMuted) }
                }
                Spacer(minLength: 0)
                if imageURL != nil { ProductThumbnail(url: imageURL, name: title, size: 72) }
            }

            if let sentence {
                Text(sentence)
                    .font(.body)
                    .foregroundStyle(Theme.heroText)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    // A quiet tint of the sentence's own driver — never a rail (design language: "the ladder mark, not the rail").
                    .background(heroTone.accent.opacity(0.11), in: RoundedRectangle(cornerRadius: 16))
                Text("The two axes behind it — tap either for why").font(.caption).foregroundStyle(Theme.heroMuted)
            }

            HStack(spacing: 10) {
                GlanceButton(axis: "ADDITIVES", style: glance.style, action: glance == .unrated ? nil : {
                    sheet = .ladder(axis: .additives,
                                    level: glance == .clean ? .everyday : LadderLevel(rawValue: glance.rawValue) ?? .everyday,
                                    context: additiveContext.text, link: additiveContext.link)
                })
                // No nutrition data (spec 025) has no ladder position — not tappable, like "Not rated".
                GlanceButton(axis: "NUTRITION", style: nutrition.tone.style,
                             action: nutritionToneToLadderLevel(nutrition.tone).map { level in
                    { sheet = .ladder(axis: .nutrition, level: level, context: nutrition.summary, link: nil) }
                })
            }
            .fixedSize(horizontal: false, vertical: true)
            extra
        }
        .padding(16)
        .padding(.bottom, 6)
        .background(Theme.heroBackground)
    }
}

/// Frequency context (spec 001) — only when the product repeats across distinct days, something on it is
/// worth watching, and the user hasn't said they were just checking.
private struct FrequencyCard: View {
    let entry: ScanHistoryEntry
    let barcode: String
    let analysis: ProductAnalysis
    @Environment(AppModel.self) private var model

    private var now: Double { Date().timeIntervalSince1970 * 1000 }
    private var amber: Bool { analysis.glance == .sometimes || analysis.glance == .contested || analysis.nutrition.tone == .warn }

    var body: some View {
        if frequencyLineEligible(entry, amber: amber, now: now) {
            let focus = analysis.additiveResults.first { $0.verdict == .sometimes }?.additive
            VStack(alignment: .leading, spacing: 10) {
                if entry.buySignal == .regular {
                    Text("A regular buy for you — " + (focus.map { "for \($0.name.lowercased()), frequency is the whole game." }
                                                       ?? "how often matters more than any single serving."))
                } else {
                    let days = distinctScanDays(entry, windowDays: 14, now: now)
                    Text("This keeps showing up in your scans — \(days)\(ordinalSuffix(days)) day in two weeks.")
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
                HStack(spacing: 6) {
                    Text(style.label).font(.headline).foregroundStyle(style.color)
                        .lineLimit(1).minimumScaleFactor(0.75)
                    Spacer(minLength: 4)
                    if let level = style.level { LadderMark(level: level, color: style.color) }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(style.color.opacity(0.15), in: RoundedRectangle(cornerRadius: 12))
            .accessibilityElement(children: .combine)
            .accessibilityHint(action == nil ? "" : "Shows what this means and why")
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
    }
}

// MARK: - Additives

struct AdditivesCard: View {
    let results: [AdditiveResult]
    var regulatory: [RegulatoryAdditive] = []
    var unknown: [UnknownAdditive] = []

    private var total: Int { results.count + regulatory.count + unknown.count }

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
            ForEach(results, id: \.additive.id) { r in
                NavigationLink(value: Route.additive(id: r.additive.id)) { AdditiveRow(result: r) }
                    .buttonStyle(.plain)
            }
            if !regulatory.isEmpty {
                SectionDivider(title: "Regulatory status only")
                ForEach(regulatory, id: \.eNumber) { reg in
                    NavigationLink(value: Route.regulatory(eNumber: reg.eNumber)) {
                        SimpleAdditiveRow(name: reg.name, eNumber: reg.eNumber, pill: "Permitted", color: .secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            if !unknown.isEmpty {
                SectionDivider(title: "Not yet rated")
                ForEach(unknown, id: \.eNumber) { u in
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
                    Text("For you: \(note)").font(.subheadline).foregroundStyle(Theme.contestedText).lineLimit(3)
                }
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 4) {
                Pill(text: result.verdict.label, tone: result.verdict.tone)
                // Resolving for the user's values must never hide that regulators disagree.
                if result.additive.baseVerdict == .contested && result.verdict != .contested {
                    Pill(text: "Contested", tone: .contested)
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
            if let pill { Pill(text: pill, tone: .neutral) }
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

/// `surface-raised` card, `radius-lg`, `space-4` padding. No borders, shadows or colored rails — state is
/// shown with a LadderMark in the header.
struct Card<Content: View>: View {
    @ViewBuilder let content: Content

    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) { content }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
    }
}
