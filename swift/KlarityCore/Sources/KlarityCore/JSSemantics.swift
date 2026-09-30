import Foundation

// The TS engine runs on JavaScript number/string semantics. A few of those
// differ from Swift's defaults in ways that silently change verdict copy, so
// the port routes through these instead of Foundation's near-equivalents.

/// `Math.round`: ties round toward +∞ (Swift's `.rounded()` rounds away from zero).
func jsRound(_ x: Double) -> Double { (x + 0.5).rounded(.down) }

/// `Number.prototype.toFixed`: exact-decimal rounding with ties going up
/// (printf's `%.Nf` rounds ties to even, so `(2.5).toFixed(0)` = "3" but printf gives "2").
func jsToFixed(_ x: Double, _ digits: Int) -> String {
    // Sign is handled separately, so (-0.3).toFixed(0) is "-0" (but (-0).toFixed(0) is "0").
    if x < 0 { return "-" + jsToFixed(-x, digits) }
    var value = Decimal(string: String(format: "%.40f", x)) ?? Decimal(x)
    var rounded = Decimal()
    NSDecimalRound(&rounded, &value, digits, .plain)
    return String(format: "%.\(digits)f", NSDecimalNumber(decimal: rounded).doubleValue)
}

/// `parseFloat`: longest numeric prefix ("1.2.3" → 1.2), NaN when there is none.
func jsParseFloat(_ s: String) -> Double {
    var seenDot = false
    var end = s.startIndex
    var idx = s.startIndex
    while idx < s.endIndex {
        let c = s[idx]
        if c.isASCII, c.isNumber { end = s.index(after: idx) }
        else if c == ".", !seenDot { seenDot = true }
        else { break }
        idx = s.index(after: idx)
    }
    return Double(s[s.startIndex..<end]) ?? .nan
}
