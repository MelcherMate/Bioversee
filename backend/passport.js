import dotenv from "dotenv";
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const passport = require("passport");
const path = require("path");

// # DotEnv configuration (Vercel injects env vars — skip local files there)
if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: path.resolve(__dirname + "/.env.dev") });
} else if (!process.env.VERCEL) {
  dotenv.config({ path: path.resolve(__dirname + "/.env.prod") });
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CLIENT_CALLBACK_URI,
    },
    function (accessToken, refreshToken, profile, done) {
      done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});
