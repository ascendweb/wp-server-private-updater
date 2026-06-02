import { NextRequest, NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { accounts: { select: { id: true, provider: true, createdAt: true } } },
  });

  const safe = users.map(({ password: _pw, ...u }: typeof users[number]) => u);
  return NextResponse.json(safe);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { email, password, name } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "A user with this email already exists" },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: {
      email,
      password: hashSync(password, 12),
      name: name || null,
      accounts: {
        create: { provider: "credentials", providerAccountId: email },
      },
    },
    include: { accounts: { select: { id: true, provider: true, createdAt: true } } },
  });

  const { password: _pw, ...safe } = user;
  return NextResponse.json(safe, { status: 201 });
}
