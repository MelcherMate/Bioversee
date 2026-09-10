import { useEffect, useRef, useState } from "react";
import { SettingsOutline } from "react-ionicons";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import type { AppUser } from "../../lib/user";
import "./Navbar.css";

type NavbarProps = {
  user: AppUser | null;
};

const Navbar = ({ user }: NavbarProps) => {
  const location = useLocation();
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement | null>(null);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        event.target instanceof Node &&
        !popupRef.current.contains(event.target)
      ) {
        setShowPopup(false);
      }
    };

    if (showPopup) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPopup]);

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <div className="topbar__left">
          <Link to={user ? "/bioreactor" : "/"} className="topbar__brand">
            <span className="topbar__mark" aria-hidden />
            Bioversee
          </Link>
          {user && (
            <nav className="topbar__nav">
              <Link
                className={`topbar__link ${
                  location.pathname === "/bioreactor" ? "is-active" : ""
                }`}
                to="/bioreactor"
              >
                Bioreactor
                <span className="topbar__badge topbar__badge--legacy">Legacy</span>
              </Link>
              <Link
                className={`topbar__link ${
                  location.pathname === "/pressure-vessel" ? "is-active" : ""
                }`}
                to="/pressure-vessel"
              >
                Pressure Vessel
              </Link>
              <Link
                className={`topbar__link ${
                  location.pathname === "/membrane-bioreactor" ? "is-active" : ""
                }`}
                to="/membrane-bioreactor"
              >
                Membrane MBR
              </Link>
              <Link
                className={`topbar__link ${
                  location.pathname === "/waterpurifier" ? "is-active" : ""
                }`}
                to="/waterpurifier"
              >
                Water Purifier
                <span className="topbar__badge topbar__badge--legacy">Legacy</span>
              </Link>
            </nav>
          )}
        </div>

        {user && (
          <div className="topbar__right">
            <Link
              className={`topbar__icon-btn ${
                location.pathname === "/settings" ? "is-active" : ""
              }`}
              to="/settings"
              aria-label="Settings"
            >
              <SettingsOutline
                color={"#1d1d1f"}
                title={"Settings"}
                height="20px"
                width="20px"
              />
            </Link>
            <button
              type="button"
              className="topbar__avatar-btn"
              onClick={() => setShowPopup((v) => !v)}
            >
              <img
                src={
                  user.avatarUrl ||
                  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                    user.displayName
                  )}`
                }
                alt=""
                className="topbar__avatar"
              />
            </button>
            {showPopup && (
              <div className="topbar__menu" ref={popupRef}>
                <p className="topbar__menu-label">Signed in</p>
                <p className="topbar__menu-name">{user.displayName}</p>
                <p className="topbar__menu-meta">{user.email}</p>
                <button
                  type="button"
                  className="topbar__menu-logout"
                  onClick={logout}
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
