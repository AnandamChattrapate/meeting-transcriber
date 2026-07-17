import Foundation

class APIClient {
    static let shared = APIClient()

    private var baseURL: URL {
        let stored = UserDefaults.standard.string(forKey: "serverURL") ?? "http://localhost:5050"
        return URL(string: "\(stored)/api")!
    }

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        d.dateDecodingStrategy = .custom { decoder in
            let s = try decoder.singleValueContainer().decode(String.self)
            if let date = fmt.date(from: s) { return date }
            // fallback without fractional seconds
            let fmt2 = ISO8601DateFormatter()
            if let date = fmt2.date(from: s) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Bad date: \(s)"))
        }
        return d
    }()

    func startMeeting(title: String) async throws -> Meeting {
        var req = URLRequest(url: baseURL.appendingPathComponent("meetings"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["title": title])
        let (data, _) = try await URLSession.shared.data(for: req)
        return try decoder.decode(Meeting.self, from: data)
    }

    func sendChunk(meetingId: String, audioURL: URL) async throws -> String {
        var req = URLRequest(url: baseURL.appendingPathComponent("meetings/\(meetingId)/chunk"))
        req.httpMethod = "POST"
        let boundary = UUID().uuidString
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        let audioData = try Data(contentsOf: audioURL)
        var body = Data()
        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"audio\"; filename=\"chunk.m4a\"\r\n")
        body.append("Content-Type: audio/m4a\r\n\r\n")
        body.append(audioData)
        body.append("\r\n--\(boundary)--\r\n")
        req.httpBody = body

        let (data, _) = try await URLSession.shared.data(for: req)
        let json = try JSONDecoder().decode([String: String].self, from: data)
        return json["rollingSnapshot"] ?? ""
    }

    func endMeeting(meetingId: String, emailTo: String) async throws -> Meeting {
        var req = URLRequest(url: baseURL.appendingPathComponent("meetings/\(meetingId)/end"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["emailTo": emailTo])
        let (data, _) = try await URLSession.shared.data(for: req)
        return try decoder.decode(Meeting.self, from: data)
    }

    func listMeetings() async throws -> [MeetingListItem] {
        let (data, _) = try await URLSession.shared.data(for: URLRequest(url: baseURL.appendingPathComponent("meetings")))
        return try decoder.decode([MeetingListItem].self, from: data)
    }

    func getMeeting(id: String) async throws -> Meeting {
        let (data, _) = try await URLSession.shared.data(for: URLRequest(url: baseURL.appendingPathComponent("meetings/\(id)")))
        return try decoder.decode(Meeting.self, from: data)
    }
}

private extension Data {
    mutating func append(_ string: String) {
        if let d = string.data(using: .utf8) { append(d) }
    }
}
