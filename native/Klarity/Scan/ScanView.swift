import KlarityCore
import SwiftUI

struct ScanView: View {
    @Environment(AppModel.self) private var model
    @State private var path: [Route] = []
    @State private var query = ""
    @State private var results: EnrichedSearchResults?
    @State private var searching = false
    @State private var searchError: String?
    @State private var showLowConfidence = false

    private var trimmed: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var looksLikeBarcode: Bool { (8...14).contains(trimmed.count) && trimmed.allSatisfy(\.isASCII) && trimmed.allSatisfy(\.isNumber) }

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if trimmed.isEmpty { scanner } else { searchList }
            }
            .navigationTitle("Klarity")
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search products or type a barcode")
            .task(id: trimmed) { await runSearch() }
            .klarityDestinations()
        }
    }

    // MARK: Scanner

    @ViewBuilder private var scanner: some View {
        if BarcodeScanner.isAvailable {
            BarcodeScanner { code in
                // Only push from the root — the scanner keeps running behind a pushed result.
                if path.isEmpty { path.append(.product(barcode: code)) }
            }
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .overlay(alignment: .bottom) {
                Text("Point at a barcode")
                    .font(.subheadline.weight(.medium))
                    .padding(.horizontal, 14).padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.bottom, 18)
            }
            .padding()
        } else {
            ContentUnavailableView {
                VStack(spacing: 14) {
                    KlarityMark(stem: .primary, upperArm: Theme.good, lowerArm: Theme.goodText).frame(width: 56)
                    Text("Scanning isn't available here")
                }
            } description: {
                Text("Search for a product above, or type its barcode.")
            }
        }
    }

    // MARK: Search

    private var restaurant: RestaurantSearch { searchRestaurant(trimmed) }

    private var searchList: some View {
        List {
            switch restaurant {
            case .menu(let chain, let hits, let filtered):
                MenuBrowser(chain: chain, hits: hits, filtered: filtered)
            case .suggestion(let chain):
                Section {
                    Button { query = chain.name } label: {
                        Label("See the \(chain.name) menu", systemImage: "fork.knife")
                    }
                }
                packagedSections
            case .none:
                packagedSections
            }
        }
        .overlay { if searching && results == nil { ProgressView() } }
    }

    @ViewBuilder private var packagedSections: some View {
            if looksLikeBarcode {
                Section {
                    NavigationLink(value: Route.product(barcode: trimmed)) {
                        Label("Look up barcode \(trimmed)", systemImage: "barcode")
                    }
                }
            }
            if let results {
                Section {
                    ForEach(results.confident, id: \.product.code) { SearchRow(item: $0) }
                } footer: {
                    if results.confident.isEmpty && !searching {
                        Text(results.lowConfidence.isEmpty ? "No products found." : "No confident matches.")
                    }
                }
                if !results.lowConfidence.isEmpty {
                    Section {
                        if showLowConfidence {
                            ForEach(results.lowConfidence, id: \.product.code) { SearchRow(item: $0) }
                        } else {
                            Button("Show \(results.lowConfidence.count) less-certain results") { showLowConfidence = true }
                        }
                    } footer: {
                        if showLowConfidence { Text("These records are thinner — missing ingredient data or a valid barcode.") }
                    }
                }
            }
            if let searchError { Text(searchError).foregroundStyle(.secondary) }
    }

    private func runSearch() async {
        let q = trimmed
        showLowConfidence = false
        searchError = nil
        // A recognized chain's menu owns the screen (spec 006 Q2) — no packaged-goods search behind it.
        guard q.count >= 2, !looksLikeBarcode else { results = nil; return }
        if case .menu = searchRestaurant(q) { results = nil; return }
        try? await Task.sleep(for: .milliseconds(350))   // debounce typing
        guard !Task.isCancelled else { return }
        searching = true
        defer { searching = false }
        do {
            let raw = try await model.off.searchProducts(q)
            let enriched = await model.search.enrich(raw)
            guard !Task.isCancelled else { return }
            results = enriched
        } catch {
            guard !Task.isCancelled else { return }
            results = nil
            searchError = (error as? ClientError) == .network ? "No internet connection." : "Search failed — try again."
        }
    }
}

private struct SearchRow: View {
    let item: EnrichedSearchProduct

    var body: some View {
        let p = item.product
        NavigationLink(value: Route.product(barcode: p.code)) {
            HStack(spacing: 12) {
                ProductThumbnail(url: (p.imageFrontUrl ?? p.imageUrl).flatMap(URL.init(string:)), name: p.productName)
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.productName).font(.body.weight(.medium)).lineLimit(2)
                    Text([p.brands, p.quantity?.trimmingCharacters(in: .whitespaces)].compactMap { $0?.isEmpty == false ? $0 : nil }.joined(separator: " · "))
                        .font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                }
                Spacer(minLength: 0)
                if item.usdaVerified { Pill(text: "USDA", tone: .everyday) }
            }
        }
    }
}

/// Real product photo, with a letter-avatar fallback (spec 017 M5).
struct ProductThumbnail: View {
    let url: URL?
    let name: String
    var size: CGFloat = 44

    var body: some View {
        AsyncImage(url: url) { phase in
            if let image = phase.image {
                image.resizable().scaledToFill()
            } else {
                Text(String(name.first ?? "?").uppercased())
                    .font(.headline).foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color(.tertiarySystemFill))
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

/// Spec 006 M1 — one list that narrows as you type; "no X" phrases annotate the top hit, never reshape the list.
private struct MenuBrowser: View {
    let chain: RestaurantChain
    let hits: [MenuHit]
    let filtered: Bool

    var body: some View {
        Section {
            ForEach(hits, id: \.item.id) { hit in
                let glance = menuItemGlance(hit.item, removedIds: hit.removedIds)
                NavigationLink(value: Route.restaurant(itemID: hit.item.id, removed: hit.removedIds, added: [])) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(hit.item.name).font(.body.weight(.medium))
                        HStack(spacing: 6) {
                            Text(hit.item.category).font(.caption).foregroundStyle(.secondary)
                            Pill(text: glance.additiveGlance.style.label, tone: glance.additiveGlance.cardTone)
                            Pill(text: glance.nutritionTone.style.label, tone: glance.nutritionTone.cardTone)
                        }
                        if !hit.removedIds.isEmpty {
                            let names = hit.item.components.filter { hit.removedIds.contains($0.id) }.map(\.name)
                            Text("Without \(names.joined(separator: ", "))").font(.caption).foregroundStyle(Theme.sometimesText)
                        }
                    }
                }
            }
        } header: {
            Text("\(chain.name) menu")
        } footer: {
            Text(filtered ? "Keep typing to narrow — try \"no cheese\"." : "Type an item name to narrow the menu.")
        }
    }
}
