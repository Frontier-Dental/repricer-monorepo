const mongoose = require("mongoose");
// const DATABASE_URL = "mongodb://localhost:27017";

exports.connectDB = async (DATABASE_URL) => {
  try {
    const dbOption = {
      dbName: "repricer",
    };
    //await mongoose.connect(DATABASE_URL , dbOption);
    console.log("server is connected to the dataBase");
  } catch (error) {
    console.log(error);
  }
};
