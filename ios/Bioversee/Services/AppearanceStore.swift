import Foundation
import Supabase
import SwiftUI
import UIKit

/// Website accent presets (UI tint only — not editable on iOS).
struct AccentPreset: Identifiable, Hashable {
    let id: String
    let label: String
    let hex: String

    static let all: [AccentPreset] = [
        .init(id: "green", label: "Green", hex: "#0d9488"),
        .init(id: "yellow", label: "Yellow", hex: "#ffe15d"),
        .init(id: "red", label: "Red", hex: "#ff6b6b"),
        .init(id: "blue", label: "Blue", hex: "#5b9fff"),
    ]

    static let `default` = all[0]

    static func nearest(to hex: String) -> AccentPreset {
        let target = ColorHex.parse(hex) ?? ColorHex.parse(Self.default.hex)!
        return all.min(by: {
            ColorHex.distance($0.hex, target) < ColorHex.distance($1.hex, target)
        }) ?? .default
    }
}

/// Home-screen icon choices (device-local, independent of website accent).
struct AppIconOption: Identifiable, Hashable {
    let id: String
    let label: String
    /// `nil` = primary AppIcon.
    let alternateIconName: String?
    let previewImageName: String

    static let all: [AppIconOption] = [
        .init(id: "green", label: "Green", alternateIconName: nil, previewImageName: "IconPreviewGreen"),
        .init(id: "yellow", label: "Yellow", alternateIconName: "AppIconYellow", previewImageName: "IconPreviewYellow"),
        .init(id: "red", label: "Red", alternateIconName: "AppIconRed", previewImageName: "IconPreviewRed"),
        .init(id: "blue", label: "Blue", alternateIconName: "AppIconBlue", previewImageName: "IconPreviewBlue"),
    ]

    static let `default` = all[0]

    static func matching(alternateIconName: String?) -> AppIconOption {
        all.first { $0.alternateIconName == alternateIconName } ?? .default
    }
}

@MainActor
final class AppearanceStore: ObservableObject {
    static let shared = AppearanceStore()

    private static let iconPreferenceKey = "bv.appIcon.id"
    private static let autoHideTabBarKey = "bv.autoHideTabBar"

    /// UI accent from website `user_settings` — read-only on iOS.
    @Published private(set) var accentHex: String = AccentPreset.default.hex
    /// Selected home-screen icon (local preference).
    @Published private(set) var selectedIconId: String = AppIconOption.default.id
    /// Hide the floating tab bar while scrolling down (default on).
    @Published private(set) var autoHideTabBar: Bool = true

    var accentColor: Color { ColorHex.color(accentHex) }
    var accentMuted: Color { accentColor.opacity(0.18) }
    var accentSoft: Color { accentColor.opacity(0.08) }
    var accentBorder: Color { accentColor.opacity(0.42) }

    var selectedIcon: AppIconOption {
        AppIconOption.all.first { $0.id == selectedIconId } ?? .default
    }

    private init() {
        if let saved = UserDefaults.standard.string(forKey: Self.iconPreferenceKey),
           AppIconOption.all.contains(where: { $0.id == saved })
        {
            selectedIconId = saved
        } else {
            selectedIconId = AppIconOption.matching(
                alternateIconName: UIApplication.shared.alternateIconName
            ).id
        }

        if UserDefaults.standard.object(forKey: Self.autoHideTabBarKey) == nil {
            autoHideTabBar = true
        } else {
            autoHideTabBar = UserDefaults.standard.bool(forKey: Self.autoHideTabBarKey)
        }
    }

    func loadFromCloud(userId: UUID?) async {
        guard let userId else {
            accentHex = AccentPreset.default.hex
            return
        }

        do {
            struct Row: Decodable {
                let preferences: PreferencesJSON?
            }
            struct PreferencesJSON: Decodable {
                let accent: String?
            }

            let rows: [Row] = try await SupabaseManager.client
                .from("user_settings")
                .select("preferences")
                .eq("user_id", value: userId.uuidString)
                .limit(1)
                .execute()
                .value

            if let accent = rows.first?.preferences?.accent,
               ColorHex.isValid(accent)
            {
                accentHex = ColorHex.normalize(accent)
            } else {
                accentHex = AccentPreset.default.hex
            }
        } catch {
            print("[appearance] load failed:", error.localizedDescription)
        }
    }

    /// Changes the home-screen icon only. UI accent stays tied to the website.
    func setAppIcon(_ option: AppIconOption) {
        selectedIconId = option.id
        UserDefaults.standard.set(option.id, forKey: Self.iconPreferenceKey)

        guard UIApplication.shared.supportsAlternateIcons else { return }
        let target = option.alternateIconName
        guard UIApplication.shared.alternateIconName != target else { return }
        UIApplication.shared.setAlternateIconName(target) { error in
            if let error {
                print("[appearance] icon change failed:", error.localizedDescription)
            }
        }
    }

    func setAutoHideTabBar(_ enabled: Bool) {
        autoHideTabBar = enabled
        UserDefaults.standard.set(enabled, forKey: Self.autoHideTabBarKey)
        if !enabled {
            TabBarChrome.shared.reset()
        }
    }
}

enum ColorHex {
    static func isValid(_ value: String) -> Bool {
        let raw = value.hasPrefix("#") ? String(value.dropFirst()) : value
        return raw.count == 6 && raw.allSatisfy(\.isHexDigit)
    }

    static func normalize(_ value: String) -> String {
        let raw = value.hasPrefix("#") ? String(value.dropFirst()) : value
        return "#\(raw.lowercased())"
    }

    static func parse(_ hex: String) -> (r: Double, g: Double, b: Double)? {
        let raw = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard raw.count == 6, let n = UInt64(raw, radix: 16) else { return nil }
        return (
            Double((n >> 16) & 0xff) / 255,
            Double((n >> 8) & 0xff) / 255,
            Double(n & 0xff) / 255
        )
    }

    static func color(_ hex: String) -> Color {
        guard let rgb = parse(hex) else {
            return Color(red: 0.051, green: 0.580, blue: 0.533)
        }
        return Color(red: rgb.r, green: rgb.g, blue: rgb.b)
    }

    static func distance(_ hex: String, _ target: (r: Double, g: Double, b: Double)) -> Double {
        guard let a = parse(hex) else { return .greatestFiniteMagnitude }
        let dr = a.r - target.r
        let dg = a.g - target.g
        let db = a.b - target.b
        return dr * dr + dg * dg + db * db
    }
}
