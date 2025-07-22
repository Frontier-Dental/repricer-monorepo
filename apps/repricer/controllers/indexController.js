const asyncHandler = require("express-async-handler");
const userModel = require("../models/user.js");
const mongoMiddleware = require("../middleware/mongoMiddleware.js");
const httpMiddleware = require("../middleware/httpMiddleware");
const passwordGenerator = require("generate-password");
exports.index = asyncHandler(async (req, res) => {
  const isDowntimeOn = JSON.parse(process.env.DOWNTIME_ON);
  if (isDowntimeOn == true) {
    return res.render("pages/downtime.ejs", {});
  } else {
    const stored_session = req.session;
    const users_id = stored_session.users_id;
    if (users_id) {
      res.redirect("/productV2/show_all");
    } else {
      return res.render("pages/index", {});
    }
  }
});

exports.login_post = asyncHandler(async (req, res) => {
  const userName = req.body.userName;
  const userPassword = req.body.userPassword;
  const result = await mongoMiddleware.GetUserLogin({ userName: userName });
  if (result != null) {
    if (result.userName == userName && result.userPassword == userPassword) {
      req.session.users_id = result;
      return res.json({
        status: true,
        userRole: result.userRole,
        message: "Login Successful.",
      });
    } else {
      return res.json({
        status: false,
        message: "Invalid login details",
      });
    }
  } else {
    return res.json({
      status: false,
      message: "This email is not Registered",
    });
  }
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { input_old_password, enter_new_password, re_enter_new_password } =
    req.body;
  const store_user_id = req.session.users_id;
  var store_pass_session = store_user_id.userPassword;

  if (
    store_pass_session == input_old_password &&
    enter_new_password == re_enter_new_password
  ) {
    await mongoMiddleware.UpdateUserPassword(
      store_user_id.userName,
      enter_new_password,
    );
    return res.json({
      status: true,
      message: "Password Updated Successful",
    });
  } else {
    return res.json({
      status: false,
      message: "Please Enter New Password Same",
    });
  }
});

exports.logout = asyncHandler(async (req, res) => {
  req.session.destroy(function (err) {
    req.logout;
    res.redirect("/");
  });
});

exports.add_user = asyncHandler(async (req, res) => {
  const userNamesToAdd = req.body;
  let result = [];
  for (const user of userNamesToAdd) {
    const userDetails = await mongoMiddleware.GetUserLogin({
      userName: user.trim(),
    });
    if (userDetails) {
      result.push({
        userName: user,
        data: `User already exists for ${user.trim()}`,
      });
    } else {
      const userInfo = {
        userName: user.trim(),
        userPassword: passwordGenerator.generate({
          length: 15,
          numbers: true,
          strict: true,
        }),
      };
      await mongoMiddleware.InsertUserLogin(userInfo);
      httpMiddleware.native_post(
        process.env.USER_CREATION_EMAIL_TRIGGER_URL,
        userInfo,
      );
      result.push({
        userName: user,
        data: `User created and Credentials sent to ${user.trim()}`,
      });
    }
  }
  return res.json({
    status: "success",
    message: result,
  });
});

exports.update_user = asyncHandler(async (req, res) => {
  const userNamesToAdd = req.body;
  let result = [];
  for (const user of userNamesToAdd) {
    await mongoMiddleware.UpdateUserPassword(
      user.trim(),
      passwordGenerator.generate({
        length: 15,
        numbers: true,
        strict: true,
      }),
    );
    result.push({
      userName: user,
      data: `User updated and new Password generated at ${new Date()}`,
    });
  }
  return res.json({
    status: "success",
    message: result,
  });
});
