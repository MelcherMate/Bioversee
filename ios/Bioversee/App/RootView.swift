import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        Group {
            if session.isBootstrapping {
                ProgressView("Loading Bioversee…")
            } else if session.isSignedIn {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: session.isSignedIn)
    }
}

struct MainTabView: View {
    var body: some View {
        TabView {
            DeviceListView()
                .tabItem {
                    Label("Devices", systemImage: "cpu")
                }

            NotificationsView()
                .tabItem {
                    Label("Inbox", systemImage: "bell")
                }

            AccountView()
                .tabItem {
                    Label("Account", systemImage: "person.crop.circle")
                }
        }
    }
}

struct AccountView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 14) {
                        Image("BioverseeLogo")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 44, height: 44)
                            .foregroundStyle(Color.accentColor)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Bioversee")
                                .font(.headline)
                            Text(session.userEmail ?? "Account")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section {
                    Button("Log out", role: .destructive) {
                        Task { await session.signOut() }
                    }
                } footer: {
                    Text("Controls and notifications share the same cloud account as the web app. Charts stay on the web.")
                }
            }
            .navigationTitle("Account")
        }
    }
}
