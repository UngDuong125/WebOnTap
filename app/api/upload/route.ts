import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const cloudKey = process.env.CLOUDINARY_API_KEY;
const cloudSecret = process.env.CLOUDINARY_API_SECRET;

export async function POST(request: Request) {
  if (!cloudName || !cloudKey || !cloudSecret) {
    return NextResponse.json({ error: 'Cloudinary chưa được cấu hình đầy đủ.' }, { status: 500 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'Thiếu file upload.' }, { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHash('sha1')
    .update(`timestamp=${timestamp}${cloudSecret}`)
    .digest('hex');

  const uploadData = new FormData();
  uploadData.append('file', file);
  uploadData.append('api_key', cloudKey);
  uploadData.append('timestamp', timestamp.toString());
  uploadData.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: uploadData,
  });

  const data = await response.json();
  if (!response.ok) {
    return NextResponse.json({ error: data.error?.message ?? 'Cloudinary upload failed.' }, { status: 500 });
  }

  return NextResponse.json({ url: data.secure_url });
}
