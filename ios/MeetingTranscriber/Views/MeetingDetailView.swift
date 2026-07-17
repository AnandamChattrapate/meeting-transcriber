import SwiftUI

struct MeetingDetailView: View {
    let meetingId: String
    @State private var meeting: Meeting?
    @State private var isLoading = true

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if let m = meeting {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if !m.summary.isEmpty {
                            GlassSection(title: "Summary") {
                                VStack(alignment: .leading, spacing: 8) {
                                    ForEach(m.summary, id: \.self) { point in
                                        Label(point, systemImage: "circle.fill")
                                            .labelStyle(BulletStyle())
                                    }
                                }
                            }
                        }

                        if !m.actionItems.isEmpty {
                            GlassSection(title: "Action Items") {
                                VStack(alignment: .leading, spacing: 8) {
                                    ForEach(m.actionItems, id: \.self) { item in
                                        Label(item, systemImage: "checkmark.circle")
                                            .labelStyle(BulletStyle(iconColor: .purple))
                                    }
                                }
                            }
                        }

                        GlassSection(title: "Transcript") {
                            Text(m.cleanedTranscript.isEmpty ? m.rawTranscript : m.cleanedTranscript)
                                .font(.system(size: 15))
                                .lineSpacing(4)
                                .foregroundStyle(.primary)
                        }
                    }
                    .padding(16)
                }
                .background(Color(.systemGroupedBackground))
                .navigationTitle(m.displayTitle)
                .navigationBarTitleDisplayMode(.large)
            }
        }
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        meeting = try? await APIClient.shared.getMeeting(id: meetingId)
        isLoading = false
    }
}

struct GlassSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.purple)
                .tracking(1)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .stroke(Color.white.opacity(0.4), lineWidth: 0.5)
                )
                .shadow(color: .black.opacity(0.06), radius: 12, x: 0, y: 4)
        )
    }
}

struct BulletStyle: LabelStyle {
    var iconColor: Color = .purple.opacity(0.5)
    func makeBody(configuration: Configuration) -> some View {
        HStack(alignment: .top, spacing: 8) {
            configuration.icon
                .font(.system(size: 7))
                .foregroundStyle(iconColor)
                .padding(.top, 5)
            configuration.title
                .font(.system(size: 15))
                .lineSpacing(3)
        }
    }
}
