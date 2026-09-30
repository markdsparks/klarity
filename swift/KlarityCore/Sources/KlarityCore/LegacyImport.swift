import CryptoKit
import Foundation

// Spec 024 cutover — the one-time import of the RN app's local data. The Swift app ships under the same
// bundle id, so it inherits the RN app's sandbox, where @react-native-async-storage/async-storage (v2, iOS)
// keeps every key in:
//   Application Support/<bundleID>/RCTAsyncLocalStorage_V1/manifest.json   (older: Documents/RCTAsyncLocalStorage_V1)
// manifest.json maps key → value string, or → null when the value is over 1 KB, in which case the value is
// the file named by the lowercase-hex MD5 of the key, beside the manifest.

public enum LegacyAsyncStorage {
    /// Reads every key from an AsyncStorage directory; nil when there is no manifest there.
    public static func read(directory: URL) -> [String: String]? {
        guard let data = try? Data(contentsOf: directory.appending(path: "manifest.json")),
              let manifest = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        var out: [String: String] = [:]
        for (key, value) in manifest {
            if let inline = value as? String {
                out[key] = inline
            } else if value is NSNull {
                let name = Insecure.MD5.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
                if let s = try? String(contentsOf: directory.appending(path: name), encoding: .utf8) { out[key] = s }
            }
        }
        return out
    }

    /// Where the RN app's storage lives in this sandbox, newest layout first.
    public static func candidateDirectories(bundleID: String, fileManager: FileManager = .default) -> [URL] {
        var dirs: [URL] = []
        if let support = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            dirs.append(support.appending(path: bundleID).appending(path: "RCTAsyncLocalStorage_V1"))
        }
        if let docs = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first {
            dirs.append(docs.appending(path: "RCTAsyncLocalStorage_V1"))
        }
        return dirs
    }
}

/// Everything the RN app stored, decoded into the native models. Each part is independently optional:
/// one corrupt key never blocks the others.
public struct LegacyImport: Sendable {
    public var profile: Profile?
    public var history: [ScanHistoryEntry] = []
    public var userServings: [String: Double] = [:]
    public var outcomes: [ScanOutcomeRecord] = []
    public var feedback: [FeedbackRecord] = []

    public var isEmpty: Bool {
        profile == nil && history.isEmpty && userServings.isEmpty && outcomes.isEmpty && feedback.isEmpty
    }

    static let servingPrefix = "KLARITY_USER_SERVING_V1:"

    public init(values: [String: String]) {
        func decode<T: Decodable>(_ type: T.Type, _ key: String) -> T? {
            values[key].flatMap { try? JSONDecoder().decode(T.self, from: Data($0.utf8)) }
        }
        profile = decode(Profile.self, "KLARITY_PROFILE_V1")
        history = decode([ScanHistoryEntry].self, "KLARITY_HISTORY_V1") ?? []   // legacy entries normalize on decode
        outcomes = decode([ScanOutcomeRecord].self, "KLARITY_DIAGNOSTICS_V1") ?? []
        feedback = decode([FeedbackRecord].self, "KLARITY_FEEDBACK_V1") ?? []
        for (key, raw) in values where key.hasPrefix(Self.servingPrefix) {
            // Same validity rule as the RN reader (user-serving.ts): finite, > 0, ≤ 2 kg.
            if let g = Double(raw), g.isFinite, g > 0, g <= 2000 { userServings[String(key.dropFirst(Self.servingPrefix.count))] = g }
        }
    }

    /// The first candidate directory that holds RN data, decoded.
    public static func find(bundleID: String) -> LegacyImport? {
        for dir in LegacyAsyncStorage.candidateDirectories(bundleID: bundleID) {
            if let values = LegacyAsyncStorage.read(directory: dir) {
                let imported = LegacyImport(values: values)
                if !imported.isEmpty { return imported }
            }
        }
        return nil
    }
}
