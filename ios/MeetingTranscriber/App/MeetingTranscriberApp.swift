import SwiftUI

@main
struct MeetingTranscriberApp: App {
    @AppStorage("windowOpacity") private var windowOpacity = 1.0

    init() {
        // Wake the Render dyno early so it's warm by the time user starts a meeting
        APIClient.shared.warmUp()
    }

    var body: some Scene {
        WindowGroup {
            HomeView()
                .onAppear { applyWindowOpacity(windowOpacity) }
                .onChange(of: windowOpacity) { _, v in applyWindowOpacity(v) }
        }
    }

    private func applyWindowOpacity(_ opacity: Double) {
        DispatchQueue.main.async {
            UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap { $0.windows }
                .forEach { w in
                    w.backgroundColor = opacity < 0.99 ? .clear : nil
                    w.alpha = CGFloat(opacity)
                }
        }
    }
}
