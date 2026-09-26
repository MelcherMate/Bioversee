"""Entry point for the Bioversee Pi desktop setup wizard."""

from __future__ import annotations


def main() -> None:
    from bioversee_pi.wizard.gui import main as gui_main

    gui_main()


if __name__ == "__main__":
    main()
