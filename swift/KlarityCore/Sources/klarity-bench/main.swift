import Foundation
import KlarityCore

// Scan-coverage benchmark. Runs real US grocery barcodes through the exact resolver + outcome classifier the
// app uses, so "what share of scans end in a verdict" is measured instead of guessed.
//
//   klarity-bench sample <out.tsv>             Kroger catalog → barcodes (store-shelf sample, independent of OFF)
//   klarity-bench run <in.tsv> <out-dir>       resolve each barcode → results.jsonl + summary.md
//
// Reads EXPO_PUBLIC_USDA_API_KEY and EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL from the environment (same .env as the app).
// Kroger product data is never written out — only GTINs (identifiers) go into the sample file.

let env = ProcessInfo.processInfo.environment
let usdaKey = env["EXPO_PUBLIC_USDA_API_KEY"].flatMap { $0.isEmpty ? nil : $0 } ?? "DEMO_KEY"
let krogerProxy = env["EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL"].flatMap { $0.isEmpty ? nil : $0 }

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8)); exit(1)
}

// MARK: - Sample

/// What a family cart actually holds — packaged-goods aisles where additives and nutrition both matter.
let categories = [
    "cereal", "granola bar", "potato chips", "tortilla chips", "crackers", "cookies", "yogurt", "milk",
    "cheese", "bread", "frozen pizza", "ice cream", "soda", "juice", "sports drink", "peanut butter",
    "pasta sauce", "salad dressing", "ketchup", "canned soup", "candy", "lunch meat", "hot dogs",
    "frozen meals", "protein bar", "coffee creamer", "macaroni and cheese", "salsa", "bacon", "snack cakes",
]
let perCategory = 10

/// Kroger's productId is the GTIN without its check digit, zero-padded to 13. Rebuild the code a scanner reads:
/// UPC-A (12) when it fits, else EAN-13. Short codes (PLU/random-weight) aren't scannable packages — skip.
func gtin(fromKrogerId id: String) -> String? {
    let significant = String(id.drop(while: { $0 == "0" }))
    guard significant.count >= 7 else { return nil }
    let body = significant.count <= 11 ? String(repeating: "0", count: 11 - significant.count) + significant
             : significant.count == 12 ? significant : nil
    guard let body else { return nil }
    let digits = body.compactMap(\.wholeNumberValue)
    // GS1 check digit: weight 3 on positions counted from the right starting at 1.
    let sum = digits.reversed().enumerated().reduce(0) { $0 + $1.element * ($1.offset % 2 == 0 ? 3 : 1) }
    return body + String((10 - sum % 10) % 10)
}

struct KrogerSearch: Decodable {
    struct Product: Decodable { let productId: String }
    let data: [Product]?
}

func sample(out: String) async {
    guard let proxy = krogerProxy, let tokenURL = URL(string: proxy) else { fail("EXPO_PUBLIC_KROGER_TOKEN_PROXY_URL not set") }
    struct Token: Decodable { let access_token: String }
    guard let (tokenData, _) = try? await URLSession.shared.data(from: tokenURL),
          let token = try? JSONDecoder().decode(Token.self, from: tokenData).access_token else { fail("token proxy failed") }

    var seen = Set<String>()
    var lines = ["# gtin\tcategory — sampled from Kroger catalog search (relevance order), \(Date().formatted(.iso8601))"]
    for category in categories {
        var url = URLComponents(string: "https://api.kroger.com/v1/products")!
        // Over-fetch: some hits are PLUs or duplicates of an earlier category.
        url.queryItems = [.init(name: "filter.term", value: category), .init(name: "filter.limit", value: "30")]
        var request = URLRequest(url: url.url!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        guard let (data, _) = try? await URLSession.shared.data(for: request),
              let products = try? JSONDecoder().decode(KrogerSearch.self, from: data).data else {
            print("  \(category): search failed"); continue
        }
        var taken = 0
        for p in products where taken < perCategory {
            guard let code = gtin(fromKrogerId: p.productId), seen.insert(code).inserted else { continue }
            lines.append("\(code)\t\(category)"); taken += 1
        }
        print("  \(category): \(taken)")
    }
    try! (lines.joined(separator: "\n") + "\n").write(toFile: out, atomically: true, encoding: .utf8)
    print("wrote \(lines.count - 1) barcodes → \(out)")
}

// MARK: - Audit-only additive detector

/// An INDEPENDENT, deliberately broad name list used only to estimate what the engine misses in ingredient
/// text. Not evidence data and never shipped: it says "an additive is probably here", nothing about safety.
/// US label names first (the engine's E-number names are EU-style and rarely appear on US labels).
let usLabelNames: [(String, [String])] = [
    ("sodium benzoate", []), ("potassium sorbate", []), ("sorbic acid", []), ("calcium propionate", []),
    ("sodium propionate", []), ("bht", []), ("bha", []), ("tbhq", []), ("propyl gallate", []),
    ("edta", ["calcium disodium edta", "disodium edta"]), ("sodium nitrite", []), ("sodium nitrate", []),
    ("sodium erythorbate", []), ("sodium ascorbate", []), ("red 40", ["red #40", "red no. 40", "allura red"]),
    ("red 3", ["red #3", "red no. 3"]), ("yellow 5", ["yellow #5", "yellow no. 5", "tartrazine"]),
    ("yellow 6", ["yellow #6", "yellow no. 6"]), ("blue 1", ["blue #1", "blue no. 1"]), ("blue 2", ["blue #2"]),
    ("caramel color", ["caramel colour"]), ("titanium dioxide", []), ("annatto", []),
    ("sucralose", []), ("acesulfame potassium", ["acesulfame k", "ace-k"]), ("aspartame", []), ("saccharin", []),
    ("stevia", ["rebaudioside", "steviol glycosides", "stevia leaf extract"]), ("monk fruit", ["luo han guo"]),
    ("sugar alcohol", ["erythritol", "sorbitol", "maltitol", "xylitol"]),
    ("carrageenan", []), ("xanthan gum", []), ("guar gum", []), ("gellan gum", []), ("locust bean gum", []),
    ("cellulose gum", ["carboxymethylcellulose"]), ("modified food starch", ["modified corn starch"]),
    ("pectin", []), ("agar", []), ("gum arabic", ["acacia gum"]),
    ("mono- and diglycerides", ["mono and diglycerides", "monoglycerides", "diglycerides"]),
    ("soy lecithin", ["sunflower lecithin", "lecithin"]), ("polysorbate", ["polysorbate 80", "polysorbate 60"]),
    ("datem", []), ("sodium stearoyl lactylate", []), ("propylene glycol", []),
    ("sodium phosphate", ["disodium phosphate", "trisodium phosphate", "sodium aluminum phosphate", "sodium hexametaphosphate"]),
    ("calcium phosphate", ["tricalcium phosphate", "monocalcium phosphate", "dicalcium phosphate"]),
    ("sodium acid pyrophosphate", []), ("phosphoric acid", []), ("citric acid", []), ("malic acid", []),
    ("lactic acid", []), ("sodium citrate", []), ("monosodium glutamate", ["msg"]),
    ("disodium inosinate", []), ("disodium guanylate", []), ("yeast extract", []),
    ("high fructose corn syrup", []), ("maltodextrin", []), ("natural flavor", ["natural flavors", "natural flavour"]),
    ("artificial flavor", ["artificial flavors"]), ("silicon dioxide", []), ("calcium silicate", []),
    ("potassium bromate", []), ("azodicarbonamide", []), ("brominated vegetable oil", []),
    ("partially hydrogenated", []), ("calcium chloride", []), ("calcium sulfate", []), ("sodium bicarbonate", ["baking soda"]),
]

/// Things that are additives by function but that an evidence-tiered app may reasonably leave unrated
/// (flavors, sweetener syrups, leavening). Reported separately so they don't swamp the real gaps.
let lowStakes: Set<String> = ["natural flavor", "citric acid", "sodium bicarbonate", "pectin", "lactic acid",
                              "high fructose corn syrup", "maltodextrin", "artificial flavor", "calcium chloride"]

let auditTerms = buildSearchTerms(usLabelNames.map { (id: $0.0, name: $0.0, aliases: $0.1) })

// MARK: - Run

struct Row: Codable {
    var barcode: String
    var category: String
    var name: String?
    var brand: String?
    var outcome: String           // ScanOutcome raw value, or "error"
    var error: String?
    var offFound: Bool
    var usdaFound: Bool
    var krogerFound: Bool
    var synthesized: Bool         // identity came from USDA/Kroger because OFF had nothing
    var hasIngredientText: Bool
    var offTagCount: Int          // OFF's own parsed additive tags (0 also when OFF lacks the product)
    var rated: [String]           // hand-authored additive ids
    var regulatory: [String]      // "E322 Lecithins"
    var unknown: [String]
    var auditInText: [String]     // audit detector hits across all ingredient text
    var auditMissed: [String]     // audit hits with no matching detection — candidate gaps
    var glance: String?
    var nutritionTone: String?
    var sugarBasis: String?
    var servingBasis: String?
    var hasNutrition: Bool
    var ms: Int
}

/// Rough E-number ↔ audit-name bridge, so a regulatory/unknown detection counts as "seen" in the audit.
func detectedNames(_ r: ResolvedProduct) -> String {
    let rated = AdditiveData.additives(ids: r.additiveIds).map { "\($0.name) \(($0.aliases ?? []).joined(separator: " "))" }
    return (rated + r.regulatory.map(\.name) + r.unknown.map(\.name)).joined(separator: " ").lowercased()
}

func analyze(_ barcode: String, _ category: String, resolver: ScanResolver) async -> Row {
    let start = Date()
    var row = Row(barcode: barcode, category: category, outcome: "error", offFound: false, usdaFound: false,
                  krogerFound: false, synthesized: false, hasIngredientText: false, offTagCount: 0, rated: [],
                  regulatory: [], unknown: [], auditInText: [], auditMissed: [], hasNutrition: false, ms: 0)
    let resolution: ScanResolution
    // OFF answers bursts with 429; the bench backs off and retries (the app itself does not — see report).
    var attempt = 0
    while true {
        do { resolution = try await resolver.resolve(barcode); break } catch {
            if case .http(429) = error as? ClientError, attempt < 3 {
                attempt += 1; try? await Task.sleep(for: .seconds(20 * attempt)); continue
            }
            row.error = (error as? ClientError)?.code ?? "\(error)"
            row.ms = Int(Date().timeIntervalSince(start) * 1000)
            return row
        }
    }
    guard case .found(let r) = resolution else {
        row.outcome = ScanOutcome.notFound.rawValue
        row.ms = Int(Date().timeIntervalSince(start) * 1000)
        return row
    }
    let analysis = ProductAnalysis(r, profile: .default)
    let record = ProductAnalysis.outcomeRecord(r, source: .barcode, userServingGrams: nil, now: 0)
    let texts = [r.product.ingredientsText, r.usda?.ingredients, r.kroger?.ingredientStatement].compactMap { $0 }
    let allText = texts.joined(separator: " . ")
    let audit = matchSearchTerms(allText, auditTerms)
    let seen = detectedNames(r)

    row.name = analysis.name; row.brand = analysis.brand
    row.outcome = record.outcome.rawValue
    row.usdaFound = r.usda != nil
    row.krogerFound = r.kroger?.matched == true
    row.synthesized = r.product == synthesizeProduct(usda: r.usda, kroger: r.kroger)
    row.offFound = !row.synthesized
    row.hasIngredientText = texts.contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    row.offTagCount = row.synthesized ? 0 : (r.product.additivesTags ?? []).count
    row.rated = r.additiveIds
    row.regulatory = r.regulatory.map { "\($0.eNumber) \($0.name)" }
    row.unknown = r.unknown.map { "\($0.eNumber) \($0.name)" }
    row.auditInText = audit
    row.auditMissed = audit.filter { name in
        !seen.contains(name) && !(usLabelNames.first { $0.0 == name }?.1 ?? []).contains { seen.contains($0) }
    }
    row.glance = analysis.glance.rawValue
    row.nutritionTone = analysis.nutrition.tone.rawValue
    row.sugarBasis = record.sugarBasis?.rawValue
    row.servingBasis = analysis.servingNutrients.basis?.rawValue
    row.hasNutrition = hasNutritionData(analysis.servingNutrients)
    row.ms = Int(Date().timeIntervalSince(start) * 1000)
    return row
}

func run(input: String, outDir: String) async {
    guard let text = try? String(contentsOfFile: input, encoding: .utf8) else { fail("can't read \(input)") }
    var items: [(String, String)] = text.split(separator: "\n").compactMap { line in
        if line.hasPrefix("#") { return nil }
        let parts = line.split(separator: "\t").map(String.init)
        return parts.count >= 2 ? (parts[0], parts[1]) : (parts.first.map { ($0, "uncategorized") })
    }
    print("resolving \(items.count) barcodes (USDA key: \(usdaKey == "DEMO_KEY" ? "DEMO" : "set"), Kroger: \(krogerProxy == nil ? "off" : "on"))")

    let http = URLSessionHTTPClient()
    let resolver = ScanResolver(off: OFFClient(http: http), usda: USDAClient(http: http, apiKey: usdaKey),
                                kroger: KrogerClient(http: http, tokenProxyURL: krogerProxy))
    // Small fixed concurrency: polite to OFF (100 product reads/min) and USDA (1,000/hr, ~2 calls per scan).
    // A rerun keeps every resolved row from the previous run and retries only errors (e.g. OFF 429s).
    let concurrency = 1
    var rows: [Row] = []
    if let prior = try? String(contentsOfFile: "\(outDir)/results.jsonl", encoding: .utf8) {
        rows = prior.split(separator: "\n").compactMap { try? JSONDecoder().decode(Row.self, from: Data($0.utf8)) }
            .filter { $0.outcome != "error" }
        let done = Set(rows.map(\.barcode))
        items = items.filter { !done.contains($0.0) }
        print("reusing \(rows.count) rows from the previous run; resolving \(items.count)")
    }
    let allItems = items
    let total = rows.count + items.count
    await withTaskGroup(of: Row.self) { group in
        var next = 0
        func enqueue() {
            guard next < allItems.count else { return }
            let (code, cat) = allItems[next]; next += 1
            group.addTask {
                let row = await analyze(code, cat, resolver: resolver)
                try? await Task.sleep(for: .milliseconds(1500))
                return row
            }
        }
        for _ in 0..<concurrency { enqueue() }
        for await row in group {
            rows.append(row)
            print(String(format: "  [%3d/%d] %-16@ %-14@ %@", rows.count, total, row.outcome as NSString,
                         row.barcode as NSString, (row.name ?? row.error ?? "") as NSString))
            enqueue()
        }
    }
    let codes = text.split(separator: "\n").filter { !$0.hasPrefix("#") }.map { String($0.split(separator: "\t").first ?? "") }
    let order = Dictionary(codes.enumerated().map { ($1, $0) }, uniquingKeysWith: { a, _ in a })
    rows.sort { (order[$0.barcode] ?? 0) < (order[$1.barcode] ?? 0) }

    try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)
    let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
    let jsonl = rows.map { String(data: try! encoder.encode($0), encoding: .utf8)! }.joined(separator: "\n")
    try! (jsonl + "\n").write(toFile: "\(outDir)/results.jsonl", atomically: true, encoding: .utf8)
    try! summary(rows).write(toFile: "\(outDir)/summary.md", atomically: true, encoding: .utf8)
    print("wrote \(outDir)/results.jsonl and summary.md")
}

// MARK: - Summary

func pct(_ n: Int, _ d: Int) -> String { d == 0 ? "–" : String(format: "%.0f%%", Double(n) / Double(d) * 100) }

func tally<S: Sequence>(_ xs: S) -> [(String, Int)] where S.Element == String {
    Dictionary(xs.map { ($0, 1) }, uniquingKeysWith: +).sorted { $0.value != $1.value ? $0.value > $1.value : $0.key < $1.key }
}

func summary(_ rows: [Row]) -> String {
    let n = rows.count
    var s = "# Scan-coverage benchmark\n\n\(n) barcodes · \(Date().formatted(.iso8601))\n\n"

    s += "## Outcomes (the app's own classifier)\n\n| outcome | count | share |\n|---|---:|---:|\n"
    for (k, v) in tally(rows.map(\.outcome)) { s += "| \(k) | \(v) | \(pct(v, n)) |\n" }

    let found = rows.filter { $0.outcome != "not-found" && $0.outcome != "error" }
    s += "\n## Sources (of \(found.count) found)\n\n"
    s += "- OFF had the product: \(found.filter(\.offFound).count) (\(pct(found.filter(\.offFound).count, found.count)))\n"
    s += "- Identity synthesized from USDA/Kroger (OFF missing): \(found.filter(\.synthesized).count)\n"
    s += "- USDA matched: \(found.filter(\.usdaFound).count) (\(pct(found.filter(\.usdaFound).count, found.count)))\n"
    s += "- Kroger matched: \(found.filter(\.krogerFound).count) — inflated by design (sample came from Kroger)\n"
    s += "- Any ingredient text: \(found.filter(\.hasIngredientText).count) (\(pct(found.filter(\.hasIngredientText).count, found.count)))\n"
    s += "- Usable nutrition: \(found.filter(\.hasNutrition).count) (\(pct(found.filter(\.hasNutrition).count, found.count)))\n"

    // Includes the bench's own 429 backoff waits, so treat as an upper bound, not device latency.
    let ms = rows.map(\.ms).sorted()
    if !ms.isEmpty {
        s += "\nResolve time (bench machine, contended): p50 \(ms[ms.count / 2]) ms · p90 \(ms[Int(Double(ms.count) * 0.9)]) ms\n"
    }

    s += "\n## By category\n\n| category | n | not found | full verdict¹ | clean | gap² |\n|---|---:|---:|---:|---:|---:|\n"
    let cats = Array(Set(rows.map(\.category))).sorted()
    for c in cats {
        let r = rows.filter { $0.category == c }
        let nf = r.filter { $0.outcome == "not-found" || $0.outcome == "error" }.count
        let full = r.filter { $0.outcome == "confident" }.count
        let clean = r.filter { $0.outcome == "clean" }.count
        s += "| \(c) | \(r.count) | \(nf) | \(full) | \(clean) | \(r.count - nf - full - clean) |\n"
    }
    s += "\n¹ `confident`: rated additive verdict(s) + nutrition. ² unrated-additive, regulatory-only, or thin-nutrition.\n"

    let falseClean = found.filter { $0.outcome == "clean" && $0.auditMissed.contains { !lowStakes.contains($0) } }
    s += "\n## \"Clean\" that probably isn't\n\n\(falseClean.count) of \(found.filter { $0.outcome == "clean" }.count) products classified `clean` have additive names in their ingredient text that nothing detected:\n\n"
    for r in falseClean.prefix(40) {
        s += "- \(r.name ?? r.barcode) (\(r.barcode)) — \(r.auditMissed.filter { !lowStakes.contains($0) }.joined(separator: ", "))\n"
    }

    s += "\n## Most common undetected additives (audit detector, all found products)\n\n| additive | products | |\n|---|---:|---|\n"
    for (k, v) in tally(found.flatMap(\.auditMissed)).prefix(30) { s += "| \(k) | \(v) | \(lowStakes.contains(k) ? "low-stakes" : "") |\n" }

    s += "\n## Most common unrated E-numbers (detected, but no evidence entry)\n\n| additive | products | tier |\n|---|---:|---|\n"
    let unrated = tally(found.flatMap { $0.regulatory.map { "R|" + $0 } + $0.unknown.map { "U|" + $0 } })
    for (k, v) in unrated.prefix(30) {
        s += "| \(k.dropFirst(2)) | \(v) | \(k.hasPrefix("R") ? "regulatory-only" : "unknown") |\n"
    }

    s += "\n## Most common rated additives\n\n"
    for (k, v) in tally(found.flatMap(\.rated)).prefix(20) { s += "- \(k): \(v)\n" }

    s += "\n## Not found\n\n"
    for r in rows where r.outcome == "not-found" || r.outcome == "error" {
        s += "- \(r.barcode) (\(r.category))\(r.error.map { " — error \($0)" } ?? "")\n"
    }
    return s
}

// MARK: - Main

let args = CommandLine.arguments
switch args.dropFirst().first {
case "sample" where args.count == 3: await sample(out: args[2])
case "run" where args.count == 4: await run(input: args[2], outDir: args[3])
default: fail("usage: klarity-bench sample <out.tsv> | run <in.tsv> <out-dir>")
}
