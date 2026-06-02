import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashSync } from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@example.com";
  const password = process.env.ADMIN_PASSWORD || "changeme";

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (existing) {
    const hasCredentialsAccount = existing.accounts.some(
      (a) => a.provider === "credentials"
    );
    if (!hasCredentialsAccount) {
      await prisma.account.create({
        data: {
          userId: existing.id,
          provider: "credentials",
          providerAccountId: email,
        },
      });
      console.log(`Linked credentials account for existing user ${email}.`);
    } else {
      console.log(`Admin user ${email} already exists, skipping seed.`);
    }
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: hashSync(password, 12),
      name: "Admin",
      accounts: {
        create: {
          provider: "credentials",
          providerAccountId: email,
        },
      },
    },
  });

  console.log(`Created admin user: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
