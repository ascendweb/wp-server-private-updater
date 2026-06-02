import { NextRequest, NextResponse } from "next/server";
import { hashSync } from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: { accounts: { select: { id: true, provider: true, createdAt: true } } },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { password: _pw, ...safe } = user;
  return NextResponse.json(safe);
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, email, role, status, password } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name || null;
  if (email !== undefined) data.email = email;
  if (role !== undefined) data.role = role;
  if (status !== undefined) data.status = status;
  if (password) data.password = hashSync(password, 12);

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      include: { accounts: { select: { id: true, provider: true, createdAt: true } } },
    });
    const { password: _pw, ...safe } = user;
    return NextResponse.json(safe);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Cannot delete your own account" },
      { status: 400 }
    );
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
