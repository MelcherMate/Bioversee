import SwiftUI

@main
struct BioverseeApp: App {
    @StateObject private var session = AppSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(session)
                .tint(BVTheme.accent)
                .preferredColorScheme(.light)
                .onOpenURL { url in
                    Task { await session.handleIncomingURL(url) }
                }
        }
    }
}
