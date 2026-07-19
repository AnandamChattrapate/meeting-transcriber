import SwiftUI

struct SettingsView: View {
    @AppStorage("userEmail") private var userEmail = ""
    @AppStorage("serverURL") private var serverURL = "http://localhost:5050"
    @AppStorage("glassOpacity") private var glassOpacity = 0.85
    @AppStorage("windowOpacity") private var windowOpacity = 1.0
    @State private var connStatus: ConnStatus = .idle
    @State private var saved = false

    enum ConnStatus {
        case idle, testing, ok, fail(String)
        var color: Color {
            switch self {
            case .idle, .testing: return .blue
            case .ok: return .green
            case .fail: return .red
            }
        }
        var label: String {
            switch self {
            case .idle: return "Test Connection"
            case .testing: return "Testing…"
            case .ok: return "Connected!"
            case .fail(let msg): return msg
            }
        }
        var icon: String {
            switch self {
            case .idle: return "wifi"
            case .testing: return "ellipsis.circle"
            case .ok: return "checkmark.circle.fill"
            case .fail: return "xmark.circle.fill"
            }
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                // Email
                SettingsCard(title: "Email", icon: "envelope.fill", color: .purple) {
                    VStack(alignment: .leading, spacing: 10) {
                        TextField("your@email.com", text: $userEmail)
                            .autocorrectionDisabled()
                            .font(.system(size: 15))
                        Text("Meeting summaries are sent here when you end a meeting.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                // Server
                SettingsCard(title: "Server URL", icon: "server.rack", color: .blue) {
                    VStack(alignment: .leading, spacing: 12) {
                        TextField("https://your-app.onrender.com", text: $serverURL)
                            .autocorrectionDisabled()
                            .font(.system(size: 14, design: .monospaced))

                        Button {
                            Task { await testConnection() }
                        } label: {
                            HStack(spacing: 6) {
                                Image(systemName: connStatus.icon)
                                Text(connStatus.label)
                                    .fontWeight(.medium)
                            }
                            .font(.system(size: 13))
                            .foregroundStyle(connStatus.color)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Capsule().fill(connStatus.color.opacity(0.12)))
                        }
                        .buttonStyle(.plain)
                        .animation(.easeInOut(duration: 0.2), value: connStatus.label)

                        Text("Use http://localhost:5050 while your local server is running, or your Render URL for production. Make sure your server is started before testing.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                // Glass card transparency
                SettingsCard(title: "Card Transparency", icon: "square.on.square.dashed", color: .teal) {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 10) {
                            Image(systemName: "circle.dotted")
                                .font(.system(size: 14))
                                .foregroundStyle(.secondary)
                            Slider(value: $glassOpacity, in: 0...1, step: 0.05)
                                .tint(.teal)
                            Image(systemName: "square.fill")
                                .font(.system(size: 14))
                                .foregroundStyle(.secondary)
                        }
                        Text("\(Int(glassOpacity * 100))% — controls how solid the glass cards look inside the app")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }

                // Window transparency
                SettingsCard(title: "Window Transparency", icon: "macwindow", color: .indigo) {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 10) {
                            Image(systemName: "eye.slash")
                                .font(.system(size: 14))
                                .foregroundStyle(.secondary)
                            Slider(value: $windowOpacity, in: 0.2...1.0, step: 0.05)
                                .tint(.indigo)
                            Image(systemName: "eye")
                                .font(.system(size: 14))
                                .foregroundStyle(.secondary)
                        }
                        Text("\(Int(windowOpacity * 100))% — see through to apps and desktop behind this window")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        if windowOpacity < 0.6 {
                            Label("Very transparent — may be hard to read", systemImage: "exclamationmark.triangle")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }
                    }
                }

                // Save
                Button { save() } label: {
                    Text(saved ? "Saved ✓" : "Save Settings")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 15)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(saved ? Color.green : Color.purple)
                                .shadow(color: (saved ? Color.green : Color.purple).opacity(0.3), radius: 10, x: 0, y: 5)
                        )
                }
                .buttonStyle(.plain)
                .animation(.spring(duration: 0.3), value: saved)
            }
            .padding(16)
        }
        .background(Color.secondary.opacity(0.07).ignoresSafeArea())
        .navigationTitle("Settings")
    }

    private func save() {
        UserDefaults.standard.set(serverURL, forKey: "serverURL")
        UserDefaults.standard.set(glassOpacity, forKey: "glassOpacity")
        UserDefaults.standard.set(windowOpacity, forKey: "windowOpacity")
        withAnimation { saved = true }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation { saved = false }
        }
    }

    private func testConnection() async {
        connStatus = .testing
        let clean = serverURL.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(clean)/api/meetings") else {
            connStatus = .fail("Invalid URL"); return
        }
        var req = URLRequest(url: url, timeoutInterval: 6)
        req.httpMethod = "GET"
        do {
            let (_, resp) = try await URLSession.shared.data(for: req)
            if let http = resp as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                connStatus = .ok
            } else {
                connStatus = .fail("Server error — check URL")
            }
        } catch {
            let msg = error.localizedDescription.count > 40 ? "Can't reach server — is it running?" : error.localizedDescription
            connStatus = .fail(msg)
        }
        try? await Task.sleep(nanoseconds: 4_000_000_000)
        connStatus = .idle
    }
}

struct SettingsCard<Content: View>: View {
    let title: String
    let icon: String
    let color: Color
    @ViewBuilder let content: Content
    @AppStorage("glassOpacity") private var glassOpacity = 0.85

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 10) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .fill(color.gradient)
                        .frame(width: 32, height: 32)
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(.white)
                }
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .glassCard(opacity: glassOpacity, cornerRadius: 18)
    }
}
