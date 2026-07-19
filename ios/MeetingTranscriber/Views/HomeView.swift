import SwiftUI

struct HomeView: View {
    @State private var meetings: [MeetingListItem] = []
    @State private var isLoading = true
    @State private var showNewMeeting = false
    @State private var newTitle = ""
    @State private var error: String?

    // Model lives HERE — persists when user navigates away from ActiveMeetingView
    @State private var liveModel: ActiveMeetingModel? = nil
    @State private var isInActiveMeeting = false

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                Color(.systemBackground).ignoresSafeArea()

                Group {
                    if isLoading {
                        ProgressView().tint(.purple)
                    } else if meetings.isEmpty && liveModel == nil {
                        emptyState
                    } else {
                        meetingList
                    }
                }

                // Floating badge when recording is backgrounded
                if liveModel != nil && !isInActiveMeeting {
                    recordingBadge
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .zIndex(10)
                }
            }
            .navigationTitle("Meetings")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink(destination: SettingsView()) {
                        Image(systemName: "gearshape.fill").foregroundStyle(.secondary)
                    }
                }
                ToolbarItem(placement: .bottomBar) { bottomButton }
            }
            .navigationDestination(isPresented: $isInActiveMeeting) {
                if let model = liveModel {
                    ActiveMeetingView(model: model) { _ in
                        liveModel = nil
                        isInActiveMeeting = false
                        Task { await loadMeetings() }
                    }
                }
            }
            .navigationDestination(for: String.self) { id in
                MeetingDetailView(meetingId: id)
            }
            .alert("New Meeting", isPresented: $showNewMeeting) {
                TextField("Title (optional)", text: $newTitle)
                Button("Start Recording") { Task { await startMeeting() } }
                Button("Cancel", role: .cancel) { newTitle = "" }
            } message: {
                Text("Give your meeting a name, or leave blank.")
            }
            .alert("Error", isPresented: .constant(error != nil)) {
                Button("OK") { error = nil }
            } message: { Text(error ?? "") }
            .task { await loadMeetings() }
            .animation(.spring(duration: 0.35), value: liveModel != nil)
            .animation(.spring(duration: 0.35), value: isInActiveMeeting)
        }
    }

    // MARK: – Subviews

    private var emptyState: some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .fill(Color.purple.opacity(0.1))
                    .frame(width: 88, height: 88)
                Image(systemName: "mic.circle.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(.purple.opacity(0.55))
            }
            VStack(spacing: 6) {
                Text("No meetings yet")
                    .font(.title3.weight(.semibold))
                Text("Tap Start Meeting to begin recording")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(40)
    }

    private var meetingList: some View {
        ScrollView {
            LazyVStack(spacing: 10) {
                ForEach(meetings) { item in
                    NavigationLink(value: item.id) {
                        MeetingRow(item: item)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
    }

    private var recordingBadge: some View {
        Button { withAnimation { isInActiveMeeting = true } } label: {
            HStack(spacing: 12) {
                Circle()
                    .fill(.red)
                    .frame(width: 8, height: 8)
                Text("Recording in progress — tap to return")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(.white)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.white.opacity(0.7))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(.red.opacity(0.9))
                    .shadow(color: .red.opacity(0.35), radius: 14, x: 0, y: 6)
            )
            .padding(.horizontal, 16)
            .padding(.bottom, 16)
        }
        .buttonStyle(.plain)
    }

    private var bottomButton: some View {
        Button {
            if liveModel != nil { isInActiveMeeting = true }
            else { showNewMeeting = true }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "mic.fill")
                    .foregroundStyle(liveModel != nil ? .red : .white)
                Text(liveModel != nil ? "Return to Recording" : "Start Meeting")
                    .fontWeight(.semibold)
            }
            .foregroundStyle(liveModel != nil ? .red : .white)
            .padding(.horizontal, 26)
            .padding(.vertical, 13)
            .background(
                Capsule()
                    .fill(liveModel != nil ? Color.red.opacity(0.12) : Color.purple)
                    .shadow(color: (liveModel != nil ? Color.red : Color.purple).opacity(0.3),
                            radius: 12, x: 0, y: 5)
            )
        }
    }

    // MARK: – Actions

    private func loadMeetings() async {
        isLoading = true
        meetings = (try? await APIClient.shared.listMeetings()) ?? []
        isLoading = false
    }

    private func startMeeting() async {
        let title = newTitle.trimmingCharacters(in: .whitespaces)
        newTitle = ""
        do {
            let meeting = try await APIClient.shared.startMeeting(title: title)
            liveModel = ActiveMeetingModel(meeting: meeting)
            isInActiveMeeting = true
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: – Meeting Row

struct MeetingRow: View {
    let item: MeetingListItem
    @AppStorage("glassOpacity") private var glassOpacity = 0.85

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(item.status == .active ? Color.red.opacity(0.12) : Color.purple.opacity(0.1))
                    .frame(width: 48, height: 48)
                Image(systemName: item.status == .active ? "mic.fill" : "waveform")
                    .font(.system(size: 18))
                    .foregroundStyle(item.status == .active ? .red : .purple)
            }

            VStack(alignment: .leading, spacing: 3) {
                Text(item.displayTitle)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.primary)
                Text(item.startedAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if item.status == .active {
                Text("LIVE")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.red)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(.red.opacity(0.1)))
            } else {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .glassCard(opacity: glassOpacity, cornerRadius: 16)
    }
}
