import SwiftUI
import UIKit

/// Drives the floating tab bar collapse while scrolling.
@MainActor
final class TabBarChrome: ObservableObject {
    static let shared = TabBarChrome()

    @Published private(set) var isCollapsed = false

    private var lastOffset: CGFloat = 0
    private var hasLastOffset = false

    func reset() {
        isCollapsed = false
        lastOffset = 0
        hasLastOffset = false
    }

    func handleOffset(_ offsetY: CGFloat) {
        guard AppearanceStore.shared.autoHideTabBar else {
            if isCollapsed { isCollapsed = false }
            return
        }

        defer {
            lastOffset = offsetY
            hasLastOffset = true
        }

        // Always reveal near the top of the list.
        if offsetY <= 12 {
            if isCollapsed {
                withAnimation(.easeInOut(duration: 0.28)) { isCollapsed = false }
            }
            return
        }

        guard hasLastOffset else { return }
        let delta = offsetY - lastOffset

        if delta > 5 {
            if !isCollapsed {
                withAnimation(.easeInOut(duration: 0.28)) { isCollapsed = true }
            }
        } else if delta < -5 {
            if isCollapsed {
                withAnimation(.easeInOut(duration: 0.28)) { isCollapsed = false }
            }
        }
    }
}

/// Finds the enclosing UIScrollView and reports contentOffset for tab-bar chrome.
struct TabBarScrollObserver: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> UIView {
        let view = UIView(frame: .zero)
        view.isUserInteractionEnabled = false
        view.backgroundColor = .clear
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        DispatchQueue.main.async {
            context.coordinator.attach(from: uiView)
        }
    }

    final class Coordinator {
        private var observation: NSKeyValueObservation?
        private weak var scrollView: UIScrollView?

        deinit {
            observation?.invalidate()
        }

        func attach(from view: UIView) {
            guard let found = view.enclosingScrollView() else { return }
            guard found !== scrollView else { return }

            observation?.invalidate()
            scrollView = found
            observation = found.observe(\.contentOffset, options: [.new]) { scroll, _ in
                let y = scroll.contentOffset.y
                Task { @MainActor in
                    TabBarChrome.shared.handleOffset(y)
                }
            }
        }
    }
}

private extension UIView {
    func enclosingScrollView() -> UIScrollView? {
        var node: UIView? = self
        while let current = node {
            if let scroll = current as? UIScrollView {
                return scroll
            }
            node = current.superview
        }
        return nil
    }
}

extension View {
    /// Observe vertical scrolling so the floating tab bar can auto-hide.
    func trackTabBarScroll() -> some View {
        background {
            TabBarScrollObserver()
                .frame(width: 0, height: 0)
        }
    }
}
