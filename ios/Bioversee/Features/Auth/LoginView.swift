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
                    HStack {
                        Spacer()
                        VStack(spacing: 12) {
                            Image("BioverseeLogo")
                                .resizable()
                                .scaledToFit()
                                .frame(width: 88, height: 88)
                                .foregroundStyle(Color.accentColor)
                            Text("Bioversee")
                                .font(.title2.weight(.semibold))
                            Text("Same account as the web app.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .padding(.vertical, 8)
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                }

                Section {
                    Button {
                        Task { await signInWithGoogle() }
                    } label: {
                        HStack {
                            Image(systemName: "g.circle.fill")
                            if busy {
                                ProgressView()
                            } else {
                                Text("Continue with Google")
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .disabled(busy)
                }

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
                        .textContentType(.username)

                    SecureField("Password", text: $password)
                        .textContentType(mode == .signIn ? .password : .newPassword)
                } header: {
                    Text("Or use email")
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
            .navigationBarTitleDisplayMode(.inline)
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

    private func signInWithGoogle() async {
        busy = true
        defer { busy = false }
        infoMessage = nil
        await session.signInWithGoogle()
    }
}
