import SwiftUI

@main
struct BioverseeApp: App {
    @StateObject private var session = AppSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .tint(Color(red: 0.05, green: 0.58, blue: 0.53))
                .onOpenURL { url in
                    Task { await session.handleIncomingURL(url) }
                }
        }
    }
}
