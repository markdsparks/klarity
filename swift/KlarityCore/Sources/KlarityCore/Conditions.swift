import Foundation

// Port of src/data/conditions.ts — profile conditions offered in the You tab.
// 'additive' conditions surface authored subgroupNotes (ids match Additive.subgroupNotes keys);
// 'nutrition' conditions re-weight nutrition emphasis.

public enum ConditionKind: String, Codable, Sendable { case additive, nutrition }

public struct ConditionDef: Codable, Sendable, Equatable, Identifiable {
    public let id: String
    public let label: String
    public let hint: String
    public let kind: ConditionKind

    public static let all: [ConditionDef] = Resource.decode([ConditionDef].self, "conditions")
}
