import dotenv from "dotenv";
import path from "path";
import { connectDB } from "./db";
import server from "./express";

if (process.env.NODE_ENV === "development") {
  dotenv.config({ path: path.resolve(__dirname, ".env.dev") });
} else if (!process.env.VERCEL) {
  dotenv.config({ path: path.resolve(__dirname, ".env.prod") });
}

console.log("*********************************************************");

connectDB()
  .then(() => {
    console.log(
      "**------------- PROCESS ENV:",
      process.env.NODE_ENV,
      " -------------**"
    );

    // On Vercel the platform invokes the serverless handler; do not listen locally.
    if (process.env.VERCEL) {
      return;
    }

    const actualPort = process.env.PORT || 10000;
    server.listen(actualPort, (err) => {
      if (err) {
        console.log(
          "**------------- SERVER ERROR:",
          err,
          "(thus stopping the server)-------------**"
        );
        process.exit(1);
      }

      console.log(
        "**------------- SERVER STARTED ON PORT:",
        actualPort,
        "----------**"
      );
    });
  })
  .catch((err) => {
    console.log(
      "** UNABLE TO CONNECT TO DATABASE(",
      process.env.MONGODB_URI,
      ") thus stopping the server **",
      err
    );
    process.exit(1);
  });
