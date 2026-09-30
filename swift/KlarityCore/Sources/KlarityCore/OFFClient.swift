import Foundation

// Port of src/services/off.ts — Open Food Facts search + product lookup (specs 012, 017–022).

/// A search result: the product summary the UI lists, plus the local quality signals.
public struct OFFSearchProduct: Codable, Sendable, Equatable {
    public var code: String
    public var productName: String
    public var brands: String
    public var quantity: String?
    public var imageFrontUrl: String?
    public var imageUrl: String?
    public var additivesTags: [String] = []
    /// Composite local score (spec 022): GTIN validity + market + completeness + list presence + popularity.
    public var relevanceScore: Int?
    /// From the index's states_tags (en:ingredients-completed) — free at search time.
    public var ingredientsCompleted: Bool?

    enum CodingKeys: String, CodingKey {
        case code, productName = "product_name", brands, quantity, imageFrontUrl = "image_front_url",
             imageUrl = "image_url", additivesTags = "additives_tags", relevanceScore, ingredientsCompleted
    }

    public init(code: String, productName: String, brands: String, quantity: String? = nil,
                imageFrontUrl: String? = nil, imageUrl: String? = nil,
                relevanceScore: Int? = nil, ingredientsCompleted: Bool? = nil) {
        self.code = code; self.productName = productName; self.brands = brands; self.quantity = quantity
        self.imageFrontUrl = imageFrontUrl; self.imageUrl = imageUrl
        self.relevanceScore = relevanceScore; self.ingredientsCompleted = ingredientsCompleted
    }
}

private struct SearchHit: Decodable {
    let code: String?
    let productName: String?
    let brands: [String]?     // OFF sends a string OR an array; both normalize to a list
    let quantity: String?
    let countriesTags: [String]?
    let uniqueScansN: Double?
    let statesTags: [String]?
    let imageFrontUrl: String?
    let imageUrl: String?

    enum CodingKeys: String, CodingKey {
        case code, productName = "product_name", brands, quantity, countriesTags = "countries_tags",
             uniqueScansN = "unique_scans_n", statesTags = "states_tags", imageFrontUrl = "image_front_url", imageUrl = "image_url"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        code = try? c.decodeIfPresent(String.self, forKey: .code)
        productName = try? c.decodeIfPresent(String.self, forKey: .productName)
        if let s = try? c.decodeIfPresent(String.self, forKey: .brands) { brands = [s] }
        else { brands = try? c.decodeIfPresent([String].self, forKey: .brands) }
        quantity = try? c.decodeIfPresent(String.self, forKey: .quantity)
        countriesTags = try? c.decodeIfPresent([String].self, forKey: .countriesTags)
        uniqueScansN = try? c.decodeIfPresent(Double.self, forKey: .uniqueScansN)
        statesTags = try? c.decodeIfPresent([String].self, forKey: .statesTags)
        imageFrontUrl = try? c.decodeIfPresent(String.self, forKey: .imageFrontUrl)
        imageUrl = try? c.decodeIfPresent(String.self, forKey: .imageUrl)
    }

    var brandsJoinedComma: String { (brands ?? []).joined(separator: ",") }
    var ingredientsCompleted: Bool { statesTags?.contains("en:ingredients-completed") ?? false }
}

private struct SearchResponse: Decodable { let hits: [SearchHit]? }

private struct ProductResponse: Decodable {
    let status: Int?
    let product: OFFProduct?
}

/// Spec 022 — identity is the GTIN. Structural validity (plausible length + mod-10 checksum) is a cheap
/// local trust signal: junk in-store codes can never be corroborated. 12/13/14-digit codes earn full trust
/// (2); 8-digit EAN-8 earns half (1) since ~10% of junk codes pass its checksum by chance.
public func gtinTrust(_ code: String) -> Int {
    guard !code.isEmpty, code.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }) else { return 0 }
    guard [8, 12, 13, 14].contains(code.count) else { return 0 }
    var digits = code.utf8.map { Int($0) - 48 }
    let check = digits.removeLast()
    let sum = digits.reversed().enumerated().reduce(0) { $0 + $1.element * ($1.offset % 2 == 0 ? 3 : 1) }
    if (10 - (sum % 10)) % 10 != check { return 0 }
    return code.count == 8 ? 1 : 2
}

// Real-world scan frequency, stepped rather than raw: 500 scans is not 5× more canonical than 100.
private func popularitySteps(_ scans: Double) -> Int {
    scans >= 100 ? 3 : scans >= 10 ? 2 : scans >= 1 ? 1 : 0
}

public struct OFFClient: Sendable {
    static let productBase = "https://world.openfoodfacts.org/api/v2/product"
    static let searchBase = "https://search.openfoodfacts.org/search"
    static let fields = ["product_name", "brands", "serving_size", "serving_quantity", "quantity", "nutriments",
                         "additives_tags", "ingredients_text", "categories_tags", "image_url", "image_front_url"].joined(separator: ",")
    static let searchFields = "code,product_name,brands,quantity,countries_tags,unique_scans_n,states_tags,image_front_url,image_url"
    /// Spec 022 — the searcher's market; hardcoded to the family's until device-locale detection (M3).
    static let marketTag = "en:united-states"
    static let timeout: TimeInterval = 8
    static let retryDelay: Duration = .milliseconds(400)

    let http: HTTPClient
    let sleep: @Sendable (Duration) async -> Void

    public init(http: HTTPClient = URLSessionHTTPClient(),
                sleep: @escaping @Sendable (Duration) async -> Void = { try? await Task.sleep(for: $0) }) {
        self.http = http; self.sleep = sleep
    }

    /// One automatic retry on network failure / timeout / 5xx. 4xx is a real answer and isn't retried.
    private func requestJSON<T: Decodable>(_ type: T.Type, _ url: String) async throws -> T {
        var lastError = ClientError.network
        for attempt in 0..<2 {
            if attempt > 0 { await sleep(Self.retryDelay) }
            guard let request = makeRequest(url, timeout: Self.timeout, headers: ["User-Agent": userAgent]) else { throw ClientError.network }
            let result: (data: Data, status: Int)
            do { result = try await http.send(request) } catch { lastError = .network; continue }
            if (200..<300).contains(result.status) {
                do { return try JSONDecoder().decode(T.self, from: result.data) }
                catch { throw ClientError.network }
            }
            lastError = .http(result.status)
            if result.status < 500 { throw lastError }
        }
        throw lastError
    }

    // MARK: Search (spec 022 — dual retrieval)

    private func localScore(_ h: SearchHit, inRelevance: Bool, inCanonical: Bool, multiToken: Bool) -> Int {
        var s = gtinTrust(h.code ?? "")
        if h.countriesTags?.contains(Self.marketTag) == true { s += 2 }
        if h.ingredientsCompleted { s += 2 }
        if inRelevance { s += 2 }
        if inCanonical { s += 2 }
        let pop = popularitySteps(h.uniqueScansN ?? 0)
        s += multiToken ? min(pop, 1) : pop    // single-token brand searches are canonicality questions; multi-word are specificity
        return s
    }

    /// Identical name+brand+quantity across hits isn't a choice, it's noise (OFF returns the same product under many codes).
    private func dedupeKey(_ h: SearchHit) -> String {
        [h.productName, h.brandsJoinedComma, h.quantity]
            .map { ($0 ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
            .joined(separator: "|")
    }

    /// The deterministic guard that makes the popularity-sorted canonical query safe: every query token
    /// must appear in the hit's own name/brand text (sort_by discards text relevance entirely).
    private func matchesAllTokens(_ h: SearchHit, _ tokens: [String]) -> Bool {
        let haystack = "\(h.productName ?? "") \((h.brands ?? []).joined(separator: " "))".lowercased()
        return tokens.allSatisfy { haystack.contains($0) }
    }

    public func searchProducts(_ query: String) async throws -> [OFFSearchProduct] {
        let tokens = query.lowercased().split(whereSeparator: { $0.isWhitespace }).map(String.init)
        let multiToken = tokens.count > 1

        let relevanceURL = "\(Self.searchBase)?q=\(encodeURIComponent(query))&page_size=25&fields=\(Self.searchFields)"
        let canonicalQ = "\(query) countries_tags:\"\(Self.marketTag)\""
        let canonicalURL = "\(Self.searchBase)?q=\(encodeURIComponent(canonicalQ))&page_size=25&sort_by=-unique_scans_n&fields=\(Self.searchFields)"

        // Either query failing alone degrades to the other's results — only both failing surfaces an error.
        async let rel = Result { try await requestJSON(SearchResponse.self, relevanceURL) }
        async let can = Result { try await requestJSON(SearchResponse.self, canonicalURL) }
        let (relRes, canRes) = await (rel, can)
        if case .failure(let e) = relRes, case .failure = canRes { throw e }

        func valid(_ h: SearchHit) -> Bool { !(h.code ?? "").isEmpty && !(h.productName ?? "").isEmpty }
        let relHits = ((try? relRes.get())?.hits ?? []).filter(valid)
        let canHits = ((try? canRes.get())?.hits ?? []).filter(valid).filter { matchesAllTokens($0, tokens) }

        // Merge by GTIN, preserving first-seen order (JS Map semantics: re-setting keeps position).
        struct Entry { var hit: SearchHit; var inRelevance: Bool; var inCanonical: Bool }
        var order: [String] = []
        var byCode: [String: Entry] = [:]
        for h in relHits {
            let code = h.code!
            if byCode[code] == nil { order.append(code) }
            byCode[code] = Entry(hit: h, inRelevance: true, inCanonical: false)
        }
        for h in canHits {
            let code = h.code!
            if byCode[code] != nil { byCode[code]!.inCanonical = true }
            else { order.append(code); byCode[code] = Entry(hit: h, inRelevance: false, inCanonical: true) }
        }

        let scored = order.map { code -> (hit: SearchHit, score: Int) in
            let e = byCode[code]!
            return (e.hit, localScore(e.hit, inRelevance: e.inRelevance, inCanonical: e.inCanonical, multiToken: multiToken))
        }
        // Stable sort by score, THEN dedupe (keeps the best-scoring hit per group), THEN cap at 8.
        let sorted = scored.enumerated().sorted { $0.element.score != $1.element.score ? $0.element.score > $1.element.score : $0.offset < $1.offset }.map(\.element)
        var seen = Set<String>()
        return sorted.filter { seen.insert(dedupeKey($0.hit)).inserted }
            .prefix(8)
            .map { item in
                OFFSearchProduct(code: item.hit.code!, productName: item.hit.productName ?? "",
                                 brands: (item.hit.brands ?? []).joined(separator: ", "),
                                 quantity: item.hit.quantity, imageFrontUrl: item.hit.imageFrontUrl, imageUrl: item.hit.imageUrl,
                                 relevanceScore: item.score, ingredientsCompleted: item.hit.ingredientsCompleted)
            }
    }

    // MARK: Product lookup (twin UPC-A / EAN-13 records)

    /// The same physical barcode arrives sometimes as 12-digit UPC-A and sometimes as 13-digit EAN-13
    /// (leading zero) — and OFF often holds TWO records: one rich, one sparse duplicate.
    static func alternateCode(_ code: String) -> String? {
        let ascii = code.utf8.allSatisfy { $0 >= 48 && $0 <= 57 }
        guard ascii else { return nil }
        if code.count == 13, code.hasPrefix("0") { return String(code.dropFirst()) }
        if code.count == 12 { return "0" + code }
        return nil
    }

    private static func productScore(_ p: OFFProduct) -> Int {
        var s = 0
        if !(p.additivesTags ?? []).isEmpty { s += 3 }
        if !(p.ingredientsText ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { s += 2 }
        if !(p.productName ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty { s += 1 }
        if let n = p.nutriments, n.keyCount > 2 { s += 1 }
        return s
    }

    private func fetchProductRaw(_ barcode: String) async throws -> OFFProduct? {
        let url = "\(Self.productBase)/\(encodeURIComponent(barcode)).json?fields=\(Self.fields)"
        let data = try await requestJSON(ProductResponse.self, url)
        guard data.status == 1, let product = data.product else { return nil }
        return product
    }

    public func fetchProduct(_ barcode: String) async throws -> OFFProduct? {
        let primary = try await fetchProductRaw(barcode)
        guard let alt = Self.alternateCode(barcode) else { return primary }

        // Not found under the scanned form — the record may live under the twin code.
        guard let primary else { return try? await fetchProductRaw(alt) ?? nil }

        // Found but thin: the twin may hold the richer record. A failing twin lookup never breaks a good primary.
        let thin = (primary.additivesTags ?? []).isEmpty
            && (primary.ingredientsText ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        if thin, let twin = try? await fetchProductRaw(alt), Self.productScore(twin) > Self.productScore(primary) { return twin }
        return primary
    }
}
