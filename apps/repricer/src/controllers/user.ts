import { Request, Response } from "express";
import passwordGenerator from "generate-password";
import * as httpMiddleware from "../utility/http-wrappers";
import * as mongoMiddleware from "../services/mongo";
import { applicationConfig } from "../utility/config";

export async function homePageHandler(req: Request, res: Response) {
  const isDowntimeOn = applicationConfig.DOWNTIME_ON;
  if (applicationConfig.AUTHENTICATION_DISABLED) {
    return res.redirect("/productV2/show_all");
  }
  if (isDowntimeOn) {
    return res.render("pages/downtime.ejs", {});
  } else {
    const stored_session: any = (req as any).session;
    const users_id = stored_session.users_id;
    if (users_id) {
      res.redirect("/productV2/show_all");
    } else {
      return res.render("pages/index", {});
    }
  }
}

export async function loginUser(req: Request, res: Response) {
  const userName = req.body.userName;
  const userPassword = req.body.userPassword;
  const result = await mongoMiddleware.GetUserLogin({ userName: userName });
  if (result) {
    if (result.userName == userName && result.userPassword == userPassword) {
      (req as any).session.users_id = result;
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
}

export async function changePassword(req: Request, res: Response) {
  const { input_old_password, enter_new_password, re_enter_new_password } =
    req.body;
  const store_user_id = (req as any).session.users_id;
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
}

export async function logout(req: Request, res: Response) {
  (req as any).session.destroy(function (err: any) {
    (req as any).logout;
    res.redirect("/");
  });
}

export async function add_user(req: Request, res: Response) {
  const userNamesToAdd = req.body;
  let result: any[] = [];
  for (const user of userNamesToAdd) {
    const userDetails = await mongoMiddleware.GetUserLogin({
      userName: user.trim(),
    });
    if (userDetails) {
      result.push({
        userName: user,
        data: `User already exists for ${user.trim()}`,
      } as never);
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
        applicationConfig.USER_CREATION_EMAIL_TRIGGER_URL,
        userInfo,
      );
      result.push({
        userName: user,
        data: `User created and Credentials sent to ${user.trim()}`,
      } as never);
    }
  }
  return res.json({
    status: "success",
    message: result,
  });
}

export async function update_user(req: Request, res: Response) {
  const userNamesToAdd = req.body;
  let result: any[] = [];
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
    } as never);
  }
  return res.json({
    status: "success",
    message: result,
  });
}
