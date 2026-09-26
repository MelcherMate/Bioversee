"""Deprecated: use bioversee_pi.wizard.gui (native CustomTkinter app)."""

from __future__ import annotations

# Kept so older imports/scripts do not break during upgrades.
from bioversee_pi.wizard.gui import main

__all__ = ["main"]
