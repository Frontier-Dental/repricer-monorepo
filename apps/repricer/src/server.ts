import path from "path";
import express from "express";
import session from "express-session";

import cookieParser from "cookie-parser";
import memorystore from "memorystore";
import bodyParser from "body-parser";

//const DATABASE_URL = "mongodb://localhost:27017";
require("dotenv").config();

const app = express();
app.use(bodyParser.json({ limit: "500mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "500mb",
    extended: true,
    parameterLimit: 10000000,
  }),
);

process.env.TZ = "Canada/Eastern";

////////start/////////

app.set("view engine", "ejs");
app.set("views", "views");
//include routes variables
const indexRouter = require("./src/routes/index");

app.use(
  express.urlencoded({
    extended: false,
  }),
);
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));
app.use("/logo", express.static(path.join(__dirname, "/uploads/excel")));
// const secret = process.env.SECRET;
app.use(cookieParser("secret"));

const MemoryStore = memorystore(session);

app.use(
  session({
    secret: "secret",
    resave: true,
    saveUninitialized: false,
    store: new MemoryStore({
      checkPeriod: 86400000,
    }),
  }),
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/", indexRouter);

app.use("/public/images", express.static("./public/images"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(
    `Server running in production mode on port ${PORT} at ${new Date()}`,
  ),
);
