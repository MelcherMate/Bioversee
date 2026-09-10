import { useEffect, useRef, useState } from "react";
import { ShareSocialOutline } from "react-ionicons";
import { Link, useLocation } from "react-router-dom";
import type { AppUser } from "../../lib/user";
import { supabase } from "../../lib/supabase";
import SharePanel from "../SharePanel";
import "./Navbar.css";

type NavbarProps = {
  user: AppUser | null;
};

const Navbar = ({ user }: NavbarProps) => {
  const location = useLocation();
  const [showAccount, setShowAccount] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    setShowShare(false);
    setShowAccount(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        accountRef.current &&
        event.target instanceof Node &&
        !accountRef.current.contains(event.target)
      ) {
        setShowAccount(false);
      }
    };

    if (showAccount) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAccount]);

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
            <div className="topbar__share-wrap">
              <button
                type="button"
                className={`topbar__icon-btn ${showShare ? "is-active" : ""}`}
                aria-label="Share"
                aria-expanded={showShare}
                onClick={() => {
                  setShowAccount(false);
                  setShowShare((open) => !open);
                }}
              >
                <ShareSocialOutline
                  color={"#1d1d1f"}
                  title={"Share"}
                  height="20px"
                  width="20px"
                />
              </button>
              <SharePanel
                user={user}
                open={showShare}
                onClose={() => setShowShare(false)}
              />
            </div>
            <div className="topbar__account" ref={accountRef}>
              <button
                type="button"
                className="topbar__avatar-btn"
                onClick={() => {
                  setShowShare(false);
                  setShowAccount((open) => !open);
                }}
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
              {showAccount && (
                <div className="topbar__menu">
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
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
