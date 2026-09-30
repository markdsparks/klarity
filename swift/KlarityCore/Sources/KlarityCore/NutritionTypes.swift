import Foundation

// Ports of src/types/off.ts (the fields the engine reads) and src/types/usda.ts.

public struct OFFNutriments: Codable, Sendable, Equatable {
    public var energyKcal100g: Double?
    public var proteins100g: Double?
    public var carbohydrates100g: Double?
    public var sugars100g: Double?
    public var fat100g: Double?
    public var saturatedFat100g: Double?
    public var transFat100g: Double?
    public var fiber100g: Double?
    public var sodium100g: Double?
    public var potassium100g: Double?
    public var salt100g: Double?

    enum CodingKeys: String, CodingKey {
        case energyKcal100g = "energy-kcal_100g", proteins100g = "proteins_100g",
             carbohydrates100g = "carbohydrates_100g", sugars100g = "sugars_100g", fat100g = "fat_100g",
             saturatedFat100g = "saturated-fat_100g", transFat100g = "trans-fat_100g", fiber100g = "fiber_100g",
             sodium100g = "sodium_100g", potassium100g = "potassium_100g", salt100g = "salt_100g"
    }
    public init() {}
}

public struct OFFProduct: Codable, Sendable, Equatable {
    public var productName: String?
    public var brands: String?
    public var servingSize: String?
    public var servingQuantity: Double?
    public var quantity: String?
    public var nutriments: OFFNutriments?
    public var additivesTags: [String]?
    public var categoriesTags: [String]?
    public var ingredientsText: String?
    public var imageUrl: String?
    public var imageFrontUrl: String?

    enum CodingKeys: String, CodingKey {
        case productName = "product_name", brands, servingSize = "serving_size",
             servingQuantity = "serving_quantity", quantity, nutriments,
             additivesTags = "additives_tags", categoriesTags = "categories_tags",
             ingredientsText = "ingredients_text", imageUrl = "image_url", imageFrontUrl = "image_front_url"
    }
    public init() {}
}

/// Normalized USDA label nutrition — always per serving; sodium/potassium in grams.
public struct USDANutrition: Codable, Sendable, Equatable {
    public var calories, totalFat, protein, carbs, fiber, sugar, addedSugar: Double?
    public var saturatedFat, transFat, sodium, potassium, servingSize: Double?
    public var servingSizeUnit, householdServing: String?
    public var ingredients, description, brandName, brandOwner: String?
    public init() {}
}
