// send-reminders — Supabase Edge Function
//
// Runs on a schedule (e.g. every day at 9 AM via Supabase Cron).
// Finds events happening tomorrow, sends each signed-up participant
// an email (Resend) and SMS (Twilio), then stamps reminder_sent_at
// on the event so the batch never fires twice.
//
// Required environment variables (set in Supabase Dashboard → Settings → Edge Functions):
//   RESEND_API_KEY        — from resend.com
//   FROM_EMAIL            — verified sender address, e.g. reminders@countmeinpro.com
//   TWILIO_ACCOUNT_SID    — from twilio.com console
//   TWILIO_AUTH_TOKEN     — from twilio.com console
//   TWILIO_PHONE_NUMBER   — your Twilio number, e.g. +15551234567
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "reminders@countmeinpro.com"

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID")
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER")

// ---------------------------------------------------------------------------
// Types matching the database schema
// ---------------------------------------------------------------------------

interface Event {
  id: string
  title: string
  description: string | null
  date: string       // "YYYY-MM-DD"
  time: string       // e.g. "10:00 AM"
  location: string | null
}

interface Participant {
  name: string
  email: string
  phone: string | null
}

interface SignupRow {
  events: Event
  participants: Participant
}

// ---------------------------------------------------------------------------
// Email via Resend
// ---------------------------------------------------------------------------

async function sendEmail(participant: Participant, event: Event): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not set — skipping email for", participant.email)
    return
  }

  const locationLine = event.location
    ? `<li>📍 <strong>${event.location}</strong></li>`
    : ""

  const descriptionBlock = event.description
    ? `<p style="color:#555;">${event.description}</p>`
    : ""

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `CountMeIn Pro <${FROM_EMAIL}>`,
      to: participant.email,
      subject: `Reminder: "${event.title}" is tomorrow!`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#222;">
          <h2 style="color:#4A90D9;">Just a friendly reminder, ${participant.name}!</h2>
          <p>You're signed up for <strong>${event.title}</strong>.</p>
          <ul style="list-style:none;padding:0;line-height:2.2;font-size:15px;">
            <li>📅 <strong>${event.date}</strong></li>
            <li>🕐 <strong>${event.time}</strong></li>
            ${locationLine}
          </ul>
          ${descriptionBlock}
          <p style="margin-top:24px;color:#888;font-size:12px;">
            You received this reminder because you signed up via CountMeIn Pro.
          </p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error (${participant.email}): ${res.status} — ${body}`)
  }
}

// ---------------------------------------------------------------------------
// SMS via Twilio
// ---------------------------------------------------------------------------

async function sendSms(participant: Participant, event: Event): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn("Twilio env vars not set — skipping SMS for", participant.phone)
    return
  }

  const lines = [
    `Reminder: "${event.title}" is tomorrow!`,
    `Date: ${event.date} at ${event.time}`,
    event.location ? `Location: ${event.location}` : null,
  ].filter(Boolean) as string[]

  const params = new URLSearchParams({
    To: participant.phone!,
    From: TWILIO_PHONE_NUMBER,
    Body: lines.join("\n"),
  })

  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Twilio error (${participant.phone}): ${res.status} — ${body}`)
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (_req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // "Tomorrow" in UTC — adjust if your users are in a single timezone
  const tomorrow = new Date()
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split("T")[0] // "YYYY-MM-DD"

  console.log(`Checking for events on ${tomorrowStr} with no reminder sent yet…`)

  // Fetch all signups for tomorrow's un-reminded events in one query
  const { data: rows, error: fetchError } = await supabase
    .from("event_signups")
    .select(`
      events!inner ( id, title, description, date, time, location, reminder_sent_at ),
      participants!inner ( name, email, phone )
    `)
    .eq("events.date", tomorrowStr)
    .is("events.reminder_sent_at", null)

  if (fetchError) {
    console.error("DB fetch failed:", fetchError.message)
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!rows || rows.length === 0) {
    console.log("No reminders to send.")
    return new Response(
      JSON.stringify({ sent: 0, message: "No reminders to send." }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  // Group participants by event so we can stamp reminder_sent_at per event
  const eventMap = new Map<string, { event: Event; participants: Participant[] }>()

  for (const row of rows as unknown as SignupRow[]) {
    const { events: event, participants: participant } = row
    if (!eventMap.has(event.id)) {
      eventMap.set(event.id, { event, participants: [] })
    }
    eventMap.get(event.id)!.participants.push(participant)
  }

  let emailsSent = 0
  let smsSent = 0
  const errors: string[] = []

  for (const { event, participants } of eventMap.values()) {
    console.log(`Sending reminders for event "${event.title}" (${participants.length} participants)`)

    for (const participant of participants) {
      // Email
      try {
        await sendEmail(participant, event)
        emailsSent++
      } catch (err) {
        const msg = (err as Error).message
        console.error(msg)
        errors.push(msg)
      }

      // SMS — only if the participant gave a phone number
      if (participant.phone) {
        try {
          await sendSms(participant, event)
          smsSent++
        } catch (err) {
          const msg = (err as Error).message
          console.error(msg)
          errors.push(msg)
        }
      }
    }

    // Stamp the event so this batch never fires again for it,
    // even if some individual messages failed (avoids spam on retry).
    const { error: updateError } = await supabase
      .from("events")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", event.id)

    if (updateError) {
      const msg = `Failed to stamp reminder_sent_at for event ${event.id}: ${updateError.message}`
      console.error(msg)
      errors.push(msg)
    }
  }

  console.log(`Done — emails: ${emailsSent}, SMS: ${smsSent}, errors: ${errors.length}`)

  return new Response(
    JSON.stringify({ emailsSent, smsSent, errors }),
    { headers: { "Content-Type": "application/json" } },
  )
})
