import { Request, Response } from "express";
import * as user from "../user";
import * as mysqlService from "../../services/mysql";
import * as httpMiddleware from "../../utility/http-wrappers";
import { applicationConfig } from "../../utility/config";
import bcrypt from "bcrypt";
import passwordGenerator from "generate-password";

jest.mock("../../services/mysql");
jest.mock("../../utility/http-wrappers");
jest.mock("../../utility/config", () => ({
  applicationConfig: {
    DOWNTIME_ON: false,
    AUTHENTICATION_DISABLED: false,
    USER_CREATION_EMAIL_TRIGGER_URL: "http://test/notify/user_creation_email",
  },
}));

const mockAuthenticateUser = mysqlService.AuthenticateUser as jest.MockedFunction<typeof mysqlService.AuthenticateUser>;
const mockCheckUserExists = mysqlService.CheckUserExists as jest.MockedFunction<typeof mysqlService.CheckUserExists>;
const mockCreateUser = mysqlService.CreateUser as jest.MockedFunction<typeof mysqlService.CreateUser>;
const mockChangePassword = mysqlService.ChangePassword as jest.MockedFunction<typeof mysqlService.ChangePassword>;
const mockNativePost = httpMiddleware.native_post as jest.MockedFunction<typeof httpMiddleware.native_post>;

jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
}));

jest.mock("generate-password", () => ({
  __esModule: true,
  default: {
    generate: jest.fn().mockReturnValue("GeneratedP@ssw0rd"),
  },
}));

describe("User Controller", () => {
  let mockReq: Partial<Request> & { session?: any };
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let redirectMock: jest.Mock;
  let renderMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jsonMock = jest.fn().mockReturnThis();
    redirectMock = jest.fn().mockReturnThis();
    renderMock = jest.fn();
    mockRes = {
      json: jsonMock,
      redirect: redirectMock,
      render: renderMock,
    };
    mockReq = {
      body: {},
      session: undefined as any,
    };
    (applicationConfig as any).DOWNTIME_ON = false;
    (applicationConfig as any).AUTHENTICATION_DISABLED = false;
  });

  describe("homePageHandler", () => {
    it("should set dummy session and redirect when AUTHENTICATION_DISABLED is true", async () => {
      (applicationConfig as any).AUTHENTICATION_DISABLED = true;
      mockReq.session = {} as any;

      await user.homePageHandler(mockReq as Request, mockRes as Response);

      expect((mockReq as any).session.users_id).toEqual({
        id: "dummySessionId",
        userName: "dummyUserName",
        userRole: "user",
      });
      expect(redirectMock).toHaveBeenCalledWith("/productV2/show_all");
      expect(renderMock).not.toHaveBeenCalled();
    });

    it("should render downtime page when DOWNTIME_ON is true", async () => {
      (applicationConfig as any).DOWNTIME_ON = true;

      await user.homePageHandler(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith("pages/downtime.ejs", {});
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("should redirect to productV2 when user has session", async () => {
      (applicationConfig as any).DOWNTIME_ON = false;
      mockReq.session = { users_id: { id: "1", userName: "test" } } as any;

      await user.homePageHandler(mockReq as Request, mockRes as Response);

      expect(redirectMock).toHaveBeenCalledWith("/productV2/show_all");
      expect(renderMock).not.toHaveBeenCalled();
    });

    it("should render index when no downtime and no session", async () => {
      (applicationConfig as any).DOWNTIME_ON = false;
      mockReq.session = {} as any;

      await user.homePageHandler(mockReq as Request, mockRes as Response);

      expect(renderMock).toHaveBeenCalledWith("pages/index", {});
      expect(redirectMock).not.toHaveBeenCalled();
    });
  });

  describe("loginUser", () => {
    it("should set session and return success when credentials are valid", async () => {
      mockReq.body = { userName: "alice", userPassword: "secret" };
      mockReq.session = {} as any;
      mockAuthenticateUser.mockResolvedValue({
        id: 42,
        username: "alice",
        password: "hashed",
      } as any);

      await user.loginUser(mockReq as Request, mockRes as Response);

      expect(mockAuthenticateUser).toHaveBeenCalledWith("alice", "secret");
      expect((mockReq as any).session.users_id).toEqual({
        id: 42,
        userName: "alice",
        userRole: "user",
      });
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        userRole: "user",
        message: "Login Successful.",
      });
    });

    it("should return invalid login when AuthenticateUser returns falsy", async () => {
      mockReq.body = { userName: "bob", userPassword: "wrong" };
      mockAuthenticateUser.mockResolvedValue(null as any);

      await user.loginUser(mockReq as Request, mockRes as Response);

      expect(mockAuthenticateUser).toHaveBeenCalledWith("bob", "wrong");
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Invalid login details",
      });
    });
  });

  describe("changePassword", () => {
    beforeEach(() => {
      mockReq.session = {
        users_id: { userName: "alice" },
      } as any;
    });

    it("should return error when current password is incorrect", async () => {
      mockReq.body = {
        input_old_password: "wrong",
        enter_new_password: "new",
        re_enter_new_password: "new",
      };
      mockAuthenticateUser.mockResolvedValue(null as any);

      await user.changePassword(mockReq as Request, mockRes as Response);

      expect(mockAuthenticateUser).toHaveBeenCalledWith("alice", "wrong");
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Current password is incorrect",
      });
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it("should return error when new passwords do not match", async () => {
      mockReq.body = {
        input_old_password: "correct",
        enter_new_password: "new1",
        re_enter_new_password: "new2",
      };
      mockAuthenticateUser.mockResolvedValue({ id: 1, username: "alice" } as any);

      await user.changePassword(mockReq as Request, mockRes as Response);

      expect(mockAuthenticateUser).toHaveBeenCalledWith("alice", "correct");
      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "New passwords do not match",
      });
      expect(mockChangePassword).not.toHaveBeenCalled();
    });

    it("should hash new password, update and return success", async () => {
      mockReq.body = {
        input_old_password: "correct",
        enter_new_password: "newpass",
        re_enter_new_password: "newpass",
      };
      mockAuthenticateUser.mockResolvedValue({ id: 1, username: "alice" } as any);
      mockChangePassword.mockResolvedValue(true as any);

      await user.changePassword(mockReq as Request, mockRes as Response);

      expect(bcrypt.hash).toHaveBeenCalledWith("newpass", 10);
      expect(mockChangePassword).toHaveBeenCalledWith("alice", "hashed_password");
      expect(jsonMock).toHaveBeenCalledWith({
        status: true,
        message: "Password Updated Successfully",
      });
    });

    it("should return error when ChangePassword returns falsy", async () => {
      mockReq.body = {
        input_old_password: "correct",
        enter_new_password: "newpass",
        re_enter_new_password: "newpass",
      };
      mockAuthenticateUser.mockResolvedValue({ id: 1, username: "alice" } as any);
      mockChangePassword.mockResolvedValue(false as any);

      await user.changePassword(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: false,
        message: "Failed to update password",
      });
    });
  });

  describe("logout", () => {
    it("should call session.destroy and redirect to /", async () => {
      const destroyMock = jest.fn((cb: (err: any) => void) => cb(undefined));
      mockReq.session = { destroy: destroyMock } as any;

      await user.logout(mockReq as Request, mockRes as Response);

      expect(destroyMock).toHaveBeenCalled();
      expect(redirectMock).toHaveBeenCalledWith("/");
    });

    it("should redirect even when destroy calls back with error", async () => {
      const destroyMock = jest.fn((cb: (err: any) => void) => cb(new Error("session error")));
      mockReq.session = { destroy: destroyMock } as any;

      await user.logout(mockReq as Request, mockRes as Response);

      expect(redirectMock).toHaveBeenCalledWith("/");
    });
  });

  describe("add_user", () => {
    it("should return already exists for existing user", async () => {
      mockReq.body = [{ userName: "  existing  ", userPassword: "  pwd  " }];
      mockCheckUserExists.mockResolvedValue(true as any);

      await user.add_user(mockReq as Request, mockRes as Response);

      expect(mockCheckUserExists).toHaveBeenCalledWith("existing");
      expect(mockCreateUser).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: "success",
        message: [
          expect.objectContaining({
            data: "User already exists for existing",
          }),
        ],
      });
    });

    it("should create user and return success when user does not exist", async () => {
      mockReq.body = [{ userName: "  newuser  ", userPassword: "  mypass  " }];
      mockCheckUserExists.mockResolvedValue(false as any);
      mockCreateUser.mockResolvedValue(100 as any);

      await user.add_user(mockReq as Request, mockRes as Response);

      expect(mockCheckUserExists).toHaveBeenCalledWith("newuser");
      expect(bcrypt.hash).toHaveBeenCalledWith("mypass", 10);
      expect(mockCreateUser).toHaveBeenCalledWith("newuser", "hashed_password");
      expect(jsonMock).toHaveBeenCalledWith({
        status: "success",
        message: [
          expect.objectContaining({
            data: "User created and Credentials sent to newuser",
          }),
        ],
      });
    });

    it("should return failed when CreateUser returns falsy", async () => {
      mockReq.body = [{ userName: "newuser", userPassword: "mypass" }];
      mockCheckUserExists.mockResolvedValue(false as any);
      mockCreateUser.mockResolvedValue(null as any);

      await user.add_user(mockReq as Request, mockRes as Response);

      expect(jsonMock).toHaveBeenCalledWith({
        status: "success",
        message: [
          expect.objectContaining({
            data: "Failed to create user for newuser",
          }),
        ],
      });
    });

    it("should process multiple users and aggregate results", async () => {
      mockReq.body = [
        { userName: "existing", userPassword: "p1" },
        { userName: "newone", userPassword: "p2" },
      ];
      mockCheckUserExists.mockResolvedValueOnce(true as any).mockResolvedValueOnce(false as any);
      mockCreateUser.mockResolvedValue(1 as any);

      await user.add_user(mockReq as Request, mockRes as Response);

      expect(mockCheckUserExists).toHaveBeenCalledTimes(2);
      expect(mockCreateUser).toHaveBeenCalledTimes(1);
      expect(jsonMock).toHaveBeenCalledWith({
        status: "success",
        message: [
          expect.objectContaining({ data: "User already exists for existing" }),
          expect.objectContaining({
            data: "User created and Credentials sent to newone",
          }),
        ],
      });
    });
  });

  describe("update_user", () => {
    it("should generate new password, update and call email trigger on success", async () => {
      mockReq.body = ["user1"];
      mockChangePassword.mockResolvedValue(true as any);
      mockNativePost.mockResolvedValue(undefined as any);

      await user.update_user(mockReq as Request, mockRes as Response);

      expect(passwordGenerator.generate).toHaveBeenCalledWith({
        length: 15,
        numbers: true,
        strict: true,
      });
      expect(bcrypt.hash).toHaveBeenCalledWith("GeneratedP@ssw0rd", 10);
      expect(mockChangePassword).toHaveBeenCalledWith("user1", "hashed_password");
      expect(mockNativePost).toHaveBeenCalledWith(applicationConfig.USER_CREATION_EMAIL_TRIGGER_URL, { userName: "user1", userPassword: "GeneratedP@ssw0rd" });
      expect(jsonMock).toHaveBeenCalledWith({
        status: "success",
        message: [
          {
            userName: "user1",
            data: expect.stringContaining("User updated and new Password generated at"),
          },
        ],
      });
    });

    it("should return failed message when ChangePassword returns falsy", async () => {
      mockReq.body = ["user2"];
      mockChangePassword.mockResolvedValue(false as any);

      await user.update_user(mockReq as Request, mockRes as Response);

      expect(mockNativePost).not.toHaveBeenCalled();
      expect(jsonMock).toHaveBeenCalledWith({
        status: "success",
        message: [
          {
            userName: "user2",
            data: "Failed to update password for user2",
          },
        ],
      });
    });

    it("should process multiple users", async () => {
      mockReq.body = ["u1", "u2"];
      mockChangePassword.mockResolvedValueOnce(true as any).mockResolvedValueOnce(false as any);
      mockNativePost.mockResolvedValue(undefined as any);

      await user.update_user(mockReq as Request, mockRes as Response);

      expect(mockChangePassword).toHaveBeenCalledWith("u1", "hashed_password");
      expect(mockChangePassword).toHaveBeenCalledWith("u2", "hashed_password");
      expect(mockNativePost).toHaveBeenCalledTimes(1);
      expect(jsonMock).toHaveBeenCalledWith({
        status: "success",
        message: [
          {
            userName: "u1",
            data: expect.stringContaining("User updated and new Password generated at"),
          },
          {
            userName: "u2",
            data: "Failed to update password for u2",
          },
        ],
      });
    });
  });
});
