import SwiftUI

struct SettingsView: View {
    @AppStorage("userEmail") private var userEmail = ""
    @AppStorage("serverURL") private var serverURL = "http://localhost:5050"
    @State private var saved = false

    var body: some View {
        Form {
            Section {
                TextField("your@email.com", text: $userEmail)
                    .keyboardType(.emailAddress)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
            } header: {
                Text("Email")
            } footer: {
                Text("Meeting summaries are sent here when you end a meeting.")
            }

            Section {
                TextField("https://your-app.onrender.com", text: $serverURL)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
            } header: {
                Text("Server URL")
            } footer: {
                Text("Your Render deployment URL. Use http://localhost:5050 for local development.")
            }

            Section {
                Button {
                    UserDefaults.standard.set(serverURL, forKey: "serverURL")
                    saved = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { saved = false }
                } label: {
                    Text(saved ? "Saved ✓" : "Save")
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(saved ? .green : .purple)
                        .fontWeight(.semibold)
                }
            }
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
    }
}
