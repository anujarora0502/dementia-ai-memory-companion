import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memoryStore';

export async function GET() {
  try {
    const profile = await memoryStore.getProfile();
    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const updates = await request.json();
    const updatedProfile = await memoryStore.updateProfile(updates);
    return NextResponse.json(updatedProfile);
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
