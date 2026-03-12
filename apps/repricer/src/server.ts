import path from "path";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import memorystore from "memorystore";
import bodyParser from "body-parser";
import indexRouter from "./routes";
import { Request, Response } from "express";
import { applicationConfig, validateConfig } from "./utility/config";
import morgan from "morgan";
import packageJson from "../package.json";
import { startAllMonitorCrons } from "./controllers/monitor-sense";
import logger from "./utility/logger";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

validateConfig();

process.on("uncaughtException", (err) => {
  logger.error(`Uncaught Exception: ${err}`);
});

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled Rejection: ${reason}`);
});

const app = express();
// Trust first proxy so req.ip reflects X-Forwarded-For (needed for rate limiting behind nginx/load balancer)
app.set("trust proxy", 1);
if (applicationConfig.REQUEST_LOGGING) {
  app.use(morgan("combined"));
}
app.use(bodyParser.json({ limit: "500mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "500mb",
    extended: true,
    parameterLimit: 10000000,
  })
);

app.set("view engine", "ejs");
app.set("views", "views");

app.use(
  express.urlencoded({
    extended: false,
  })
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
  })
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

app.use(notFoundHandler);
app.use(errorHandler);

app.use("/public/images", express.static("./public/images"));

const PORT = applicationConfig.PORT || 3000;
process.env.TZ = "Canada/Eastern";
app.listen(PORT, async () => {
  logger.info(`Server running with node environment ${process.env.NODE_ENV} on port ${PORT} at ${new Date()}`);
  logger.info(`Application version: ${packageJson.version}`);
  logger.info("Scheduling enabled crons on startup");
  await startAllMonitorCrons();
});
