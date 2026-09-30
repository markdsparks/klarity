import Foundation

// Port of src/services/kroger.ts (ADR-006 / spec 020). The app never holds Kroger's client_secret;
// it talks to our token-proxy Worker, then calls Kroger's Products API directly with the short-lived
// token. No Kroger product data is cached — a token is a credential, not content.

public struct KrogerMatch: Codable, Sendable, Equatable {
    public var matched: Bool
    public var hasIngredients: Bool
    public var ingredientStatement: String?
    public var description: String?
    public var brand: String?
    public var imageUrl: String?
}

/// Kroger's productId is NOT the GTIN: it is the GTIN with its check digit REMOVED, left-padded with
/// zeros to exactly 13 digits (verified empirically against Kroger's own results). A UPC-A and its
/// zero-padded EAN-13 twin therefore normalize to the SAME id.
public func krogerProductId(_ barcode: String) -> String? {
    guard (8...14).contains(barcode.count), barcode.utf8.allSatisfy({ $0 >= 48 && $0 <= 57 }) else { return nil }
    let significant = barcode.drop(while: { $0 == "0" })
    if significant.count < 2 { return nil }
    let sansCheckDigit = significant.dropLast()
    if sansCheckDigit.count > 13 { return nil }
    return String(repeating: "0", count: 13 - sansCheckDigit.count) + sansCheckDigit
}

private struct KrogerProductsResponse: Decodable {
    struct Size: Decodable { let size: String?; let url: String? }
    struct Image: Decodable { let perspective: String?; let sizes: [Size]? }
    struct Nutrition: Decodable { let ingredientStatement: String? }
    struct Product: Decodable {
        let description: String?
        let brand: String?
        let images: [Image]?
        let nutritionInformation: [Nutrition]?
    }
    let data: [Product]?
}

private struct TokenResponse: Decodable {
    let accessToken: String
    let expiresIn: Double
    enum CodingKeys: String, CodingKey { case accessToken = "access_token", expiresIn = "expires_in" }
}

public actor KrogerClient {
    static let productsURL = "https://api.kroger.com/v1/products"
    static let refreshMarginMs = 30_000.0

    private let http: HTTPClient
    private let tokenProxyURL: String?
    private let now: @Sendable () -> Double   // ms since epoch
    private var cached: (value: String, expiresAt: Double)?
    /// Deliberate divergence from the TS client: concurrent callers (search enriches 8 candidates at once)
    /// share ONE in-flight token request instead of each minting their own.
    private var inflight: Task<String?, Never>?

    /// `tokenProxyURL == nil` degrades to "no Kroger data", same as an unset USDA key.
    public init(http: HTTPClient = URLSessionHTTPClient(), tokenProxyURL: String?,
                now: @escaping @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 }) {
        self.http = http; self.tokenProxyURL = tokenProxyURL; self.now = now
    }

    /// A proxy hiccup means "no corroboration right now", never an error.
    private func token() async -> String? {
        guard tokenProxyURL != nil else { return nil }
        if let c = cached, c.expiresAt - Self.refreshMarginMs > now() { return c.value }
        if let inflight { return await inflight.value }
        let task = Task { await self.mintToken() }
        inflight = task
        let value = await task.value
        inflight = nil
        return value
    }

    private func mintToken() async -> String? {
        guard let proxy = tokenProxyURL else { return nil }
        let t = now()
        guard let request = makeRequest(proxy, timeout: 10),
              let result = try? await http.send(request), (200..<300).contains(result.status),
              let data = try? JSONDecoder().decode(TokenResponse.self, from: result.data) else { return nil }
        cached = (data.accessToken, t + data.expiresIn * 1000)
        return data.accessToken
    }

    /// Prefers the front-perspective photo at "large" size.
    private static func frontImageURL(_ p: KrogerProductsResponse.Product) -> String? {
        let images = p.images ?? []
        guard let front = images.first(where: { $0.perspective == "front" }) ?? images.first else { return nil }
        let sizes = front.sizes ?? []
        return (sizes.first(where: { $0.size == "large" }) ?? sizes.first)?.url
    }

    /// Throws `ClientError` for 401/5xx/transport failure — search's allSettled degrades one candidate,
    /// and the scan path catches at the call site (corroboration must never break a scan).
    public func fetchMatch(_ barcode: String) async throws -> KrogerMatch? {
        guard let productId = krogerProductId(barcode) else { return nil }   // a code Kroger can't represent — skip the call
        guard let token = await token() else { return nil }

        let url = "\(Self.productsURL)?filter.productId=\(encodeURIComponent(productId))"
        guard let request = makeRequest(url, timeout: 15, headers: ["Authorization": "Bearer \(token)"]) else { throw ClientError.network }
        let result: (data: Data, status: Int)
        do { result = try await http.send(request) } catch { throw ClientError.network }
        // 400 = Kroger answering "this identifier cannot exist in my catalog" — a definitive not-found.
        if result.status == 400 { return nil }
        if !(200..<300).contains(result.status) { throw ClientError.http(result.status) }

        guard let response = try? JSONDecoder().decode(KrogerProductsResponse.self, from: result.data),
              let product = response.data?.first else { return nil }   // Kroger returns 200 + empty data, not a 404
        let statement = product.nutritionInformation?.first?.ingredientStatement
        return KrogerMatch(
            matched: true,
            hasIngredients: !(statement ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            ingredientStatement: statement, description: product.description, brand: product.brand,
            imageUrl: Self.frontImageURL(product))
    }
}
