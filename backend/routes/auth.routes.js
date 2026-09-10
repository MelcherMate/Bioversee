const router = require("express").Router();
const passport = require("passport");
const dotenv = require("dotenv");
const path = require("path");

// # DotEnv configuration (Vercel injects env vars — skip local files there)
if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: path.resolve(__dirname, "../.env.dev") });
} else if (!process.env.VERCEL) {
  dotenv.config({ path: path.resolve(__dirname, "../.env.prod") });
}

router.get("/auth/login/success", (req, res) => {
  if (req.user) {
    res.status(200).json({
      success: true,
      message: "successfull",
      user: req.user,
    });
  }
});

router.get("/auth/login/failed", (req, res) => {
  res.status(401).json({
    success: false,
    message: "failure",
  });
});

router.get("/auth/logout", (req, res) => {
  req.logout();
  res.redirect(process.env.PUBLIC_URL);
});

//# Google Login
router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    successRedirect: process.env.PUBLIC_URL + "/bioreactor",
    failureRedirect: "/login/failed",
  })
);

module.exports = router;
