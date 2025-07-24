const path = require("path");
const express = require("express");
const session = require("express-session");
const { connectDB } = require("./config/db");

const cookieParser = require("cookie-parser");
var MemoryStore = require("memorystore")(session);
const { notFound, errorHandler } = require("./middleware/errorMiddleware.js");
const morgan = require("morgan");
const bodyParser = require("body-parser");

//const DATABASE_URL = "mongodb://localhost:27017";
require("dotenv").config();
//connect to DATABASE
connectDB(process.env.DATABASE_URL);

const app = express();
app.use(bodyParser.json({ limit: "500mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "500mb",
    extended: true,
    parameterLimit: 10000000,
  }),
);
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

process.env.TZ = "Canada/Eastern";

////////start/////////

app.set("view engine", "ejs");
app.set("views", "views");
//include routes variables
const indexRouter = require("./routes/index");

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

app.use("/", indexRouter);

app.use("/public/images", express.static("./public/images"));

const PORT = process.env.PORT || 3000;
app.listen(
  PORT,
  console.log(
    `Server running in production mode on port ${PORT} at ${new Date()}`,
  ),
);
