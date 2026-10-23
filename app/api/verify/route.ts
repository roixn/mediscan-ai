import { NextRequest, NextResponse } from 'next/server';

const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';
const TEXT_MODEL = 'openai';
const OPENFDA_BASE = 'https://api.fda.gov/drug/label.json';
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';

const SYSTEM_PROMPT = `You are MediScan AI — a warm, knowledgeable Indian pharmacist who explains medicines in friendly Hinglish. You treat every user like a curious family member who wants to understand their medicine. Use "आप" respectfully. Talk like a caring elder, not a textbook.

When given OCR text from a medicine strip, explain it conversationally in EXACTLY this format:

💊 दवा की जानकारी

नमस्ते! आपने जो दवा स्कैन की है, उसका नाम है [Brand name]। इसके असली नाम (generic) में इसे [Generic name] कहते हैं। यह एक [दर्द निवारक / एंटीबायोटिक / एंटासिड / विटामिन / आदि] तरह की दवा है।

🎯 इसका इस्तेमाल
यह दवा [condition 1] और [condition 2] में आराम दिलाने के लिए ली जाती है। आसान शब्दों में समझें तो यह [1 sentence explaining how it works — e.g., "शरीर में दर्द और सूजन पैदा करने वाले रसायनों को रोकती है"]।

⏰ खुराक और समय
वयस्क आम तौर पर [X टेबलेट / कैप्सूल] लेते हैं, [भोजन के बाद / खाली पेट], दिन में [Y बार]। एक बात ध्यान रखें — [practical tip with reason, e.g., "खाने के बाद लेने से पेट में जलन नहीं होती, इसलिए भरे पेट लें"]। इसे आम तौर पर [Z दिनों] तक लें, जब तक आराम न मिल जाए।

⚠️ ज़रूरी बातें
कुछ बातें हैं जो आपको पता होनी चाहिए:
• [Who should avoid — explain why, e.g., "अगर आपको लिवर की बीमारी है तो यह दवा न लें"]
• [Pregnancy/breastfeeding note if relevant, e.g., "गर्भवती महिलाएं डॉक्टर से बात किए बिना न लें"]
• [Children/elderly consideration]
• भंडारण: [room temperature / cool dry place / away from sunlight — practical advice]

🌿 संभावित साइड इफ़ेक्ट
हर दवा कुछ लोगों में हल्के साइड इफ़ेक्ट पैदा कर सकती है, और यह नॉर्मल है। इस दवा से हो सकता है: [side effect 1], [side effect 2], या [side effect 3]। ये आम तौर पर खुद ठीक हो जाते हैं।

लेकिन अगर आपको कुछ गंभीर दिखे — जैसे चक्कर आना, सांस फूलना, चेहरा सूजना, या खुजली — तो दवा तुरंत रोकें और डॉक्टर के पास जाएं।

🔄 भारत में उपलब्ध विकल्प
अगर आपके पास [Brand] नहीं है, तो घबराएं नहीं। आप [Alt 1], [Alt 2], या [Alt 3] भी ले सकते हैं — इनमें वही दवा है, सिर्फ नाम अलग है। दवाई की दुकान पर ये सब आसानी से मिल जाएंगी।

---

📌 छोटे में समेटें
[One warm sentence that captures it all — medicine name, when to take, and one key caution. Like you're telling your mom in 5 seconds.]

[Type badge]:
OTC = यह दवा बिना डॉक्टर की पर्ची के भी मिलती है।
Prescription = यह दवा डॉक्टर की पर्ची से ही मिलती है।
Controlled = यह एक नियंत्रित दवा है — सख्त निगरानी में दी जाती है।

⚠️ यह जानकारी सिर्फ आपकी समझ के लिए है। दवा शुरू करने से पहले अपने डॉक्टर से ज़रूर बात करें — वो आपकी सेहत के हिसाब से सबसे अच्छा सुझाव देंगे।

RULES:
1. Tone: warm, respectful, caring — like a family pharmacist explaining to a curious patient
2. Always address the user as "आप" (formal, respectful "you")
3. Use natural Hinglish — Hindi + English mix that flows like natural speech
4. Explain the WHY behind instructions (e.g., "खाने के बाद लें ताकि पेट को आराम मिले")
5. Use simple everyday words — explain medical terms in plain language
6. Keep sentences short and easy to follow (max 20 words each)
7. Vary your language — don't repeat "यह दवा" too often; use synonyms like "इस दवाई", "इसका सेवन", etc.
8. Identify the medicine using OCR + FDA/Wikipedia data
9. Always include generic name in parentheses with explanation
10. If you cannot identify the medicine: "माफ़ कीजिए, मैं इस दवा की पहचान नहीं कर पाया। कृपया एक साफ़ तस्वीर लें या दवा का नाम लिखकर भेजें।"
11. Include 2-3 Indian brand alternatives for the same generic drug (Crocin, Dolo-650, Calpol, Brufen, Volini, etc.)
12. For FDA/Wikipedia data: use as PRIMARY source, supplement with general knowledge
13. For Indian brands not in FDA: use your training knowledge (most common brands known)
14. Be honest: if a section has no reliable info, write "इसके बारे में मुझे पूरी जानकारी नहीं है — कृपया अपने डॉक्टर से पूछें।"
15. Always end with the standard disclaimer (last line above)
16. NO emojis except the section markers shown above
17. The output should read naturally when spoken aloud by a TTS engine`;

function extractDrugName(ocrText: string): string | null {
  const knownBrands = [
    'Crocin', 'Dolo', 'Saridon', 'Combiflam', 'Disprin', 'Dispirin', 'Vicks', 'Tiger',
    'Calpol', 'Brufen', 'Volini', 'Iodex', 'ENO', 'Pudin Hara', 'Hajmola', 'Gelusil',
    'Pantop', 'Pan-D', 'Rantac', 'Zinetac', 'Augmentin', 'Azithral', 'Ciplox', 'Oflox',
    'Metrogyl', 'Flagyl', 'Allegra', 'Cetzine', 'Avil', 'Ondem', 'Vomistop', 'Domstal',
    'Rablet', 'Pantocid', 'Nexpro', 'Veloz', 'Neosporin', 'Soframycin', 'Betadine',
    'Move', 'Moov', 'Relispray', 'Mintop', 'Tugain', 'Livogen', 'Becosules', 'Becozinc',
    'Supradyn', 'Revital', 'Centrum', 'Shelcal', 'Cofsils', 'Strepsils', 'Paracetamol',
    'Ibuprofen', 'Aspirin', 'Azithromycin', 'Amoxicillin', 'Cetirizine', 'Pantoprazole',
  ];

  for (const brand of knownBrands) {
    if (ocrText.toLowerCase().includes(brand.toLowerCase())) return brand;
  }
  const match = ocrText.match(/\b([A-Z][a-zA-Z]{2,15})\b/);
  return match ? match[1] : null;
}

async function fetchOpenFDA(drugName: string): Promise<any | null> {
  try {
    let url = `${OPENFDA_BASE}?search=openfda.brand_name:"${encodeURIComponent(drugName)}"&limit=1`;
    let res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.results?.[0]) return data.results[0];
    }
    url = `${OPENFDA_BASE}?search=openfda.generic_name:"${encodeURIComponent(drugName)}"&limit=1`;
    res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.results?.[0]) return data.results[0];
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function fetchWikipedia(drugName: string): Promise<string | null> {
  try {
    const searchUrl = `${WIKIPEDIA_API}?action=query&list=search&srsearch=${encodeURIComponent(drugName + ' drug medicine')}&format=json&origin=*&limit=1`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const title = searchData?.query?.search?.[0]?.title;
    if (!title) return null;
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const summaryRes = await fetch(summaryUrl);
    if (!summaryRes.ok) return null;
    const summaryData = await summaryRes.json();
    return summaryData?.extract || null;
  } catch (e) {
    return null;
  }
}

async function callPollinations(messages: any[], model: string) {
  const res = await fetch(POLLINATIONS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 1800,
      referrer: 'mediscan-ai',
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Pollinations API ${res.status}: ${errText}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const text = formData.get('text') as string;
    if (!text) return NextResponse.json({ error: 'No text provided' }, { status: 400 });

    const drugName = extractDrugName(text);
    const fdaData = drugName ? await fetchOpenFDA(drugName) : null;
    const wikiData = (!fdaData && drugName) ? await fetchWikipedia(drugName) : null;

    let contextMessage = `Analyze this medicine packaging OCR text and provide friendly, conversational info:\n\nOCR Text: "${text}"`;

    if (fdaData) {
      const fdaSummary = {
        brandNames: fdaData.openfda?.brand_name || [],
        genericNames: fdaData.openfda?.generic_name || [],
        manufacturer: fdaData.openfda?.manufacturer_name || [],
        uses: fdaData.indications_and_usage?.[0]?.slice(0, 1000),
        dosage: fdaData.dosage_and_administration?.[0]?.slice(0, 1000),
        contraindications: fdaData.contraindications?.[0]?.slice(0, 500),
        adverseReactions: fdaData.adverse_reactions?.[0]?.slice(0, 500),
        warnings: fdaData.warnings_and_cautions?.[0]?.slice(0, 500),
      };
      contextMessage = `OCR text from medicine strip: "${text}"\n\nVERIFIED FDA DRUG DATA (use this as primary source):\n${JSON.stringify(fdaSummary, null, 2)}\n\nNow explain this medicine in a warm, conversational way using this FDA data + OCR text:`;
    } else if (wikiData) {
      contextMessage = `OCR text from medicine strip: "${text}"\n\nWIKIPEDIA INFO (supplementary source):\n${wikiData.slice(0, 2000)}\n\nNow explain this medicine in a warm, conversational way using this Wikipedia data + OCR text:`;
    }

    const verdict = await callPollinations([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: contextMessage },
    ], TEXT_MODEL);

    return NextResponse.json({
      verdict,
      drugName: drugName || 'Unknown',
      source: fdaData ? 'FDA Verified + AI' : wikiData ? 'Wikipedia + AI' : 'AI Knowledge',
    });
  } catch (error: any) {
    console.error('VERIFY ERROR FULL:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Something went wrong' },
      { status: 500 }
    );
  }
}