import Foundation

struct Meeting: Identifiable, Codable, Hashable {
    let id: String
    var title: String
    var status: MeetingStatus
    var rawTranscript: String
    var cleanedTranscript: String
    var summary: [String]
    var actionItems: [String]
    var rollingSnapshot: String
    var startedAt: Date
    var endedAt: Date?

    enum MeetingStatus: String, Codable {
        case active, ended
    }

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case title, status, rawTranscript, cleanedTranscript
        case summary, actionItems, rollingSnapshot, startedAt, endedAt
    }

    var displayTitle: String { title.isEmpty ? "Untitled Meeting" : title }
}

struct MeetingListItem: Identifiable, Codable {
    let id: String
    var title: String
    var status: Meeting.MeetingStatus
    var startedAt: Date
    var endedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case title, status, startedAt, endedAt
    }

    var displayTitle: String { title.isEmpty ? "Untitled Meeting" : title }
}
