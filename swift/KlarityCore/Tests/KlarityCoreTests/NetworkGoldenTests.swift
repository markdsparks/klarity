import Foundation
import Testing
@testable import KlarityCore

// Replays scenarios recorded by scripts/gen-golden-network.ts: the TS client ran against a mocked fetch;
// here the Swift client runs against a stub serving the SAME responses and must produce the same output
// AND request the same URLs.

private struct Served: Decodable {
    let status: Int?
    let body: JSON?
    let `throw`: Bool?
}

private final class StubHTTP: HTTPClient, @unchecked Sendable {
    private let lock = NSLock()
    private var served: [String: [Served]]
    private var counters: [String: Int] = [:]
    private var log: [String] = []

    init(_ served: [String: [Served]]) { self.served = served }

    var requests: [String] { lock.withLock { log.sorted() } }

    func send(_ request: URLRequest) async throws -> (data: Data, status: Int) {
        let url = request.url!.absoluteString
        let entry: Served? = lock.withLock {
            log.append(url + (request.value(forHTTPHeaderField: "Authorization") != nil ? " [auth]" : ""))
            let n = counters[url, default: 0]; counters[url] = n + 1
            return served[url].flatMap { $0.isEmpty ? nil : $0[min(n, $0.count - 1)] }
        }
        guard let entry, entry.throw != true else { throw ClientError.network }   // unrecorded URL == the TS mock's NETWORK
        let data = try entry.body.map { try JSONEncoder().encode($0) } ?? Data()
        return (data, entry.status ?? 0)
    }
}

private final class Clock: @unchecked Sendable {
    private let lock = NSLock()
    private var ms = 1_000_000_000_000.0
    func advance(_ d: Double) { lock.withLock { ms += d } }
    func reset() { lock.withLock { ms = 1_000_000_000_000 } }
    var now: Double { lock.withLock { ms } }
}

private struct Scenario: Decodable {
    let kind: String
    let input: JSON?
    let output: JSON?
    let error: String?
    let requests: [String]?
    let served: [String: [Served]]?
    let cases: JSON?
}

private func load() throws -> [Scenario] { try golden([Scenario].self, "network") }

private func str(_ j: JSON?, _ key: String) -> String {
    if case .object(let o)? = j, case .string(let s)? = o[key] { return s }
    return ""
}

private extension Scenario {
    var stub: StubHTTP { StubHTTP(served ?? [:]) }

    /// Compares one client run against the recording. `run` returns the JSON output or throws a ClientError.
    func check(_ label: String, _ failures: inout [String], stub: StubHTTP,
               project: (JSON) -> JSON = { $0 },
               collapseTokenMints: Bool = false,
               run: () async throws -> JSON) async {
        var got: JSON = .null, gotError: String?
        do { got = try await run() } catch let e as ClientError { gotError = e.code } catch { gotError = "\(error)" }
        if gotError != error { failures.append("\(label): error \(gotError ?? "nil") != \(error ?? "nil")"); return }
        if let d = got.diff(project(output ?? .null)) { failures.append("\(label): \(d)") }
        // Concurrent token mints are timing-dependent (the TS client races; Swift shares one in-flight
        // request), so for CONCURRENT scenarios only, repeated token-proxy calls are collapsed. Sequential
        // scenarios compare exactly — they're what verifies token expiry/refresh.
        func normalized(_ rs: [String]) -> [String] {
            var seenToken = false
            return rs.sorted().filter { r in
                if collapseTokenMints, r == "https://proxy.test/token" { defer { seenToken = true }; return !seenToken }
                return true
            }
        }
        if normalized(stub.requests) != normalized(requests ?? []) {
            var counts: [String: Int] = [:]
            for r in stub.requests { counts[r, default: 0] += 1 }
            for r in requests ?? [] { counts[r, default: 0] -= 1 }
            let diff = counts.filter { $0.value != 0 }.map { "\($0.value > 0 ? "+swift" : "+ts") \(abs($0.value))× \($0.key)" }.sorted()
            failures.append("\(label): requests differ: \(diff)")
        }
    }
}

@Suite("Network client golden parity with TS clients")
struct NetworkGoldenTests {
    @Test func offSearch() async throws {
        var failures: [String] = []
        let scenarios = try load().filter { $0.kind == "offSearch" }
        for (i, s) in scenarios.enumerated() {
            let stub = s.stub
            let client = OFFClient(http: stub, sleep: { _ in })
            await s.check("search#\(i) «\(str(s.input, "query"))»", &failures, stub: stub) {
                try JSON(encoding: try await client.searchProducts(str(s.input, "query")))
            }
        }
        #expect(scenarios.count >= 250)
        #expect(failures.isEmpty, "\(failures.count) diverge, first: \(failures.prefix(2))")
    }

    @Test func offProduct() async throws {
        var failures: [String] = []
        let scenarios = try load().filter { $0.kind == "offProduct" }
        for (i, s) in scenarios.enumerated() {
            let stub = s.stub
            let client = OFFClient(http: stub, sleep: { _ in })
            await s.check("product#\(i) \(str(s.input, "barcode"))", &failures, stub: stub, project: {
                if case .object(let o) = $0 { return .object(["product_name": o["product_name"] ?? .null]) }
                return $0
            }) {
                // The recording holds the raw OFF record; which record won (rich/thin/twin) is identified by its name.
                let p = try await client.fetchProduct(str(s.input, "barcode"))
                guard let p else { return .null }
                return .object(["product_name": p.productName.map(JSON.string) ?? .null])
            }
        }
        #expect(failures.isEmpty, "\(failures.count) diverge, first: \(failures.prefix(2))")
    }

    @Test func usdaClient() async throws {
        var failures: [String] = []
        let scenarios = try load().filter { $0.kind == "usdaNutrition" || $0.kind == "usdaMatch" }
        for (i, s) in scenarios.enumerated() {
            let stub = s.stub
            let client = USDAClient(http: stub)
            await s.check("usda#\(i) \(s.kind)", &failures, stub: stub) {
                let code = str(s.input, "barcode")
                if s.kind == "usdaMatch" { return try await client.findBrandedMatch(code).map { try JSON(encoding: $0) } ?? .null }
                return try await client.fetchNutrition(code).map { try JSON(encoding: $0) } ?? .null
            }
        }
        #expect(scenarios.count >= 300)
        #expect(failures.isEmpty, "\(failures.count) diverge, first: \(failures.prefix(2))")
    }

    @Test func krogerMatchWithTokenCaching() async throws {
        var failures: [String] = []
        let scenarios = try load().filter { $0.kind == "krogerMatch" }
        for (i, s) in scenarios.enumerated() {
            let stub = s.stub
            let clock = Clock()
            let client = KrogerClient(http: stub, tokenProxyURL: "https://proxy.test/token", now: { clock.now })
            guard case .object(let input)? = s.input, case .array(let steps)? = input["steps"] else { Issue.record("bad input"); continue }
            await s.check("kroger#\(i)", &failures, stub: stub) {
                var results: [JSON] = []
                for step in steps {
                    guard case .object(let st) = step, case .number(let adv)? = st["advanceMs"] else { continue }
                    clock.advance(adv)
                    do { results.append(.object(["ok": try await client.fetchMatch(str(step, "barcode")).map { try JSON(encoding: $0) } ?? .null])) }
                    catch let e as ClientError { results.append(.object(["error": .string(e.code)])) }
                }
                return .array(results)
            }
        }
        #expect(failures.isEmpty, "\(failures.count) diverge, first: \(failures.prefix(2))")
    }

    @Test func enrichmentAndConfidenceGate() async throws {
        var failures: [String] = []
        let scenarios = try load().filter { $0.kind == "enrich" }
        for (i, s) in scenarios.enumerated() {
            let stub = s.stub
            let search = ProductSearch(usda: USDAClient(http: stub), kroger: KrogerClient(http: stub, tokenProxyURL: "https://proxy.test/token"))
            let results = try JSONDecoder().decode([OFFSearchProduct].self, from: JSONEncoder().encode({
                guard case .object(let o)? = s.input, let r = o["results"] else { return JSON.array([]) }
                return r
            }()))
            await s.check("enrich#\(i)", &failures, stub: stub, collapseTokenMints: true) { try JSON(encoding: await search.enrich(results)) }
        }
        #expect(failures.isEmpty, "\(failures.count) diverge, first: \(failures.prefix(2))")
    }

    @Test func gtinTrustAndKrogerProductId() throws {
        let all = try load()
        for s in all where s.kind == "gtinTrust" || s.kind == "krogerProductId" {
            guard case .array(let cases)? = s.cases else { Issue.record("no cases"); continue }
            for c in cases {
                guard case .object(let o) = c else { continue }
                if s.kind == "gtinTrust", case .string(let code)? = o["code"], case .number(let t)? = o["trust"] {
                    #expect(Double(gtinTrust(code)) == t, "gtinTrust \(code)")
                } else if case .string(let b)? = o["barcode"] {
                    let expected: String? = { if case .string(let v)? = o["id"] { return v } else { return nil } }()
                    #expect(krogerProductId(b) == expected, "krogerProductId \(b)")
                }
            }
        }
    }
}
