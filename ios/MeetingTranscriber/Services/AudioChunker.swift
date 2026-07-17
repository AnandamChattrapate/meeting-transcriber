import AVFoundation

@MainActor
class AudioChunker: NSObject, ObservableObject {
    @Published var isRecording = false
    @Published var elapsedSeconds = 0

    var onChunkReady: ((URL) async -> Void)?

    private var recorder: AVAudioRecorder?
    private var chunkTimer: Timer?
    private var elapsedTimer: Timer?
    private var currentChunkURL: URL?
    private let chunkDuration: TimeInterval = 30

    func start() async throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.record, mode: .default, options: [.allowBluetooth])
        try session.setActive(true)

        isRecording = true
        elapsedSeconds = 0

        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.elapsedSeconds += 1 }
        }

        startNewChunk()

        chunkTimer = Timer.scheduledTimer(withTimeInterval: chunkDuration, repeats: true) { [weak self] _ in
            Task { @MainActor in self?.rotateChunk() }
        }
    }

    func stop() async -> URL? {
        chunkTimer?.invalidate(); chunkTimer = nil
        elapsedTimer?.invalidate(); elapsedTimer = nil
        isRecording = false
        let url = currentChunkURL
        recorder?.stop(); recorder = nil
        try? AVAudioSession.sharedInstance().setActive(false)
        return url
    }

    private func startNewChunk() {
        let url = URL.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).m4a")
        currentChunkURL = url
        let settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC,
            AVSampleRateKey: 16000,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
        ]
        recorder = try? AVAudioRecorder(url: url, settings: settings)
        recorder?.record()
    }

    private func rotateChunk() {
        guard let finishedURL = currentChunkURL else { return }
        recorder?.stop(); recorder = nil
        let callback = onChunkReady
        Task { await callback?(finishedURL) }
        startNewChunk()
    }
}
