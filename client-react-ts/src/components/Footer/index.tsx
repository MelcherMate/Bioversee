import { Link } from "react-router-dom";
import "./Footer.css";

function Footer() {
  return (
    <div className="footerContainer">
      <div className="footerCopy">
        <p>&copy; 2026 Bioversee. All rights reserved. Mate Melcher.</p>
      </div>
      <div id="linkBox">
        <span className="divider"> &#124; </span>
        <Link className="footerLink" to="/about">
          About Project Bioversee
        </Link>
        <span className="divider"> &#124; </span>
        <a
          href="https://github.com/MelcherMate"
          className="footerLink"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Repository
        </a>
      </div>
    </div>
  );
}

export default Footer;
