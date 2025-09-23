import { Request, Response } from "express";
import passwordGenerator from "generate-password";
import bcrypt from "bcrypt";
import * as httpMiddleware from "../utility/http-wrappers";
import * as mysqlService from "../services/mysql";
import { applicationConfig } from "../utility/config";

export async function homePageHandler(req: Request, res: Response) {
  const isDowntimeOn = applicationConfig.DOWNTIME_ON;
  if (applicationConfig.AUTHENTICATION_DISABLED) {
    (req as any).session.users_id = {
      id: "dummySessionId",
      userName: "dummyUserName",
      userRole: "user", // Default role for now
    };
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

  const result = await mysqlService.AuthenticateUser(userName, userPassword);
  if (result) {
    (req as any).session.users_id = {
      id: result.id,
      userName: result.username,
      userRole: "user", // Default role for now
    };
    return res.json({
      status: true,
      userRole: "user",
      message: "Login Successful.",
    });
  } else {
    return res.json({
      status: false,
      message: "Invalid login details",
    });
  }
}

export async function changePassword(req: Request, res: Response) {
  const { input_old_password, enter_new_password, re_enter_new_password } =
    req.body;
  const store_user_id = (req as any).session.users_id;

  // Verify old password first
  const authResult = await mysqlService.AuthenticateUser(
    store_user_id.userName,
    input_old_password,
  );

  if (!authResult) {
    return res.json({
      status: false,
      message: "Current password is incorrect",
    });
  }

  if (enter_new_password !== re_enter_new_password) {
    return res.json({
      status: false,
      message: "New passwords do not match",
    });
  }

  // Hash the new password before storing
  const hashedPassword = await bcrypt.hash(enter_new_password, 10);

  // Update the password
  const updateResult = await mysqlService.ChangePassword(
    store_user_id.userName,
    hashedPassword,
  );

  if (updateResult) {
    return res.json({
      status: true,
      message: "Password Updated Successfully",
    });
  } else {
    return res.json({
      status: false,
      message: "Failed to update password",
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
    const username = user.trim();

    // Check if user already exists using the new MySQL service
    const existingUser = await mysqlService.CheckUserExists(username);

    if (existingUser) {
      result.push({
        userName: user,
        data: `User already exists for ${username}`,
      } as never);
    } else {
      // Generate a secure password
      const generatedPassword = passwordGenerator.generate({
        length: 15,
        numbers: true,
        strict: true,
      });

      // Hash the password before storing
      const hashedPassword = await bcrypt.hash(generatedPassword, 10);

      // Create user in MySQL
      const userId = await mysqlService.CreateUser(username, hashedPassword);

      if (userId) {
        // Send email with the plain text password (user needs to know it)
        const userInfo = {
          userName: username,
          userPassword: generatedPassword, // Send plain text for user to use
        };

        await httpMiddleware.native_post(
          applicationConfig.USER_CREATION_EMAIL_TRIGGER_URL,
          userInfo,
        );

        result.push({
          userName: user,
          data: `User created and Credentials sent to ${username}`,
        } as never);
      } else {
        result.push({
          userName: user,
          data: `Failed to create user for ${username}`,
        } as never);
      }
    }
  }

  return res.json({
    status: "success",
    message: result,
  });
}

export async function update_user(req: Request, res: Response) {
  const userNamesToAdd = req.body;
  let result: { userName: string; data: string }[] = [];

  for (const user of userNamesToAdd) {
    const username = user.trim();

    // Generate a new secure password
    const newPassword = passwordGenerator.generate({
      length: 15,
      numbers: true,
      strict: true,
    });

    // Hash the password before storing
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password in MySQL
    const updateResult = await mysqlService.ChangePassword(
      username,
      hashedPassword,
    );

    if (updateResult) {
      // Send email with the new plain text password
      const userInfo = {
        userName: username,
        userPassword: newPassword, // Send plain text for user to use
      };

      await httpMiddleware.native_post(
        applicationConfig.USER_CREATION_EMAIL_TRIGGER_URL,
        userInfo,
      );

      result.push({
        userName: user,
        data: `User updated and new Password generated at ${new Date()}`,
      });
    } else {
      result.push({
        userName: user,
        data: `Failed to update password for ${username}`,
      });
    }
  }

  return res.json({
    status: "success",
    message: result,
  });
}
