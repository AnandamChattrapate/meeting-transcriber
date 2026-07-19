import SwiftUI

@MainActor
@Observable
class ActiveMeetingModel {
    var meeting: Meeting
    var rollingSnapshot: String = ""
    var isProcessing = false
    var isRecording = false
    var elapsed: Int = 0
    var errorMessage: String?

    private let chunker = AudioChunker()
    private var summaryTimer: Timer?
    private var elapsedTimer: Timer?
    private var hasStarted = false

    init(meeting: Meeting) {
        self.meeting = meeting
        chunker.onChunkReady = { @MainActor [weak self] (url: URL) in
            guard let self else { return }
            self.isProcessing = true
            if let snapshot = try? await APIClient.shared.sendChunk(meetingId: self.meeting.id, audioURL: url),
               !snapshot.isEmpty {
                self.rollingSnapshot = snapshot
            }
            self.isProcessing = false
        }
    }

    func startIfNeeded() async {
        guard !hasStarted else { return }
        hasStarted = true

        do {
            try await chunker.start()
            isRecording = true
        } catch {
            errorMessage = error.localizedDescription
            return
        }

        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.elapsed += 1 }
        }

        summaryTimer = Timer.scheduledTimer(withTimeInterval: 150, repeats: true) { [weak self] _ in
            guard let self else { return }
            Task { @MainActor in
                if let m = try? await APIClient.shared.getMeeting(id: self.meeting.id),
                   !m.rollingSnapshot.isEmpty {
                    self.rollingSnapshot = m.rollingSnapshot
                }
            }
        }
    }

    func endMeeting(emailTo: String) async -> Meeting? {
        elapsedTimer?.invalidate(); elapsedTimer = nil
        summaryTimer?.invalidate(); summaryTimer = nil
        isRecording = false
        if let lastURL = await chunker.stop() {
            _ = try? await APIClient.shared.sendChunk(meetingId: meeting.id, audioURL: lastURL)
        }
        return try? await APIClient.shared.endMeeting(meetingId: meeting.id, emailTo: emailTo)
    }
}

// MARK: – View

struct ActiveMeetingView: View {
    // Owned by HomeView — survives back navigation
    let model: ActiveMeetingModel
    var onEnded: ((Meeting) -> Void)?

    @AppStorage("userEmail") private var userEmail = ""
    @AppStorage("glassOpacity") private var glassOpacity = 0.85
    @State private var showEnd = false
    @State private var ending = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack(alignment: .bottom) {
            Color(.systemBackground).ignoresSafeArea()

            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        statusBar
                            .padding(.horizontal, 20)
                            .padding(.top, 12)
                            .padding(.bottom, 16)

                        if model.meeting.rawTranscript.isEmpty {
                            Text("Start speaking — transcript will appear here.")
                                .font(.system(size: 15))
                                .foregroundStyle(.tertiary)
                                .padding(.horizontal, 20)
                        } else {
                            Text(model.meeting.rawTranscript)
                                .font(.system(size: 15))
                                .lineSpacing(4)
                                .foregroundStyle(.primary)
                                .padding(.horizontal, 20)
                                .id("transcript")
                                .onChange(of: model.meeting.rawTranscript) {
                                    withAnimation { proxy.scrollTo("transcript", anchor: .bottom) }
                                }
                        }

                        if let err = model.errorMessage {
                            Text(err)
                                .font(.caption)
                                .foregroundStyle(.red)
                                .padding(.horizontal, 20)
                                .padding(.top, 8)
                        }

                        Spacer().frame(height: 260)
                    }
                }
            }

            VStack(spacing: 10) {
                FloatingSummaryCard(snapshot: model.rollingSnapshot)
                endButton
                    .padding(.horizontal, 16)
                    .padding(.bottom, 20)
            }
        }
        .navigationTitle(model.meeting.displayTitle)
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(false)
        .task { await model.startIfNeeded() }
        .alert("End Meeting?", isPresented: $showEnd) {
            Button("End & Send Summary", role: .destructive) {
                Task {
                    ending = true
                    let ended = await model.endMeeting(emailTo: userEmail)
                    onEnded?(ended ?? model.meeting)
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text(userEmail.isEmpty
                 ? "Meeting will be saved. Add your email in Settings to receive a summary."
                 : "Summary will be emailed to \(userEmail).")
        }
    }

    // MARK: Subviews

    private var statusBar: some View {
        HStack(spacing: 10) {
            HStack(spacing: 6) {
                Circle()
                    .fill(.red)
                    .frame(width: 7, height: 7)
                    .opacity(model.isRecording ? 1 : 0.3)
                    .animation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true),
                               value: model.isRecording)
                Text(model.isRecording ? "Recording" : "Starting…")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.secondary)
            }

            if model.isProcessing {
                HStack(spacing: 4) {
                    ProgressView().scaleEffect(0.65)
                    Text("Transcribing")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
            }

            Spacer()

            Text(formatTime(model.elapsed))
                .font(.system(size: 14, weight: .semibold, design: .monospaced))
                .foregroundStyle(.secondary)
        }
    }

    private var endButton: some View {
        Button {
            showEnd = true
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "stop.circle.fill")
                Text(ending ? "Ending…" : "End Meeting")
                    .fontWeight(.semibold)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(.red.opacity(ending ? 0.5 : 0.9))
                    .shadow(color: .red.opacity(0.3), radius: 12, x: 0, y: 5)
            )
        }
        .disabled(ending)
        .buttonStyle(.plain)
    }

    private func formatTime(_ s: Int) -> String {
        String(format: "%02d:%02d", s / 60, s % 60)
    }
}
