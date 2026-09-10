import Foundation
import Supabase

enum SupabaseManager {
    static let client = SupabaseClient(
        supabaseURL: AppConfig.supabaseURL,
        supabaseKey: AppConfig.supabaseAnonKey,
        options: .init(
            auth: .init(
                // Persist in Keychain by default; refresh tokens keep users signed in.
                // (Unlike the web app, there is no 7-day local session max age on iOS.)
                redirectToURL: AppConfig.oauthRedirectURL,
                autoRefreshToken: true,
                emitLocalSessionAsInitialSession: true
            )
        )
    )
}
