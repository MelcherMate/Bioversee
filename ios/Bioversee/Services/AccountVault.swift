import Foundation
import Security
import Supabase

/// Gmail-style multi-account vault (Keychain). No 7-day expiry — sessions stay until log out.
struct VaultAccount: Codable, Identifiable, Hashable {
    var id: UUID
    var email: String?
    var displayName: String
    var avatarURL: String?
    var accessToken: String
    var refreshToken: String
    var expiresAt: TimeInterval?
    var updatedAt: TimeInterval

    var avatarURLValue: URL? {
        guard let avatarURL, let url = URL(string: avatarURL) else { return nil }
        return url
    }
}

enum AccountVault {
    private static let service = "com.bioversee.app.account-vault"
    private static let account = "vault.v1"

    static func load() -> [VaultAccount] {
        guard let data = readKeychain() else { return [] }
        return (try? JSONDecoder().decode([VaultAccount].self, from: data)) ?? []
    }

    static func save(_ accounts: [VaultAccount]) {
        guard let data = try? JSONEncoder().encode(accounts) else { return }
        writeKeychain(data)
    }

    static func upsert(from session: Session) -> [VaultAccount] {
        let user = session.user
        let meta = user.userMetadata
        let fullName =
            meta["full_name"]?.stringValue
            ?? meta["name"]?.stringValue
            ?? user.email?.split(separator: "@").first.map(String.init)
            ?? "Account"
        let avatar =
            meta["avatar_url"]?.stringValue
            ?? meta["picture"]?.stringValue

        var accounts = load().filter { $0.id != user.id }
        accounts.insert(
            VaultAccount(
                id: user.id,
                email: user.email,
                displayName: fullName,
                avatarURL: avatar,
                accessToken: session.accessToken,
                refreshToken: session.refreshToken,
                expiresAt: session.expiresAt,
                updatedAt: Date().timeIntervalSince1970
            ),
            at: 0
        )
        save(accounts)
        return accounts
    }

    static func updateTokens(for userId: UUID, session: Session) {
        var accounts = load()
        guard let idx = accounts.firstIndex(where: { $0.id == userId }) else { return }
        accounts[idx].accessToken = session.accessToken
        accounts[idx].refreshToken = session.refreshToken
        accounts[idx].expiresAt = session.expiresAt
        accounts[idx].updatedAt = Date().timeIntervalSince1970
        save(accounts)
    }

    static func remove(_ userId: UUID) -> [VaultAccount] {
        let next = load().filter { $0.id != userId }
        save(next)
        return next
    }

    static func clear() {
        save([])
        deleteKeychain()
    }

    // MARK: - Keychain

    private static func readKeychain() -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        guard status == errSecSuccess else { return nil }
        return item as? Data
    }

    private static func writeKeychain(_ data: Data) {
        deleteKeychain()
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    private static func deleteKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
