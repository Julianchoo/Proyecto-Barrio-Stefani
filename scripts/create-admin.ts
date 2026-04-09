import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user } from "../src/lib/schema";
import { eq } from "drizzle-orm";
import * as dotenv from "dotenv";
import { auth } from "../src/lib/auth";

dotenv.config({ path: ".env" });

async function main() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("POSTGRES_URL not set");

  const client = postgres(connectionString, { ssl: "require" });
  const db = drizzle(client);

  const EMAIL = "juliankorn@gmail.com";
  const PASSWORD = "38028742Juli6!";
  const NAME = "Julian Korn";

  // Check if user already exists
  const existing = await db.select({ id: user.id }).from(user).where(eq(user.email, EMAIL));
  if (existing.length > 0) {
    console.log("Usuario ya existe. Actualizando rol a admin...");
    await db.update(user).set({ role: "admin" }).where(eq(user.email, EMAIL));
    console.log("✅ Rol actualizado a admin.");
    await client.end();
    return;
  }

  // Create user via Better Auth (handles password hashing)
  const result = await auth.api.signUpEmail({
    body: { name: NAME, email: EMAIL, password: PASSWORD },
    asResponse: false,
  });

  if (!result?.user?.id) {
    throw new Error("No se pudo crear el usuario");
  }

  // Set role to admin
  await db.update(user).set({ role: "admin" }).where(eq(user.id, result.user.id));

  console.log(`✅ Usuario admin creado: ${EMAIL}`);
  await client.end();
}

main().catch((err) => {
  console.error("❌ Error:", err.message ?? err);
  process.exit(1);
});
