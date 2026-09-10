import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: AppSession

    @State private var mode: Mode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var infoMessage: String?

    private enum Mode: String, CaseIterable {
        case signIn = "Sign in"
        case signUp = "Sign up"
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Mode", selection: $mode) {
                        ForEach(Mode.allCases, id: \.self) { item in
                            Text(item.rawValue).tag(item)
                        }
                    }
                    .pickerStyle(.segmented)

                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .autocorrectionDisabled()

                    SecureField("Password", text: $password)
                } header: {
                    Text("Bioversee")
                } footer: {
                    Text("Sign in with the same account you use on the web app.")
                }

                if let infoMessage {
                    Section {
                        Text(infoMessage)
                            .foregroundStyle(.secondary)
                    }
                }

                if let error = session.errorMessage {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button {
                        Task { await submit() }
                    } label: {
                        if busy {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text(mode == .signIn ? "Sign in" : "Create account")
                                .frame(maxWidth: .infinity)
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(busy || email.isEmpty || password.count < 6)
                }
            }
            .navigationTitle("Welcome")
        }
    }

    private func submit() async {
        busy = true
        defer { busy = false }
        infoMessage = nil

        switch mode {
        case .signIn:
            await session.signIn(email: email, password: password)
        case .signUp:
            infoMessage = await session.signUp(email: email, password: password)
        }
    }
}
