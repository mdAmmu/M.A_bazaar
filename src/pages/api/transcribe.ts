// pages/api/transcribe.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { file } = req.body;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    // Initialize Gemini (OpenAI-compatible) client server-side
    const client = new OpenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Convert base64 to buffer
    const audioBuffer = Buffer.from(file, 'base64');

    // Transcribe audio
    const transcription = await client.audio.transcriptions.create({
      file: audioBuffer,
      model: 'whisper-1', // Gemini supports whisper endpoint
    });

    res.status(200).json({ transcript: transcription.text });
  } catch (err: any) {
    console.error('Transcription error:', err);
    res.status(500).json({ error: err.message });
  }
}
