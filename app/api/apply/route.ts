import { NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export async function POST(req: Request) {
  try {
    await dbConnect();
    const body = await req.json();
    const { name, email, mobile } = body;

    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { mobile }] 
    });

    if (existingUser) {
      return NextResponse.json(
        { message: 'User with this email or mobile already exists' },
        { status: 400 }
      );
    }

    // Randomly select avatar from public/avatars folders
    const avatarFolders = ['3d', 'bluey', 'memo', 'notion', 'teams', 'toons', 'upstream', 'vibrant'];
    const avatarCounts: { [key: string]: number } = {
      '3d': 5,
      'bluey': 10,
      'memo': 20,
      'notion': 10,
      'teams': 5,
      'toons': 7,
      'upstream': 5,
      'vibrant': 20
    };
    
    const randomFolder = avatarFolders[Math.floor(Math.random() * avatarFolders.length)];
    const randomImageNum = Math.floor(Math.random() * avatarCounts[randomFolder]) + 1;
    const avatarPath = `/avatars/${randomFolder}/${randomImageNum}.png`;

    const newUser = await User.create({
      name,
      email,
      mobile,
      status: 'approved',
      avatarConfig: {
        image: avatarPath,
        color: ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500'][Math.floor(Math.random() * 4)]
      }
    });

    return NextResponse.json({ message: 'Application submitted successfully', user: newUser }, { status: 201 });
  } catch (error) {
    console.error('Apply Error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
