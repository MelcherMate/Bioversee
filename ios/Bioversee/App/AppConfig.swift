import Foundation

enum AppConfig {
    /// Same project as `client-react-ts/.env.development`.
    static let supabaseURL = URL(string: "https://duietzxmkepkfqztfrme.supabase.co")!
    static let supabaseAnonKey = "sb_publishable_aWXEFMXUrGdrWi2Ys8ClkQ_IpQ8wes2"

    /// Must match `CFBundleURLSchemes` in Info.plist and be listed under
    /// Supabase Dashboard → Authentication → URL Configuration → Additional Redirect URLs.
    static let oauthRedirectURL = URL(string: "com.bioversee.app://login-callback")!
    static let oauthCallbackScheme = "com.bioversee.app"
}
