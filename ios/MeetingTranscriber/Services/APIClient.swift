import Foundation

class APIClient {
    static let shared = APIClient()

    private var baseURL: URL {
        let stored = UserDefaults.standard.string(forKey: "serverURL") ?? "http://localhost:5050"
        let clean = stored.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        return URL(string: "\(clean)/api")!
    }

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        let fmt = ISO8601DateFormatter()
        fmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        d.dateDecodingStrategy = .custom { decoder in
            let s = try decoder.singleValueContainer().decode(String.self)
            if let date = fmt.date(from: s) { return date }
            let fmt2 = ISO8601DateFormatter()
            if let date = fmt2.date(from: s) { return date }
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Bad date: \(s)"))
        }
        return d
    }()

    // Fires a lightweight request to wake a sleeping Render dyno
    func warmUp() {
        Task {
            var req = URLRequest(url: baseURL.appendingPathComponent("meetings"), timeoutInterval: 45)
            req.httpMethod = "GET"
            _ = try? await URLSession.shared.data(for: req)
        }
    }

    func startMeeting(title: String) async throws -> Meeting {
        var req = URLRequest(url: baseURL.appendingPathComponent("meetings"), timeoutInterval: 45)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["title": title])
        let (data, _) = try await URLSession.shared.data(for: req)
        return try decoder.decode(Meeting.self, from: data)
    }

    // Retries up to 3 times so a Render cold-start (15–30s) doesn't drop a chunk
    func sendChunk(meetingId: String, audioURL: URL) async throws -> String {
        let audioData = try Data(contentsOf: audioURL)
        for attempt in 1...3 {
            do {
                var req = URLRequest(url: baseURL.appendingPathComponent("meetings/\(meetingId)/chunk"), timeoutInterval: 60)
                req.httpMethod = "POST"
                let boundary = UUID().uuidString
                req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
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
            } catch {
                if attempt == 3 { throw error }
                try? await Task.sleep(for: .seconds(Double(attempt) * 6))
            }
        }
        return ""
    }

    func endMeeting(meetingId: String, emailTo: String) async throws -> Meeting {
        var req = URLRequest(url: baseURL.appendingPathComponent("meetings/\(meetingId)/end"), timeoutInterval: 60)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["emailTo": emailTo])
        let (data, _) = try await URLSession.shared.data(for: req)
        return try decoder.decode(Meeting.self, from: data)
    }

    func listMeetings() async throws -> [MeetingListItem] {
        var req = URLRequest(url: baseURL.appendingPathComponent("meetings"), timeoutInterval: 45)
        let (data, _) = try await URLSession.shared.data(for: req)
        return try decoder.decode([MeetingListItem].self, from: data)
    }

    func getMeeting(id: String) async throws -> Meeting {
        let req = URLRequest(url: baseURL.appendingPathComponent("meetings/\(id)"), timeoutInterval: 45)
        let (data, _) = try await URLSession.shared.data(for: req)
        return try decoder.decode(Meeting.self, from: data)
    }
}

private extension Data {
    mutating func append(_ string: String) {
        if let d = string.data(using: .utf8) { append(d) }
    }
}
