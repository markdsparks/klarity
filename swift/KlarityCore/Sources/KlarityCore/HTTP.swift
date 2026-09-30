import Foundation

/// Transport seam — production uses URLSession; tests replay recorded responses.
public protocol HTTPClient: Sendable {
    /// Returns the response body and status. Throws only for transport failures (no response at all).
    func send(_ request: URLRequest) async throws -> (data: Data, status: Int)
}

public struct URLSessionHTTPClient: HTTPClient {
    public init() {}
    public func send(_ request: URLRequest) async throws -> (data: Data, status: Int) {
        let (data, response) = try await URLSession.shared.data(for: request)
        return (data, (response as? HTTPURLResponse)?.statusCode ?? 0)
    }
}

/// Mirrors the TS services' error strings ("NETWORK", "HTTP_404") so callers/tests compare the same tokens.
public enum ClientError: Error, Equatable, Sendable {
    case network
    case http(Int)
    public var code: String {
        switch self { case .network: "NETWORK"; case .http(let s): "HTTP_\(s)" }
    }
}

/// `encodeURIComponent`: everything except A–Z a–z 0–9 - _ . ! ~ * ' ( ) is percent-encoded.
func encodeURIComponent(_ s: String) -> String {
    let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.!~*'()")
    return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? s
}

let userAgent = "Klarity/1.0 (contact@klarity.app)"

func makeRequest(_ url: String, timeout: TimeInterval, headers: [String: String] = [:]) -> URLRequest? {
    guard let u = URL(string: url) else { return nil }
    var r = URLRequest(url: u, timeoutInterval: timeout)
    for (k, v) in headers { r.setValue(v, forHTTPHeaderField: k) }
    return r
}
