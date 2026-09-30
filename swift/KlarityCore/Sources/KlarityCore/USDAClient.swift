import Foundation

// Port of src/services/usda.ts and src/types/usda.ts (USDA FoodData Central, Branded Foods only).

public struct USDAFoodNutrient: Codable, Sendable, Equatable {
    public var nutrientId: Int
    public var nutrientName: String?
    public var unitName: String?
    /// Per 100 g — NOT per serving, despite how this looks on /foods/search.
    public var value: Double?
}

public struct USDAFood: Codable, Sendable, Equatable {
    public var fdcId: Int
    public var description: String?
    public var brandOwner: String?
    public var brandName: String?
    public var gtinUpc: String?
    public var servingSize: Double?
    public var servingSizeUnit: String?
    public var householdServingFullText: String?
    public var foodNutrients: [USDAFoodNutrient]
    /// Spec 021 — the plain-text ingredient statement /foods/search already returns.
    public var ingredients: String?

    enum CodingKeys: String, CodingKey {
        case fdcId, description, brandOwner, brandName, gtinUpc, servingSize, servingSizeUnit,
             householdServingFullText, foodNutrients, ingredients
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        fdcId = try c.decode(Int.self, forKey: .fdcId)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        brandOwner = try c.decodeIfPresent(String.self, forKey: .brandOwner)
        brandName = try c.decodeIfPresent(String.self, forKey: .brandName)
        gtinUpc = try c.decodeIfPresent(String.self, forKey: .gtinUpc)
        servingSize = try c.decodeIfPresent(Double.self, forKey: .servingSize)
        servingSizeUnit = try c.decodeIfPresent(String.self, forKey: .servingSizeUnit)
        householdServingFullText = try c.decodeIfPresent(String.self, forKey: .householdServingFullText)
        foodNutrients = try c.decodeIfPresent([USDAFoodNutrient].self, forKey: .foodNutrients) ?? []
        ingredients = try c.decodeIfPresent(String.self, forKey: .ingredients)
    }
}

private struct USDASearchResponse: Decodable { let foods: [USDAFood]? }

private struct LabelValue: Decodable { let value: Double? }
private struct USDAFoodDetail: Decodable {
    struct Label: Decodable {
        let calories, fat, saturatedFat, transFat, carbohydrates, fiber, sugars, addedSugar, protein, sodium, potassium: LabelValue?
    }
    let labelNutrients: Label?
}

public struct USDAClient: Sendable {
    static let base = "https://api.nal.usda.gov/fdc/v1"
    static let timeout: TimeInterval = 5

    let http: HTTPClient
    /// Free key from api.data.gov (1,000 req/hr). DEMO_KEY works but is capped at 30 req/hr.
    let apiKey: String

    public init(http: HTTPClient = URLSessionHTTPClient(), apiKey: String = "DEMO_KEY") {
        self.http = http; self.apiKey = apiKey
    }

    // USDA stores GTINs zero-padded to 14 digits; OFF barcodes may be 8–13.
    private func gtinVariants(_ barcode: String) -> [String] {
        let padded = String(repeating: "0", count: max(0, 14 - barcode.count)) + barcode
        return barcode == padded ? [barcode] : [barcode, padded]
    }

    /// Any failure (network, timeout, non-2xx, malformed body) is "no data" — the caller falls back.
    private func fetchJSON<T: Decodable>(_ type: T.Type, _ url: String) async -> T? {
        guard let request = makeRequest(url, timeout: Self.timeout, headers: ["User-Agent": userAgent]),
              let result = try? await http.send(request),
              (200..<300).contains(result.status) else { return nil }
        return try? JSONDecoder().decode(T.self, from: result.data)
    }

    /// Exact-GTIN match against USDA Branded Foods (reused by spec 017's search-result preference).
    public func findBrandedMatch(_ barcode: String) async -> USDAFood? {
        let url = "\(Self.base)/foods/search?query=\(encodeURIComponent(barcode))&dataType=Branded&pageSize=10&api_key=\(apiKey)"
        guard let foods = await fetchJSON(USDASearchResponse.self, url)?.foods, !foods.isEmpty else { return nil }
        let variants = gtinVariants(barcode)
        return foods.first { f in f.gtinUpc.map(variants.contains) ?? false }
    }

    // Nutrient ids for the per-100g fallback path.
    private enum NID {
        static let calories = 1008, totalFat = 1004, protein = 1003, carbs = 1005, fiber = 1079, sugar = 2000
        static let addedSugar = 1235, saturatedFat = 1258, transFat = 1257, sodium = 1093, potassium = 1092
    }

    /// /foods/search returns nutrients per 100 g. Scaling needs a gram serving size — and USDA occasionally
    /// mislabels servingSizeUnit ("MG"/"IU" on a solid food), so only scale when the unit is unambiguously grams.
    private func scalePer100g(_ match: USDAFood) -> USDANutrition? {
        let unit = match.servingSizeUnit?.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard unit == "GRM" || unit == "G", let serving = match.servingSize else { return nil }
        let factor = serving / 100
        var nmap: [Int: Double] = [:]
        for n in match.foodNutrients { nmap[n.nutrientId] = n.value }   // later duplicates win, like JS Map
        func scale(_ id: Int) -> Double? { nmap[id].map { $0 * factor } }

        var n = USDANutrition()
        n.calories = scale(NID.calories); n.totalFat = scale(NID.totalFat); n.protein = scale(NID.protein)
        n.carbs = scale(NID.carbs); n.fiber = scale(NID.fiber); n.sugar = scale(NID.sugar)
        n.addedSugar = scale(NID.addedSugar); n.saturatedFat = scale(NID.saturatedFat); n.transFat = scale(NID.transFat)
        n.sodium = scale(NID.sodium).map { $0 / 1000 }; n.potassium = scale(NID.potassium).map { $0 / 1000 }
        n.servingSize = match.servingSize; n.servingSizeUnit = match.servingSizeUnit
        n.householdServing = match.householdServingFullText
        n.ingredients = match.ingredients; n.description = match.description
        n.brandName = match.brandName; n.brandOwner = match.brandOwner
        return n
    }

    public func fetchNutrition(_ barcode: String) async -> USDANutrition? {
        guard let match = await findBrandedMatch(barcode) else { return nil }

        // labelNutrients (only on the /food/{fdcId} detail endpoint) mirrors the printed Nutrition Facts
        // panel exactly — the authoritative per-serving source.
        if let label = await fetchJSON(USDAFoodDetail.self, "\(Self.base)/food/\(match.fdcId)?api_key=\(apiKey)")?.labelNutrients {
            var n = USDANutrition()
            n.calories = label.calories?.value; n.totalFat = label.fat?.value; n.protein = label.protein?.value
            n.carbs = label.carbohydrates?.value; n.fiber = label.fiber?.value; n.sugar = label.sugars?.value
            n.addedSugar = label.addedSugar?.value; n.saturatedFat = label.saturatedFat?.value; n.transFat = label.transFat?.value
            n.sodium = label.sodium?.value.map { $0 / 1000 }; n.potassium = label.potassium?.value.map { $0 / 1000 }
            n.servingSize = match.servingSize; n.servingSizeUnit = match.servingSizeUnit
            n.householdServing = match.householdServingFullText
            n.ingredients = match.ingredients; n.description = match.description
            n.brandName = match.brandName; n.brandOwner = match.brandOwner
            return n
        }
        // No label data — fall back to scaling the per-100g search result. Never treat per-100g as per-serving.
        return scalePer100g(match)
    }
}
