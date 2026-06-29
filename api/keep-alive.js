export default async function handler(req, res) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Missing SUPABASE_URL or SUPABASE_KEY",
      });
    }

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/settings?id=eq.1&select=id`,
      {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({
        ok: false,
        status: response.status,
        error: text,
      });
    }

    const data = await response.json();

    return res.status(200).json({
      ok: true,
      message: "Supabase keep-alive success",
      data,
      time: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}