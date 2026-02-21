import Anthropic from 'npm:@anthropic-ai/sdk';

// ---------------------------------------------------------------------------
// CORS headers — required so the React Native app (and web preview) can call
// this function from any origin.
// ---------------------------------------------------------------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Supabase Edge Functions receive a preflight OPTIONS request before the
  // real POST.  We must respond with 200 + CORS headers or the browser will
  // block the follow-up request.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { eventTitle, eventDescription } = await req.json() as {
      eventTitle: string;
      eventDescription?: string;
    };

    if (!eventTitle?.trim()) {
      return new Response(
        JSON.stringify({ error: 'eventTitle is required.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ANTHROPIC_API_KEY is stored in Supabase project settings → Secrets.
    // It is never sent to the client.
    const client = new Anthropic({
      apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
    });

    const prompt =
      `You are a helpful event planning assistant. Given this event: "${eventTitle}"` +
      (eventDescription ? ` — "${eventDescription}"` : '') +
      `, suggest 5-8 unique signup slots or volunteer roles that organizers often forget. ` +
      `Go beyond the obvious — for a bake sale, suggest things like "Cash register volunteer", ` +
      `"Napkins & paper plates", "Setup crew (30 min early)", "Cleanup crew". ` +
      `For a school fundraiser, suggest "Ticket sales", "Photographer", "Sound system helper". ` +
      `Return ONLY a valid JSON array of short strings (2–5 words each), no explanation, no markdown. ` +
      `Example: ["Bring paper plates","Cash register volunteer","Setup crew"]`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = (message.content[0] as { type: string; text: string }).text ?? '[]';
    const match = rawText.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Model returned unparseable output.');

    const suggestions = JSON.parse(match[0]) as string[];

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error.';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
