import Combine
import SwiftUI
import UIKit

/// Tracks keyboard visibility + height so chrome can yield space.
@MainActor
final class KeyboardObserver: ObservableObject {
    static let shared = KeyboardObserver()

    @Published private(set) var isVisible = false
    @Published private(set) var height: CGFloat = 0

    private var tokens: [NSObjectProtocol] = []

    private init() {
        let center = NotificationCenter.default
        tokens.append(
            center.addObserver(
                forName: UIResponder.keyboardWillChangeFrameNotification,
                object: nil,
                queue: .main
            ) { [weak self] note in
                Task { @MainActor in
                    self?.apply(note)
                }
            }
        )
        tokens.append(
            center.addObserver(
                forName: UIResponder.keyboardWillHideNotification,
                object: nil,
                queue: .main
            ) { [weak self] note in
                Task { @MainActor in
                    self?.apply(note, forcingHidden: true)
                }
            }
        )
    }

    private func apply(_ note: Notification, forcingHidden: Bool = false) {
        let duration = (note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double) ?? 0.22
        let endFrame = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect) ?? .zero
        let screenHeight = UIScreen.main.bounds.height
        let overlap = max(0, screenHeight - endFrame.origin.y)
        let visible = !forcingHidden && overlap > 1

        withAnimation(.easeOut(duration: duration)) {
            isVisible = visible
            height = visible ? overlap : 0
        }
    }

    deinit {
        tokens.forEach(NotificationCenter.default.removeObserver)
    }
}
