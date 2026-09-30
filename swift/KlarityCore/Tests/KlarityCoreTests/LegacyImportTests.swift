import CryptoKit
import Foundation
import Testing
@testable import KlarityCore

@Suite("Legacy AsyncStorage import")
struct LegacyImportTests {
    /// Builds a directory exactly as @react-native-async-storage v2 writes it on iOS.
    private func makeStore(_ values: [String: String]) throws -> URL {
        let dir = FileManager.default.temporaryDirectory.appending(path: "rct-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        var manifest: [String: Any] = [:]
        for (key, value) in values {
            if value.utf8.count <= 1024 {
                manifest[key] = value
            } else {
                manifest[key] = NSNull()
                let name = Insecure.MD5.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
                try value.write(to: dir.appending(path: name), atomically: true, encoding: .utf8)
            }
        }
        try JSONSerialization.data(withJSONObject: manifest).write(to: dir.appending(path: "manifest.json"))
        return dir
    }

    @Test func readsInlineAndOverflowValuesAndDecodesEveryKey() throws {
        // A >1 KB history forces the overflow-file path; entries include the pre-frequency-tracking legacy shape.
        let legacyEntry = #"{"barcode":"0016000170032","productName":"Cheerios","brand":"General Mills","additiveGlance":"everyday","nutritionTone":"good","scannedAt":1751800000000}"#
        let current = (0..<12).map { i in
            #"{"barcode":"restaurant:cfa_\#(i)","productName":"Item \#(i)","brand":"Chick-fil-A","additiveGlance":"sometimes","nutritionTone":"warn","scannedAt":\#(1751900000000 + i),"scanCount":3,"scanTimestamps":[\#(1751900000000 + i)],"buySignal":"regular","restaurant":{"itemId":"cfa_\#(i)","removedIds":["pickles"]}}"#
        }
        let history = "[" + ([legacyEntry] + current).joined(separator: ",") + "]"
        #expect(history.utf8.count > 1024)
        let dir = try makeStore([
            "KLARITY_HISTORY_V1": history,
            "KLARITY_PROFILE_V1": #"{"id":"default","label":"You","values":"precaution","conditions":["ibd"],"sex":"female","goal":"build"}"#,
            "KLARITY_USER_SERVING_V1:0123": "45",
            "KLARITY_USER_SERVING_V1:bad": "-3",
            "KLARITY_DIAGNOSTICS_V1": #"[{"at":1,"source":"barcode","outcome":"not-found","barcode":"9"}]"#,
            "KLARITY_FEEDBACK_V1": "not json",
            "SOMETHING_ELSE": "ignored",
        ])
        let values = try #require(LegacyAsyncStorage.read(directory: dir))
        #expect(values["KLARITY_HISTORY_V1"] == history)

        let imported = LegacyImport(values: values)
        #expect(imported.profile?.values == .precaution && imported.profile?.conditions == ["ibd"] && imported.profile?.goal == .build)
        #expect(imported.history.count == 13)
        #expect(imported.history[0].scanCount == 1 && imported.history[0].scanTimestamps == [1751800000000])   // normalized
        #expect(imported.history[1].restaurant?.addedIds == [] && imported.history[1].buySignal == .regular)
        #expect(imported.userServings == ["0123": 45])
        #expect(imported.outcomes.first?.outcome == .notFound)
        #expect(imported.feedback.isEmpty)   // one corrupt key never blocks the others
    }

    @Test func missingDirectoryIsNil() {
        #expect(LegacyAsyncStorage.read(directory: URL(filePath: "/nonexistent-\(UUID())")) == nil)
    }
}
