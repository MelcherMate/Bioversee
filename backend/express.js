import compress from "compression";
import cookieParser from "cookie-parser";
import cookieSession from "cookie-session";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import passport from "passport";
import path from "path";
require("./passport");

// * Importing Routes
import actuatorSlidersRoutes from "./routes/actuatorSliders.routes";
import actuatorSwitchesRoutes from "./routes/actuatorSwitches.routes";
import authRoute from "./routes/auth.routes";
import sensorRoutes from "./routes/sensor.routes";
import userRoutes from "./routes/user.routes";

// # DotEnv configuration
if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: path.resolve(__dirname + "/.env.dev") });
} else if (!process.env.VERCEL) {
  dotenv.config({ path: path.resolve(__dirname + "/.env.prod") });
}

// # Server Creation
const app = express();

// # Cookie Session Middleware
app.use(
  cookieSession({
    name: "session",
    keys: [process.env.SESSION_SECRET || "bioversee"],
    maxAge: 24 * 60 * 60 * 100,
  })
);

// # Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// # Middleware
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(compress());

const publicUrl = process.env.PUBLIC_URL || "";
const cspOrigins = ["'self'", publicUrl].filter(Boolean);

if (process.env.NODE_ENV === "development") {
  app.use(helmet());
} else {
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", ...cspOrigins],
        connectSrc: ["'self'", "'unsafe-inline'", ...cspOrigins],
        imgSrc: ["*", "data:"],
      },
    })
  );
}

// # CORS middleware
const corsOptions = {
  origin: process.env.PUBLIC_URL,
  optionsSuccessStatus: 200,
  credentials: true,
};

app.use(cors(corsOptions));

// # Routes
app.use(
  "/",
  actuatorSlidersRoutes,
  actuatorSwitchesRoutes,
  sensorRoutes,
  userRoutes,
  authRoute
);

// Serve the Vite build only for local/production Node hosting (not on Vercel CDN).
if (process.env.NODE_ENV !== "development" && !process.env.VERCEL) {
  const clientDist = path.join(__dirname, "../client-react-ts/dist");
  app.use("/", express.static(clientDist));
  app.get("/*", (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

export default app;
