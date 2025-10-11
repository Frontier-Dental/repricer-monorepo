import bcrypt from "bcrypt";
import knex from "knex";
import dotenv from "dotenv";

// Load environment variables
const environment = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${environment}` });

// Create Knex instance
function createKnexInstance() {
  if (!process.env.SQL_HOSTNAME) {
    throw new Error("SQL_HOSTNAME is not set");
  }
  if (!process.env.SQL_PORT) {
    throw new Error("SQL_PORT is not set");
  }
  if (!process.env.SQL_USERNAME) {
    throw new Error("SQL_USERNAME is not set");
  }
  if (!process.env.SQL_PASSWORD) {
    throw new Error("SQL_PASSWORD is not set");
  }
  if (!process.env.SQL_DATABASE) {
    throw new Error("SQL_DATABASE is not set");
  }

  return knex({
    client: "mysql2",
    connection: {
      host: process.env.SQL_HOSTNAME,
      port: parseInt(process.env.SQL_PORT),
      user: process.env.SQL_USERNAME,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DATABASE,
    },
  });
}

async function createUser(username: string, password: string) {
  let db: knex.Knex = createKnexInstance();

  try {
    // Check if user already exists
    const existingUser = await db("users")
      .select("id", "username")
      .where("username", username)
      .first();

    if (existingUser) {
      console.log(`❌ User '${username}' already exists`);
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const [userId] = await db("users").insert({
      username,
      password: hashedPassword,
    });

    console.log(
      `✅ User '${username}' created successfully with ID: ${userId}`,
    );
    console.log(`Username: ${username}`);
    // console.log(`Password: ${password}`);
  } catch (error) {
    console.error("❌ Error creating user:", error);
  } finally {
    if (db) {
      await db.destroy();
    }
    process.exit(0);
  }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length !== 2) {
  // console.log("Usage: npm run create-user <username> <password>");
  // console.log("Example: npm run create-user admin mypassword123");
  process.exit(1);
}

const [username, password] = args;
createUser(username, password);
