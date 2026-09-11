import Foundation
import Supabase
import SwiftUI

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

@MainActor
final class AppearanceStore: ObservableObject {
    static let shared = AppearanceStore()

    @Published private(set) var accentHex: String = AccentPreset.default.hex

    var accentColor: Color { ColorHex.color(accentHex) }
    var accentMuted: Color { accentColor.opacity(0.18) }
    var accentSoft: Color { accentColor.opacity(0.08) }
    var accentBorder: Color { accentColor.opacity(0.42) }

    var selectedPreset: AccentPreset { AccentPreset.nearest(to: accentHex) }

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
            // Keep current accent on transient errors.
            print("[appearance] load failed:", error.localizedDescription)
        }
    }

    func setAccent(_ hex: String, userId: UUID?) async {
        let normalized = ColorHex.normalize(hex)
        accentHex = normalized
        guard let userId else { return }
        await persistAccent(normalized, userId: userId)
    }

    func setPreset(_ preset: AccentPreset, userId: UUID?) async {
        await setAccent(preset.hex, userId: userId)
    }

    private func persistAccent(_ hex: String, userId: UUID) async {
        do {
            struct PrefsRow: Decodable {
                let preferences: [String: AnyJSON]?
            }

            let existing: [PrefsRow] = try await SupabaseManager.client
                .from("user_settings")
                .select("preferences")
                .eq("user_id", value: userId.uuidString)
                .limit(1)
                .execute()
                .value

            var prefs: [String: AnyJSON] = existing.first?.preferences ?? [:]
            prefs["accent"] = .string(hex)

            struct Upsert: Encodable {
                let userId: UUID
                let preferences: [String: AnyJSON]
                let updatedAt: String

                enum CodingKeys: String, CodingKey {
                    case userId = "user_id"
                    case preferences
                    case updatedAt = "updated_at"
                }
            }

            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

            try await SupabaseManager.client
                .from("user_settings")
                .upsert(
                    Upsert(
                        userId: userId,
                        preferences: prefs,
                        updatedAt: formatter.string(from: Date())
                    ),
                    onConflict: "user_id"
                )
                .execute()
        } catch {
            print("[appearance] save failed:", error.localizedDescription)
        }
    }
}

// MARK: - JSON helpers for preferences merge

enum AnyJSON: Codable, Hashable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: AnyJSON])
    case array([AnyJSON])
    case null

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: AnyJSON].self) {
            self = .object(value)
        } else if let value = try? container.decode([AnyJSON].self) {
            self = .array(value)
        } else {
            self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
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
