import SwiftUI

@Observable
class ActiveMeetingModel {
    var meeting: Meeting
    var rollingSnapshot: String = ""
    var isProcessing = false
    var errorMessage: String?

    private let chunker = AudioChunker()
    private var summaryTimer: Timer?

    var elapsed: Int { chunker.elapsedSeconds }
    var isRecording: Bool { chunker.isRecording }

    init(meeting: Meeting) {
        self.meeting = meeting
        chunker.onChunkReady = { [weak self] url in
            guard let self else { return }
            self.isProcessing = true
            if let snapshot = try? await APIClient.shared.sendChunk(meetingId: self.meeting.id, audioURL: url),
               !snapshot.isEmpty {
                self.rollingSnapshot = snapshot
            }
            self.isProcessing = false
        }
    }

    func startRecording() async {
        do { try await chunker.start() } catch { errorMessage = error.localizedDescription }
        // Refresh snapshot every 5 min from server
        summaryTimer = Timer.scheduledTimer(withTimeInterval: 300, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task {
                if let m = try? await APIClient.shared.getMeeting(id: self.meeting.id) {
                    self.rollingSnapshot = m.rollingSnapshot
                }
            }
        }
    }

    func endMeeting(emailTo: String) async -> Meeting? {
        if let lastURL = await chunker.stop() {
            _ = try? await APIClient.shared.sendChunk(meetingId: meeting.id, audioURL: lastURL)
        }
        summaryTimer?.invalidate()
        return try? await APIClient.shared.endMeeting(meetingId: meeting.id, emailTo: emailTo)
    }
}

struct ActiveMeetingView: View {
    @State var model: ActiveMeetingModel
    @AppStorage("userEmail") private var userEmail = ""
    @State private var showEnd = false
    var onEnded: ((Meeting) -> Void)?

    var body: some View {
        ZStack(alignment: .bottom) {
            // Transcript scroll
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // Status bar
                        HStack(spacing: 8) {
                            Circle()
                                .fill(.red)
                                .frame(width: 8, height: 8)
                                .opacity(model.isRecording ? 1 : 0.3)
                                .animation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true), value: model.isRecording)
                            Text(model.isRecording ? "Recording" : "Starting…")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(.secondary)
                            Spacer()
                            if model.isProcessing {
                                HStack(spacing: 5) {
                                    ProgressView().scaleEffect(0.7)
                                    Text("Transcribing")
                                        .font(.system(size: 12))
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Text(formatTime(model.elapsed))
                                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 20)
                        .padding(.top, 8)

                        if model.meeting.rawTranscript.isEmpty {
                            Text("Start speaking — transcript will appear here.")
                                .font(.system(size: 15))
                                .foregroundStyle(.tertiary)
                                .padding(.horizontal, 20)
                        } else {
                            Text(model.meeting.rawTranscript)
                                .font(.system(size: 15))
                                .lineSpacing(3)
                                .foregroundStyle(.primary)
                                .padding(.horizontal, 20)
                                .id("transcript")
                                .onChange(of: model.meeting.rawTranscript) {
                                    withAnimation { proxy.scrollTo("transcript", anchor: .bottom) }
                                }
                        }

                        Spacer().frame(height: 220)
                    }
                }
            }

            // Floating bottom panel
            VStack(spacing: 10) {
                FloatingSummaryCard(snapshot: model.rollingSnapshot)

                Button {
                    showEnd = true
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "stop.circle.fill")
                        Text("End Meeting")
                            .fontWeight(.semibold)
                    }
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(.red.opacity(0.88))
                            .shadow(color: .red.opacity(0.3), radius: 12, x: 0, y: 6)
                    )
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 20)
            }
        }
        .navigationTitle(model.meeting.displayTitle)
        .navigationBarTitleDisplayMode(.inline)
        .task { await model.startRecording() }
        .alert("End Meeting?", isPresented: $showEnd) {
            Button("End & Send Summary", role: .destructive) {
                Task {
                    let ended = await model.endMeeting(emailTo: userEmail)
                    onEnded?(ended ?? model.meeting)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(userEmail.isEmpty
                 ? "Meeting will be saved. Add your email in Settings to get a summary."
                 : "Summary will be emailed to \(userEmail).")
        }
    }

    private func formatTime(_ s: Int) -> String {
        String(format: "%02d:%02d", s / 60, s % 60)
    }
}
