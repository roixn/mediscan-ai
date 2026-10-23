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

async function fetchGoogleNeuralTTS(text: string): Promise<Buffer> {
  // Clean text: strip markdown symbols, asterisks, bullet points
  const clean = text
    .replace(/[#*`_~]/g, '')
    .replace(/💊|🎯|⏰|⚠️|🌿|🔄|📌/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Split text into readable chunks under 180 chars on sentence boundaries
  const sentences = clean.match(/[^।!?.?\n]+[।!?.?\n]?/g) || [clean];
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if ((current + ' ' + trimmed).length <= 180) {
      current = current ? current + ' ' + trimmed : trimmed;
    } else {
      if (current) chunks.push(current);
      if (trimmed.length <= 180) {
        current = trimmed;
      } else {
        const words = trimmed.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub + ' ' + w).length <= 180) {
            sub = sub ? sub + ' ' + w : w;
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        if (sub) current = sub;
      }
    }
  }
  if (current) chunks.push(current);

  // Take top 4 chunks (around 500 characters, ideal 30s punchy audio explanation)
  const selectedChunks = chunks.slice(0, 4);

  const buffers: Buffer[] = [];
  for (const chunk of selectedChunks) {
    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=hi&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (res.ok) {
        const ab = await res.arrayBuffer();
        if (ab.byteLength > 100) {
          buffers.push(Buffer.from(ab));
        }
      }
    } catch (e) {
      console.error('Google chunk fetch error:', e);
    }
  }

  if (buffers.length === 0) {
    throw new Error('Failed to generate neural audio');
  }

  return Buffer.concat(buffers);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice = 'alice' } = body;

    if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 });

    // Step 1: Try ElevenLabs if API key is configured
    if (ELEVENLABS_API_KEY) {
      try {
        const voiceId = VOICES[voice]?.id || VOICES.alice.id;
        const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text: text.slice(0, 800),
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability: 0.50,
              similarity_boost: 0.75,
              style: 0.10,
              use_speaker_boost: true,
            },
          }),
        });

        if (elevenRes.ok) {
          const audioBuffer = await elevenRes.arrayBuffer();
          if (audioBuffer.byteLength > 200) {
            return new NextResponse(audioBuffer, {
              headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'no-cache',
                'X-Audio-Engine': 'ElevenLabs Multilingual v2',
              },
            });
          }
        } else {
          console.warn(`ElevenLabs returned ${elevenRes.status}, falling back to Google Neural Audio`);
        }
      } catch (err: any) {
        console.warn('ElevenLabs error, using Google Neural fallback:', err?.message);
      }
    }

    // Step 2: High-Quality Google Neural Hindi Voice (Natural, warm, fluent)
    const neuralBuffer = await fetchGoogleNeuralTTS(text);
    return new NextResponse(new Uint8Array(neuralBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
        'X-Audio-Engine': 'Google Neural Hindi',
      },
    });
  } catch (error: any) {
    console.error('TTS Error:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'TTS generation failed' },
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
