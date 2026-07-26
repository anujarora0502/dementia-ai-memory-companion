import { NextResponse } from 'next/server';
import { memoryStore } from '@/lib/memoryStore';

export async function GET() {
  try {
    const memories = memoryStore.getMemories();
    return NextResponse.json(memories);
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, imageUrl } = body;
    
    if (!title || !description) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 });
    }
    
    const newMemory = memoryStore.addMemory({
      title,
      description,
      imageUrl
    });
    
    return NextResponse.json(newMemory, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
