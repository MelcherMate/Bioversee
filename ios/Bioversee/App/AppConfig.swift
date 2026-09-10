import Foundation

enum AppConfig {
    /// Same project as `client-react-ts/.env.development`.
    static let supabaseURL = URL(string: "https://duietzxmkepkfqztfrme.supabase.co")!
    static let supabaseAnonKey = "sb_publishable_aWXEFMXUrGdrWi2Ys8ClkQ_IpQ8wes2"

    /// Deep link back into the native app (Info.plist URL scheme).
    static let oauthRedirectURL = URL(string: "com.bioversee.app://login-callback")!
    static let oauthCallbackScheme = "com.bioversee.app"

    /// HTTPS bridge page on the website. Supabase redirects here first (allowlisted
    /// like other web URLs), then the page deep-links into `oauthRedirectURL`.
    static let oauthBridgeURL = URL(string: "https://bioversee.com/ios-auth")!
}
