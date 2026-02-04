import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeName = file.name?.replace(/\s+/g, '_') || 'image.png';
    const fileName = `questions/question_${Date.now()}_${safeName}`;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'uploads';

    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(fileName, buffer, { contentType: file.type || 'image/png', upsert: true });

    if (error) {
      console.error('Supabase upload error:', error);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(fileName);
    return NextResponse.json({ url: data.publicUrl });
  } catch (error) {
    console.error('Question image upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
