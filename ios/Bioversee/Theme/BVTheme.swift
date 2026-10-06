import SwiftUI

enum BVTheme {
    static let text = Color(red: 0.114, green: 0.114, blue: 0.122) // #1d1d1f
    static let textSecondary = Color(red: 0.431, green: 0.431, blue: 0.451) // #6e6e73
    static let textTertiary = Color(red: 0.525, green: 0.525, blue: 0.545) // #86868b
    static let surface = Color(red: 0.961, green: 0.961, blue: 0.969) // #f5f5f7
    static let surfaceElevated = Color(red: 0.984, green: 0.984, blue: 0.992) // #fbfbfd
    static let card = Color.white
    static let fill = Color(red: 0.961, green: 0.961, blue: 0.969)
    static let line = Color.black.opacity(0.08)

    /// Live accent from the signed-in user's web preference.
    @MainActor static var accent: Color { AppearanceStore.shared.accentColor }
    @MainActor static var accentMuted: Color { AppearanceStore.shared.accentMuted }
    @MainActor static var accentSoft: Color { AppearanceStore.shared.accentSoft }
    @MainActor static var accentBorder: Color { AppearanceStore.shared.accentBorder }

    static let cta = Color(red: 0.114, green: 0.114, blue: 0.122)
    static let danger = Color(red: 0.706, green: 0.137, blue: 0.094) // #b42318
    static let success = Color(red: 0.008, green: 0.478, blue: 0.282) // #027a48

    /// Matches website `--bv-radius-lg` (cards).
    static let radiusLG: CGFloat = 20
    /// Nested section panels (Mixing / Pumps / Water level) — website 14px.
    static let radiusPanel: CGFloat = 14
    /// Matches website `--bv-radius-md` (controls, inputs, inner cards).
    static let radiusMD: CGFloat = 12
    /// Floating nav chrome — website navbar 18px.
    static let radiusNav: CGFloat = 18
    /// Compact chips / badges.
    static let radiusSM: CGFloat = 8
    static let radiusXS: CGFloat = 6
}

struct BVCardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(BVTheme.card)
            .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusLG, style: .continuous))
            .shadow(color: .black.opacity(0.06), radius: 1, y: 0)
            .shadow(color: .black.opacity(0.10), radius: 18, y: 10)
    }
}

extension View {
    func bvCard() -> some View {
        modifier(BVCardModifier())
    }
}

struct BVPrimaryButton: View {
    let title: String
    var busy = false
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if busy {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text(title)
                        .font(.system(size: 15, weight: .semibold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .foregroundStyle(.white)
            .background(BVTheme.cta)
            .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
        }
        .disabled(!enabled || busy)
        .opacity(enabled ? 1 : 0.7)
        .buttonStyle(.plain)
    }
}

struct BVSecondaryButton: View {
    let title: String
    var systemImage: String? = nil
    var busy = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                if let systemImage {
                    Image(systemName: systemImage)
                        .font(.system(size: 18, weight: .semibold))
                }
                if busy {
                    ProgressView()
                } else {
                    Text(title)
                        .font(.system(size: 14, weight: .semibold))
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .foregroundStyle(BVTheme.text)
            .background(BVTheme.card)
            .overlay(
                RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous)
                    .stroke(BVTheme.line, lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
        }
        .disabled(busy)
        .buttonStyle(.plain)
    }
}

struct BVField: View {
    let label: String
    @Binding var text: String
    var isSecure = false
    var keyboard: UIKeyboardType = .default
    var contentType: UITextContentType?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(BVTheme.textSecondary)
            Group {
                if isSecure {
                    SecureField("", text: $text)
                        .textContentType(contentType)
                } else {
                    TextField("", text: $text)
                        .keyboardType(keyboard)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .textContentType(contentType)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(BVTheme.fill)
            .clipShape(RoundedRectangle(cornerRadius: BVTheme.radiusMD, style: .continuous))
            .font(.system(size: 16))
            .foregroundStyle(BVTheme.text)
        }
    }
}

struct BVSegmented<T: Hashable>: View {
    let options: [(T, String)]
    @Binding var selection: T
    @Namespace private var segmentThumb

    var body: some View {
        HStack(spacing: 4) {
            ForEach(options, id: \.0) { value, title in
                let active = selection == value
                Button {
                    withAnimation(.easeInOut(duration: 0.38)) {
                        selection = value
                    }
                } label: {
                    Text(title)
                        .font(.system(size: 13, weight: .semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .foregroundStyle(active ? BVTheme.text : BVTheme.textSecondary)
                        .background {
                            if active {
                                Capsule()
                                    .fill(BVTheme.card)
                                    .shadow(color: .black.opacity(0.08), radius: 4, y: 1)
                                    .matchedGeometryEffect(id: "segmentThumb", in: segmentThumb)
                            }
                        }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(BVTheme.fill)
        .clipShape(Capsule())
    }
}

struct BVScreenBackground: View {
    var body: some View {
        ZStack {
            BVTheme.surface
            RadialGradient(
                colors: [BVTheme.accentMuted, .clear],
                center: .top,
                startRadius: 20,
                endRadius: 420
            )
            .offset(y: -80)
        }
        .ignoresSafeArea()
    }
}

struct BVEmptyState: View {
    let title: String
    let systemImage: String
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 36, weight: .light))
                .foregroundStyle(BVTheme.accent)
            Text(title)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(BVTheme.text)
            Text(message)
                .font(.system(size: 14))
                .foregroundStyle(BVTheme.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 28)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
