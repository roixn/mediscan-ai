import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY as string;

// Confirmed premade voices that work on Free tier
const VOICES: Record<string, { id: string; name: string; desc: string }> = {
  alice: { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', desc: 'Clear, Engaging Educator' },
  eric: { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', desc: 'Smooth, Trustworthy' },
  brian: { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', desc: 'Deep, Resonant, Comforting' },
  matilda: { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', desc: 'Knowledgeable, Professional' },
  daniel: { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', desc: 'Steady Broadcaster' },
  bill: { id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', desc: 'Wise, Mature, Balanced' },
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice = 'alice' } = body;

    if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    if (!ELEVENLABS_API_KEY) return NextResponse.json({ error: 'ElevenLabs key not set' }, { status: 500 });

    const voiceId = VOICES[voice]?.id || VOICES.alice.id;

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.slice(0, 4500),
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.50,
          similarity_boost: 0.75,
          style: 0.10,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`ElevenLabs ${res.status}: ${errText}`);
    }

    const audioBuffer = await res.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('TTS Error:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'TTS failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    voices: Object.entries(VOICES).map(([key, v]) => ({
      id: key,
      name: v.name,
      desc: v.desc,
    })),
  });
}