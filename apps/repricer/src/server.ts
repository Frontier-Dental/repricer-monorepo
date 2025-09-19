import path from "path";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import memorystore from "memorystore";
import bodyParser from "body-parser";
import indexRouter from "./routes";
import { Request, Response } from "express";
import { errorMiddleware } from "./utility/error-middleware";
import { applicationConfig, validateConfig } from "./utility/config";
import morgan from "morgan";
import packageJson from "../package.json";

validateConfig();

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

const app = express();
if (applicationConfig.REQUEST_LOGGING) {
  app.use(morgan("combined"));
}
app.use(bodyParser.json({ limit: "500mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "500mb",
    extended: true,
    parameterLimit: 10000000,
  }),
);

app.set("view engine", "ejs");
app.set("views", "views");

app.use(
  express.urlencoded({
    extended: false,
  }),
);
app.use(express.json());

app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/logo", express.static(path.join(__dirname, "..", "/uploads/excel")));

app.use(cookieParser("secret"));

const MemoryStore = memorystore(session);

app.use(
  session({
    secret: applicationConfig.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
  }),
);

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

const publicPath = path.join(__dirname, "..", "public");

// Route for the Vite page
app.get("/vite*splat", (req, res) => {
  res.sendFile(path.join(publicPath, "vite/index.html"));
});

app.use(indexRouter);

app.use("/public/images", express.static("./public/images"));

app.use(errorMiddleware);

const PORT = applicationConfig.PORT || 3000;
app.listen(PORT, () => {
  console.log(
    `Server running with node environment ${process.env.NODE_ENV} on port ${PORT} at ${new Date()}`,
  );
  console.log(`Application version: ${packageJson.version}`);
});
