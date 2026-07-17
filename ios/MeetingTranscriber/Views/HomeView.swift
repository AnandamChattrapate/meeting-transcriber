import SwiftUI

struct HomeView: View {
    @State private var meetings: [MeetingListItem] = []
    @State private var isLoading = true
    @State private var showNewMeeting = false
    @State private var newTitle = ""
    @State private var activeMeeting: Meeting?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ZStack {
                // Apple-style gradient background
                LinearGradient(
                    colors: [Color.purple.opacity(0.07), Color.indigo.opacity(0.04), Color(.systemBackground)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                Group {
                    if isLoading {
                        ProgressView()
                    } else if meetings.isEmpty {
                        VStack(spacing: 16) {
                            Image(systemName: "mic.circle.fill")
                                .font(.system(size: 60))
                                .foregroundStyle(.purple.opacity(0.35))
                            Text("No meetings yet")
                                .font(.title3.weight(.semibold))
                            Text("Tap Start Meeting to begin recording")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(40)
                    } else {
                        List(meetings) { item in
                            NavigationLink(value: item.id) {
                                MeetingRow(item: item)
                            }
                            .listRowBackground(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .fill(.ultraThinMaterial)
                                    .padding(.vertical, 2)
                            )
                            .listRowSeparator(.hidden)
                        }
                        .listStyle(.insetGrouped)
                        .scrollContentBackground(.hidden)
                    }
                }
            }
            .navigationTitle("Meetings")
            .navigationDestination(for: String.self) { id in
                MeetingDetailView(meetingId: id)
            }
            .navigationDestination(item: $activeMeeting) { meeting in
                ActiveMeetingView(model: ActiveMeetingModel(meeting: meeting)) { ended in
                    activeMeeting = nil
                    Task { await loadMeetings() }
                }
            }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink(destination: SettingsView()) {
                        Image(systemName: "gearshape.fill")
                            .foregroundStyle(.secondary)
                    }
                }
                ToolbarItem(placement: .bottomBar) {
                    Button {
                        showNewMeeting = true
                    } label: {
                        HStack(spacing: 8) {
                            Image(systemName: "mic.fill")
                            Text("Start Meeting")
                                .fontWeight(.semibold)
                        }
                        .foregroundStyle(.white)
                        .padding(.horizontal, 28)
                        .padding(.vertical, 13)
                        .background(Capsule().fill(Color.purple)
                            .shadow(color: .purple.opacity(0.35), radius: 12, x: 0, y: 6))
                    }
                }
            }
            .alert("New Meeting", isPresented: $showNewMeeting) {
                TextField("Title (optional)", text: $newTitle)
                Button("Start Recording") { Task { await startMeeting() } }
                Button("Cancel", role: .cancel) { newTitle = "" }
            } message: {
                Text("Give this meeting a title, or leave blank.")
            }
            .alert("Error", isPresented: .constant(error != nil)) {
                Button("OK") { error = nil }
            } message: { Text(error ?? "") }
            .task { await loadMeetings() }
        }
    }

    private func loadMeetings() async {
        isLoading = true
        meetings = (try? await APIClient.shared.listMeetings()) ?? []
        isLoading = false
    }

    private func startMeeting() async {
        let title = newTitle.trimmingCharacters(in: .whitespaces)
        newTitle = ""
        do {
            activeMeeting = try await APIClient.shared.startMeeting(title: title)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct MeetingRow: View {
    let item: MeetingListItem

    var body: some View {
        HStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(item.status == .active ? Color.red.opacity(0.12) : Color.purple.opacity(0.1))
                    .frame(width: 46, height: 46)
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
            }
        }
        .padding(.vertical, 6)
    }
}
