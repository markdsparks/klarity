import Foundation

// Port of src/data/ingredient-text-index.ts.

public struct SearchTerm: Sendable {
    public let id: String
    public let phrase: String
    let regex: NSRegularExpression?

    init(id: String, phrase: String) {
        self.id = id
        self.phrase = phrase
        self.regex = try? NSRegularExpression(
            pattern: jsBoundary(before: phrase.first, leading: true)
                + NSRegularExpression.escapedPattern(for: phrase)
                + jsBoundary(before: phrase.last, leading: false),
            options: [.caseInsensitive])
    }
}

/// JS `\b` is defined over ASCII word characters [A-Za-z0-9_] only (ICU's is
/// Unicode-aware, which would treat "ñ" as a word char and diverge on accented
/// ingredient text). A boundary sits where word-ness flips, so what the lookaround
/// must demand depends on whether the phrase's edge character is itself a word char.
private func jsBoundary(before edge: Character?, leading: Bool) -> String {
    let word = "[A-Za-z0-9_]"
    let edgeIsWord = edge.map { $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "_") } ?? false
    if leading { return edgeIsWord ? "(?<!\(word))" : "(?<=\(word))" }
    return edgeIsWord ? "(?!\(word))" : "(?=\(word))"
}

/// Phrase list (name + aliases, lowercased) sorted longest-first.
public func buildSearchTerms(_ entries: [(id: String, name: String, aliases: [String]?)]) -> [SearchTerm] {
    var terms: [SearchTerm] = []
    for entry in entries {
        for phrase in [entry.name] + (entry.aliases ?? []) {
            terms.append(SearchTerm(id: entry.id, phrase: phrase.lowercased()))
        }
    }
    // JS `sort` is stable; Swift's isn't documented as such, so tie-break on original order.
    return terms.enumerated()
        .sorted { a, b in
            a.element.phrase.utf16.count != b.element.phrase.utf16.count
                ? a.element.phrase.utf16.count > b.element.phrase.utf16.count
                : a.offset < b.offset
        }
        .map(\.element)
}

/// Word-boundary phrase match against a pre-built term list, avoiding
/// partial-word false positives (e.g. "bht" inside a longer token).
public func matchSearchTerms(_ text: String, _ terms: [SearchTerm], excluding excluded: Set<String> = []) -> [String] {
    if text.isEmpty { return [] }
    let lower = text.lowercased()
    let range = NSRange(lower.startIndex..., in: lower)
    var found: [String] = []
    var seen = Set<String>()
    for term in terms {
        if excluded.contains(term.id) || seen.contains(term.id) { continue }
        if term.regex?.firstMatch(in: lower, range: range) != nil {
            found.append(term.id); seen.insert(term.id)
        }
    }
    return found
}

extension AdditiveData {
    static let searchTerms = buildSearchTerms(all.map { (id: $0.id, name: $0.name, aliases: $0.aliases) })

    /// Scan raw ingredients_text for known additive names/aliases — fallback for
    /// when OFF's own additives_tags parsing missed them.
    public static func matchByIngredientText(_ text: String, excluding excluded: Set<String> = []) -> [String] {
        matchSearchTerms(text, searchTerms, excluding: excluded)
    }
}
