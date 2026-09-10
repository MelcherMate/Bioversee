/**
 * Vercel serverless entry — wraps the Express app and reuses the MongoDB connection.
 */
require("dotenv").config();
require("@babel/register")({
  presets: ["@babel/preset-env"],
  ignore: [/node_modules/],
});

const { connectDB } = require("../backend/db.js");
const app = require("../backend/express.js").default;

module.exports = async (req, res) => {
  await connectDB();
  return app(req, res);
};
